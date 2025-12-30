# Pipeline Resilience Audit - Stalemate Prevention

## 🎯 Critical Principle
**The system must ALWAYS have a way to progress. No dead ends, no infinite waits.**

---

## 🔍 Current Stalemate Risks

### 1. ⚠️ **Orchestrator Waiting for Events**
**Location**: `orchestrator.ts`

**Risk Scenarios**:
- Volume generation function fails without emitting `volume.generated` event
- Consultant service fails without emitting `volume.consulted` event
- Preparation phase fails without emitting `preparation.complete` event

**Current State**:
```typescript
// Waits forever (up to 45m timeout) for volume.generated
await step.waitForEvent(`wait-volume-${volume.id}-generated`, {
    event: 'proposal/volume.generated',
    timeout: '45m', // ⚠️ What if volume fails?
})
```

**Issue**: If a volume generation function crashes/fails, orchestrator waits 45 minutes before timing out.

---

### 2. ⚠️ **Consultant Service Waiting for User Decision**
**Location**: `consultant-service.ts`

**Risk Scenarios**:
- User never approves or requests iteration
- User closes browser and forgets about it
- System waits 7 days (!)

**Current State**:
```typescript
await step.waitForEvent(`volume-${volume}-decision-${iteration}`, {
    event: ['proposal/volume.approved', 'proposal/volume.iterate'],
    timeout: '7d', // ⚠️ 7 days is too long!
})
```

**Issue**: 7-day timeout means job sits in "review" status for a week before failing.

---

### 3. ⚠️ **Volume Generation Failures**
**Location**: `volume-generation.ts`

**Current Behavior**:
- On failure: Updates volume status to `blocked`
- Does NOT emit `volume.generated` event
- Orchestrator waits 45 minutes for timeout

**Issue**: Failed volume blocks entire pipeline until timeout.

---

### 4. ⚠️ **Iteration Failures**
**Location**: `volume-iteration-handler.ts`

**Current Behavior**:
- On failure: Updates volume status to `blocked`
- Does NOT emit `iteration.complete` event
- Consultant service waits for timeout

**Issue**: Failed iteration blocks that volume's approval workflow.

---

### 5. ⚠️ **Preparation Phase Failures**
**Location**: `preparation-phase.ts`

**Current Behavior**:
- On failure: Updates job status to `failed`
- Does NOT emit `preparation.complete` event
- Orchestrator waits 30 minutes for timeout

**Issue**: Failed preparation blocks entire pipeline.

---

## ✅ Recommended Solutions

### Solution 1: **Always Emit Events (Even on Failure)**

Modify all functions to emit completion events with success/failure status:

```typescript
// BEFORE (blocks on failure):
if (error) {
    throw error // ❌ No event emitted
}
await step.sendEvent('emit-volume-generated', {...})

// AFTER (always progresses):
await step.sendEvent('emit-volume-generated', {
    name: 'proposal/volume.generated',
    data: {
        jobId,
        volume,
        success: !error, // ✅ Include success flag
        error: error?.message
    }
})
if (error) throw error // Still throw for retry logic
```

---

### Solution 2: **Add "Skip" Capability for Failed Volumes**

Allow orchestrator to skip failed volumes after timeout:

```typescript
const volumeGenerated = await step.waitForEvent(`wait-volume-${volume.id}-generated`, {
    event: 'proposal/volume.generated',
    timeout: '15m', // Reduced from 45m
})

if (!volumeGenerated) {
    logger.warn(`[Orchestrator] Volume ${volume.id} generation timed out - marking as skipped`)
    
    // Update volume status to skipped (not blocked)
    await updateVolumeStatus(jobId, volume.id, 'skipped')
    
    // Continue to next volume instead of failing entire job
    continue
}
```

---

### Solution 3: **Implement Manual Override API**

Add API endpoints for manual intervention:

```typescript
// POST /api/proposals/:jobId/volume/:volumeId/skip
// Allows user to skip a failed/stuck volume

// POST /api/proposals/:jobId/force-continue
// Allows user to force pipeline to continue past stalemate

// POST /api/proposals/:jobId/retry-step
// Allows user to retry a failed step
```

---

### Solution 4: **Reduce User Wait Timeout**

Change consultant service timeout from 7 days to something reasonable:

```typescript
// BEFORE:
timeout: '7d' // ⚠️ Too long!

// AFTER:
timeout: '72h' // 3 days max, then auto-approve with warning
```

After timeout, auto-approve with notification:
```typescript
if (!userDecision) {
    logger.warn(`[Consultant] Volume ${volume} approval timed out - auto-approving`)
    
    await updateVolumeStatus(jobId, volume, 'approved')
    await storeSystemNote(jobId, volume, 'Auto-approved after 72h timeout')
    
    // Continue pipeline
    return { success: true, decision: 'auto-approved' }
}
```

---

### Solution 5: **Add Health Check & Recovery System**

Create a new function that monitors for stalemates:

```typescript
export const monitorStalematesFunction = inngest.createFunction(
    { id: 'monitor-stalemates', name: 'Monitor Stalemates' },
    { cron: '*/10 * * * *' }, // Every 10 minutes
    async () => {
        // Find jobs stuck in processing for >60 minutes
        const stuckJobs = await findStuckJobs()
        
        for (const job of stuckJobs) {
            // Check what step it's stuck on
            if (job.current_step.includes('Generating Volume')) {
                // Retry volume generation
                await retryVolumeGeneration(job)
            }
            else if (job.status === 'review') {
                // Send reminder notification
                await sendReminderNotification(job)
            }
        }
    }
)
```

---

### Solution 6: **Add UI "Force Continue" Button**

In the progress page, add emergency controls:

```typescript
// Show when job is stuck for >15 minutes
{isStuck && (
    <div className="emergency-controls">
        <button onClick={handleForceSkipVolume}>
            ⚠️ Skip Failed Volume & Continue
        </button>
        <button onClick={handleRetryStep}>
            🔄 Retry Current Step
        </button>
        <button onClick={handleForceComplete}>
            ✅ Force Mark as Complete
        </button>
    </div>
)}
```

---

## 🎯 Implementation Priority

### HIGH PRIORITY (Implement Immediately):
1. ✅ **Always emit events** - Even on failure
2. ✅ **Add skip capability** - Don't block entire pipeline on one failure
3. ✅ **Reduce timeouts** - 45m → 15m for generation, 7d → 72h for approval

### MEDIUM PRIORITY (Implement Soon):
4. ✅ **Manual override API** - Allow force-continue
5. ✅ **Auto-approval after timeout** - Don't wait forever for user
6. ✅ **Stalemate monitor** - Detect and auto-recover

### LOW PRIORITY (Nice to Have):
7. ✅ **UI emergency controls** - Give user manual override buttons
8. ✅ **Detailed health dashboard** - Show where pipeline is stuck

---

## 🔄 Recovery Workflows

### Scenario 1: Volume Generation Fails
```
1. Volume generation function tries 2 retries (built-in)
2. If still fails, emits volume.generated with success=false
3. Orchestrator sees failure, updates UI to show "Volume X Failed"
4. User options:
   a) Retry volume generation
   b) Skip volume and continue with 3/4 volumes
   c) Cancel entire job
5. System default after 15m: Skip volume and continue
```

### Scenario 2: User Doesn't Approve
```
1. Consultant service waits 72 hours for user decision
2. After 72 hours:
   a) Send email reminder
   b) Wait 24 more hours
   c) After 96 hours total: Auto-approve with warning flag
3. Pipeline continues with auto-approved volume
4. Final report notes "Volume X auto-approved due to timeout"
```

### Scenario 3: Iteration Fails
```
1. Iteration handler tries 2 retries
2. If still fails, emits iteration.complete with success=false
3. Consultant service sees failure
4. User options:
   a) Retry iteration
   b) Approve current version despite iteration failure
   c) Cancel volume (skip to next)
5. System default: Return to awaiting approval with error message
```

---

## 🧪 Testing Stalemate Recovery

### Test Cases:
1. ✅ Kill volume generation mid-run → System should timeout and skip
2. ✅ Never approve a volume → System should auto-approve after 72h
3. ✅ Fail iteration 3 times → System should offer to skip or continue
4. ✅ Crash Inngest → System should resume from last checkpoint
5. ✅ Database connection failure → System should retry and eventually fail gracefully

---

## 📊 Metrics to Track

1. **Stalemate Count**: How many jobs get stuck per week
2. **Timeout Frequency**: How often do timeouts trigger
3. **Manual Intervention Rate**: How often users need to force-continue
4. **Auto-Approval Rate**: How often do volumes auto-approve
5. **Recovery Success Rate**: % of stuck jobs that recover vs. fail

---

## ✅ Action Items

### Immediate (Before Next Test):
- [ ] Update all functions to emit events even on failure
- [ ] Reduce generation timeout from 45m to 15m
- [ ] Reduce approval timeout from 7d to 72h
- [ ] Add skip capability to orchestrator
- [ ] Add auto-approval after timeout to consultant service

### Next Sprint:
- [ ] Implement manual override API endpoints
- [ ] Create stalemate monitor function
- [ ] Add UI emergency controls
- [ ] Build health dashboard

### Future:
- [ ] Implement advanced retry logic
- [ ] Add email notifications for stuck jobs
- [ ] Build admin panel for manual intervention
- [ ] Add detailed logging for debugging stalemates

---

**Key Principle**: Every wait/timeout must have a default action that allows the system to progress.



