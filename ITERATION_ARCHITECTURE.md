# Volume Iteration Architecture

## Overview

The volume iteration system uses a **dedicated Inngest function** to handle all iteration workflows. This provides better modularity, monitoring, and error handling compared to inline iteration logic.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER REQUESTS ITERATION                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│          API: /api/proposals/{jobId}/volume/iterate             │
│  - Validates inputs                                             │
│  - Sends 'proposal/volume.iterate' event                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           DEDICATED ITERATION HANDLER FUNCTION                  │
│  (handleVolumeIterationFunction)                                │
│                                                                 │
│  1. Fetch job context and company data                         │
│  2. Update status to 'iterating'                               │
│  3. Execute Rewriter Agent with:                               │
│     - Original content                                         │
│     - Consultant insights                                      │
│     - User feedback (compliance gaps)                          │
│     - RFP requirements                                         │
│  4. Save rewritten content to database                         │
│  5. Re-score with Compliance Auditor (Agent 5)                 │
│  6. Run Consultant if score < 80%                              │
│  7. Set status to 'awaiting_approval'                          │
│  8. Send 'proposal/volume.iteration.complete' event            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               MAIN PIPELINE RECEIVES COMPLETION                 │
│  (generateProposalFunction)                                     │
│                                                                 │
│  - Waiting at step.waitForEvent()                              │
│  - Receives 'proposal/volume.iteration.complete'               │
│  - Reloads updated context from database                       │
│  - Loops back for next approval/iteration cycle                │
└─────────────────────────────────────────────────────────────────┘
```

## Event Types

### 1. `proposal/volume.iterate`
**Triggered by:** User clicking "Request Iteration" button  
**Handled by:** `handleVolumeIterationFunction`  
**Data:**
```typescript
{
  jobId: string
  volume: number        // 1-4
  userFeedback: string  // Compliance gaps
  currentScore: number  // Previous score
  iteration: number     // Current iteration (1-5)
}
```

### 2. `proposal/volume.iteration.complete`
**Triggered by:** Iteration handler after successful completion  
**Handled by:** Main pipeline's `step.waitForEvent()`  
**Data:**
```typescript
{
  jobId: string
  volume: number
  iteration: number     // Completed iteration
  newScore: number      // Updated compliance score
  improvement: number   // Score delta
}
```

### 3. `proposal/volume.approved`
**Triggered by:** User clicking "Approve Volume" button  
**Handled by:** Main pipeline's `step.waitForEvent()`  
**Data:**
```typescript
{
  jobId: string
  volume: number
  finalScore: number
}
```

## Functions

### `handleVolumeIterationFunction`
**ID:** `rfp-proposal-volume-iteration`  
**Trigger:** Event `proposal/volume.iterate`  
**Retries:** 2  
**Timeout:** Inherited from step timeout (2h)

**Steps:**
1. `fetch-context` - Load job and company data
2. `update-status-iterating` - Set volume status
3. `rewrite-volume` - Execute rewriter agent
4. `save-rewritten-content` - Persist to database
5. `update-status-scoring` - Update status
6. `score-volume` - Execute compliance auditor
7. `update-scores` - Save scores and compliance details
8. `consult-volume` - Run consultant if score < 80%
9. `await-approval` - Set awaiting approval
10. `send-completion-event` - Notify main pipeline

### `generateProposalFunction` (Main Pipeline)
**ID:** `rfp-proposal-generator`  
**Trigger:** Event `proposal/generate.requested`  
**Changes for iteration support:**

- **Iteration 1:** Generates, saves, scores, consults inline
- **Iteration 2+:** Waits for dedicated handler, reloads context
- **Event listening:** Listens for `approved`, `iterate`, and `iteration.complete`

## Benefits

### 1. **Modularity**
- Iteration logic is self-contained
- Can be tested/debugged independently
- Easy to modify without touching main pipeline

### 2. **Monitoring**
- Dedicated Inngest function appears separately in dashboard
- Can see iteration progress independently
- Better error tracking per iteration

### 3. **Retry Logic**
- Iterations can be retried independently (2 retries)
- Main pipeline doesn't need to handle iteration failures
- Cleaner error boundaries

### 4. **Scalability**
- Could run iterations in parallel for different volumes (future)
- Can add rate limiting specifically for iterations
- Better resource management

### 5. **Debugging**
- Clear separation of concerns
- Logs are grouped by function
- Easier to trace issues

## Database Updates

The iteration handler updates:
- `volume_status` → 'iterating' → 'scoring' → 'awaiting_approval'
- `volume_iterations` → Increments iteration count
- `volume_scores` → Updates with new score
- `volume_compliance_details` → New compliance breakdown
- `volumes` (JSONB) → Stores rewritten HTML content
- `current_volume_insights` → Updated consultant insights (if applicable)

## UI Integration

### Status Display
| Status | Description | UI Indicator |
|--------|-------------|--------------|
| `generating` | Initial creation | 🟠 Orange "Generating" |
| `iterating` | Rewriting in progress | 🟣 Purple "Iterating (v2)" |
| `scoring` | Being audited | 🟣 Purple "Iterating (v2)" |
| `awaiting_approval` | Ready for review | 🟠 Orange "Complete" |
| `approved` | User approved | 🟢 Green "Complete" |

### Auto-Fix Compliance Feature
The "🤖 Auto-Fix Gaps" button generates structured feedback:
- Overall compliance score
- Critical gaps
- Requirement-specific issues with scores and rationale
- All gaps from compliance audit

This feedback is passed directly to the rewriter agent via the iteration handler.

## Error Handling

### Iteration Handler Errors
- If rewrite fails: Sets volume status to 'failed'
- If scoring fails: Sets volume status to 'failed'
- Main pipeline continues waiting (won't deadlock)
- User sees error in UI

### Main Pipeline Errors
- If iteration doesn't complete in 2h: Timeout
- Falls back to max iterations check
- Can force approval if needed

## Configuration

```typescript
// Maximum iterations per volume
const MAX_ITERATIONS = 5

// Iteration timeout
const ITERATION_TIMEOUT = '2h'

// Main pipeline volume decision timeout
const DECISION_TIMEOUT = '7d'
```

## Monitoring

### Inngest Dashboard
- **Function:** `rfp-proposal-volume-iteration`
- **Metrics:** Success rate, duration, retries
- **Logs:** Grouped by iteration handler
- **Events:** Track `iterate` → `iteration.complete` flow

### Application Logs
```log
[Iteration] Starting Volume 1 iteration 2
[Iteration] Fetching job context
[Iteration] Rewriting Volume 1
[Iteration] Saving rewritten Volume 1 (243 KB)
[Iteration] Scoring rewritten Volume 1
[Iteration] Volume 1 re-scored: 92% (improvement: +4%)
[Iteration] Completion event sent
```

## Future Enhancements

1. **Parallel Iterations:** Run multiple volume iterations simultaneously
2. **Iteration Analytics:** Track average score improvements
3. **Smart Iteration:** Auto-approve if score > 95%
4. **Iteration History:** Store all versions, allow rollback
5. **A/B Testing:** Generate multiple iterations, let user choose

## Migration Notes

### Breaking Changes
- None - backward compatible

### New Database Columns
- All existing columns are used

### New Events
- `proposal/volume.iteration.complete` (new)

### Deprecated
- Inline iteration logic in main pipeline (removed)




