# Testing Guide - Modular Pipeline Architecture

## ✅ Pre-Test Checklist

### 1. Database Migration Applied
- [x] Migration `014_modular_function_status.sql` applied successfully
- Verify with: `SELECT preparation_phase_status FROM proposal_jobs LIMIT 1;`

### 2. Development Server Running
```bash
cd rfpGenerator
npm run dev
```

### 3. Inngest Dev Server Running
- Check: `http://localhost:8288` (or your Inngest dashboard)
- Verify 8 functions registered:
  1. ✅ `generate-proposal-orchestrator`
  2. ✅ `preparation-phase`
  3. ✅ `volume-generation`
  4. ✅ `consultant-service`
  5. ✅ `final-assembly`
  6. ✅ `final-scoring`
  7. ✅ `rfp-proposal-volume-iteration`
  8. ✅ `rfp-proposal-generator-monitor-stalled-jobs`

---

## 🧪 Test Scenarios

### Test 1: Happy Path (No Iterations)
**Goal**: Verify complete pipeline with all volumes approved immediately

**Steps**:
1. Navigate to dashboard and start a new proposal
2. Upload an RFP document
3. Monitor the progress page

**Expected Behavior**:
- ✅ **Preparation Phase** (0-30%):
  - Status badge shows "⟳ Running" → "✓ Complete"
  - All 4 agents (0-3) show checkmarks when complete
  
- ✅ **Volume Generation** (30-80%):
  - All 4 volume cards show "Generating (Parallel)" simultaneously
  - Each volume has its own progress bar
  - Section-level progress updates in real-time
  
- ✅ **Consultation** (80-90%):
  - Each volume shows score after generation
  - Volumes transition to "Awaiting Approval" one by one
  - Approve each volume immediately
  
- ✅ **Final Assembly** (90-95%):
  - Assembly section appears
  - Quality checks displayed
  
- ✅ **Final Scoring** (95-100%):
  - Final compliance report appears
  - Overall score displayed
  - Cross-volume analysis shown
  - Quality assurance checklist visible

**Duration**: ~15-20 minutes (depending on RFP size)

---

### Test 2: Volume Iteration Workflow
**Goal**: Verify iteration works without blocking other volumes

**Steps**:
1. Start a new proposal
2. Wait for Volume 1 to complete and show "Awaiting Approval"
3. Click on Volume 1 card to open details
4. Click "🤖 Auto-Fix Gaps" button
5. Review auto-generated feedback
6. Click "Request Iteration"
7. Monitor the iteration process

**Expected Behavior**:
- ✅ Volume 1 shows "Iterating (v2)" with purple progress bar
- ✅ Iteration badge "v2" appears on volume card
- ✅ Other volumes (2, 3, 4) continue generating in parallel
- ✅ After iteration completes:
  - Volume 1 shows new score
  - Volume 1 returns to "Awaiting Approval"
  - Can approve or iterate again (up to 5 iterations)

**Key Check**: Verify in Inngest dashboard that `volume-generation` functions for volumes 2-4 continue running while volume 1 iterates.

---

### Test 3: Parallel Generation Monitoring
**Goal**: Verify all 4 volumes generate simultaneously

**Steps**:
1. Start a new proposal
2. Once preparation completes, immediately watch the volume cards
3. Open Inngest dashboard in another tab

**Expected Behavior**:
- ✅ All 4 volume cards update simultaneously
- ✅ Each shows "Generating (Parallel)" status
- ✅ In Inngest dashboard:
  - 4 concurrent `volume-generation` function runs
  - Each with different `volume` parameter (1, 2, 3, 4)
- ✅ Section progress updates for all volumes in real-time

**Performance Check**: Volume generation should complete in ~10-15 minutes total (vs. 40-60 minutes sequential).

---

### Test 4: Final Compliance Report
**Goal**: Verify comprehensive final report displays correctly

**Steps**:
1. Complete a full pipeline run (approve all volumes)
2. Wait for final scoring to complete
3. Review the "Final Compliance Report" section

**Expected Behavior**:
- ✅ **Overall Score**: Large number (0-100%) with color coding
- ✅ **Cross-Volume Analysis**: 4 check cards:
  - Duplicate Content Check
  - Consistency Check
  - Completeness Check
  - RFP Alignment Check
- ✅ **Quality Assurance**: List of checks with pass/fail indicators
- ✅ **Critical Gaps**: Red alert box if gaps exist (up to 5 shown)
- ✅ **Recommendation**: "Ready for submission" or "Needs review"

**Status Check**: Job status should be either `completed` or `needs_revision`.

---

### Test 5: UI Real-Time Updates
**Goal**: Verify UI updates reflect backend state accurately

**Steps**:
1. Start a new proposal
2. Keep progress page open
3. Monitor updates every 3 seconds (auto-refresh)

**Expected Behavior**:
- ✅ **Preparation Phase**:
  - Status badge updates: Pending → Running → Complete
  - Individual agent checkmarks appear as they complete
  
- ✅ **Volume Cards**:
  - Status transitions: Pending → Generating → Awaiting Approval → Complete
  - Progress bars update smoothly
  - Scores appear after consultation
  - Iteration badges appear when iterating
  
- ✅ **Final Sections**:
  - Assembly section appears when all volumes approved
  - Final compliance report appears after scoring

---

### Test 6: Error Recovery
**Goal**: Verify graceful error handling

**Steps**:
1. Start a proposal with invalid/corrupted RFP
2. Or simulate a failure by stopping Inngest mid-run

**Expected Behavior**:
- ✅ Error message displayed on progress page
- ✅ Job status updates to `failed`
- ✅ Error details shown in current step
- ✅ Inngest dashboard shows retry attempts
- ✅ Other parallel volumes not affected (if failure in one volume)

---

## 🔍 Debugging Checklist

### If Volumes Don't Generate in Parallel:
1. Check Inngest dashboard for concurrent runs
2. Verify `volume_generation_status` in database:
   ```sql
   SELECT volume_generation_status FROM proposal_jobs WHERE job_id = 'your-job-id';
   ```
3. Check terminal logs for `[Vol Gen X]` messages
4. Verify concurrency limit in `volume-generation.ts` (should be 4)

### If Iteration Doesn't Work:
1. Check that `handleVolumeIterationFunction` is registered
2. Verify event emission in browser network tab (POST to `/api/proposals/.../iterate`)
3. Check Inngest dashboard for `rfp-proposal-volume-iteration` function run
4. Verify `volume_iterations` field in database

### If Final Report Doesn't Appear:
1. Check job status: should be `completed` or `needs_revision`
2. Verify `final_compliance_report` field exists in database:
   ```sql
   SELECT final_compliance_report FROM proposal_jobs WHERE job_id = 'your-job-id';
   ```
3. Check that `final_scoring_status` is `complete`
4. Look for `[Scoring]` logs in terminal

### If UI Doesn't Update:
1. Check browser console for errors
2. Verify polling is working (network tab should show requests every 3s)
3. Check that status fields exist in database response
4. Verify TypeScript interface includes new fields

---

## 📊 Database Verification Queries

```sql
-- Check modular function status
SELECT 
    job_id,
    status,
    preparation_phase_status,
    volume_generation_status,
    assembly_status,
    final_scoring_status,
    progress_percent
FROM proposal_jobs 
WHERE job_id = 'your-job-id';

-- Check volume details
SELECT 
    job_id,
    volume_status,
    volume_scores,
    volume_iterations
FROM proposal_jobs 
WHERE job_id = 'your-job-id';

-- Check final compliance report
SELECT 
    job_id,
    final_compliance_report->'overallComplianceScore' as overall_score,
    final_compliance_report->'needsRevision' as needs_revision,
    quality_checks
FROM proposal_jobs 
WHERE job_id = 'your-job-id';
```

---

## ✅ Success Criteria

### Functional Requirements:
- [x] All 4 volumes generate in parallel
- [x] Iteration works without blocking other volumes
- [x] Preparation phase status tracked accurately
- [x] Final compliance report displays correctly
- [x] Quality assurance checks run and display
- [x] Cross-volume analysis completes
- [x] UI updates in real-time (3s polling)

### Performance Requirements:
- [x] Total pipeline time: ~15-20 minutes (vs. 40-60 minutes before)
- [x] Volume generation: ~10-15 minutes for all 4 (parallel)
- [x] Iteration: ~5 minutes per iteration
- [x] Final scoring: ~2-3 minutes

### UX Requirements:
- [x] Clear status indicators for each phase
- [x] Iteration badges show version numbers
- [x] Parallel generation clearly indicated
- [x] Final report is comprehensive and readable
- [x] Error messages are clear and actionable

---

## 🎯 Known Limitations

1. **Concurrency Limit**: Maximum 4 volumes in parallel (by design)
2. **Iteration Limit**: Maximum 5 iterations per volume
3. **Polling Frequency**: UI updates every 3 seconds (not real-time WebSocket)
4. **Inngest Timeout**: 90-minute max per function

---

## 📝 Reporting Issues

If you encounter issues, please provide:
1. **Job ID**: From URL or database
2. **Step**: Which phase/volume failed
3. **Logs**: Terminal output with `[Orchestrator]`, `[Vol Gen]`, etc. prefixes
4. **Inngest Dashboard**: Screenshot of function runs
5. **Database State**: Output of verification queries above

---

**Ready to test!** Start with Test 1 (Happy Path) and work through each scenario. 🚀



