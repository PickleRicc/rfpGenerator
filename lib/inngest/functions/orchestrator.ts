/**
 * Main Orchestrator Function - Event Coordination Only
 * 
 * Simplified orchestrator that coordinates the modular pipeline:
 * 1. Trigger preparation phase
 * 2. Wait for preparation complete
 * 3. Trigger parallel volume generation (4 volumes)
 * 4. Wait for all volumes generated
 * 5. Trigger consultant service for each volume (with iteration support)
 * 6. Wait for all volumes approved
 * 7. Trigger final assembly
 * 8. Trigger final scoring
 * 9. Complete
 * 
 * Triggered by: proposal/generate.requested
 * Emits: Various events to modular functions
 */

import { inngest, MAX_JOB_DURATION_MINUTES } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { clearContextCache } from '../../agents/agent-4-writer/shared-context'
import { updateJobStatus, updateVolumeStatus } from '../db-helpers'

// ============================================================================
// MAIN ORCHESTRATOR FUNCTION
// ============================================================================

export const generateProposalOrchestratorFunction = inngest.createFunction(
    {
        id: 'generate-proposal-orchestrator',
        name: 'Proposal Generation Orchestrator',
        timeouts: {
            finish: `${MAX_JOB_DURATION_MINUTES}m`,
        },
        retries: 2,
        cancelOn: [
            {
                event: 'proposal/generate.cancelled',
                match: 'data.jobId',
            },
        ],
        // Prevent duplicate executions for the same job
        idempotency: 'event.data.jobId',
    },
    { event: 'proposal/generate.requested' },
    async ({ event, step }) => {
        const { jobId, rfpText, companyId } = event.data
        const startTime = Date.now()

        logger.pipelineStart(jobId, companyId)

        try {
            // Check if this job has already made progress (idempotency check)
            const existingJob = await step.run('check-existing-job', async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data } = await (supabase.from('proposal_jobs') as any)
                    .select('progress_percent, status')
                    .eq('job_id', jobId)
                    .single()
                
                return data
            })

            if (existingJob?.progress_percent > 0 && existingJob?.status !== 'queued') {
                logger.info('[Orchestrator] Job already in progress, skipping duplicate execution', {
                    data: { jobId, progress: existingJob.progress_percent, status: existingJob.status }
                })
                return {
                    status: 'duplicate',
                    message: 'Job already in progress'
                }
            }

            // ================================================================
            // PHASE 1: PREPARATION
            // ================================================================

            logger.info('[Orchestrator] Phase 1: Triggering preparation', { data: { jobId } })

            await step.sendEvent('trigger-preparation', {
                name: 'proposal/preparation.start',
                data: {
                    jobId,
                    rfpText,
                    companyId
                }
            })

            const prepComplete = await step.waitForEvent('wait-prep-complete', {
                event: 'proposal/preparation.complete',
                timeout: '30m',
                if: `async.data.jobId == '${jobId}'`,
            })

            if (!prepComplete) {
                logger.error('[Orchestrator] Preparation phase timed out - FAILING JOB', { data: { jobId } })
                await updateJobStatus(jobId, 'failed', {
                    current_step: 'Preparation phase timed out after 30 minutes'
                })
                throw new Error('Preparation phase timed out')
            }

            // ✅ Check if preparation succeeded
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const prepData = prepComplete as any
            if (prepData.data?.success === false) {
                logger.error('[Orchestrator] Preparation phase failed - FAILING JOB', { 
                    data: { jobId, error: prepData.data?.error } 
                })
                throw new Error(`Preparation failed: ${prepData.data?.error}`)
            }

            logger.info('[Orchestrator] Preparation complete', { data: { jobId } })

            // ================================================================
            // PHASE 2: PARALLEL VOLUME GENERATION
            // ================================================================

            logger.info('[Orchestrator] Phase 2: Triggering parallel volume generation', { data: { jobId } })

            const volumes = [
                { id: 1, name: 'Technical', progressStart: 30, progressEnd: 50 },
                { id: 2, name: 'Management', progressStart: 50, progressEnd: 60 },
                { id: 3, name: 'Past Performance', progressStart: 60, progressEnd: 70 },
                { id: 4, name: 'Pricing', progressStart: 70, progressEnd: 80 }
            ]

            // ================================================================
            // PHASE 2b & 3: PARALLEL GENERATION + SEQUENTIAL CONSULTATION
            // ================================================================
            
            logger.info('[Orchestrator] Phase 2b-3: Parallel generation with immediate consultation', { data: { jobId } })

            // Trigger all volume generations in parallel
            for (const volume of volumes) {
                await step.sendEvent(`trigger-volume-${volume.id}`, {
                    name: 'proposal/volume.generate',
                    data: {
                        jobId,
                        volume: volume.id,
                        volumeName: volume.name,
                        progressStart: volume.progressStart,
                        progressEnd: volume.progressEnd
                    }
                })
            }

            // ================================================================
            // STEP 1: Wait for ALL volume approvals (user manually triggers scoring)
            // ================================================================
            
            logger.info('[Orchestrator] Volumes generating in parallel - user will manually trigger scoring', { 
                data: { jobId, volumeCount: volumes.length } 
            })

            logger.info('[Orchestrator] Waiting for all volume approvals (polling database)', { 
                data: { jobId, volumes: volumes.map(v => v.id) } 
            })

            // ✅ Poll database to check which volumes are approved (supports any order)
            await step.run('wait-all-approvals', async () => {
                const maxWaitTime = 72 * 60 * 60 * 1000 // 72 hours
                const pollInterval = 10000 // 10 seconds
                const startTime = Date.now()
                const approved = new Set<number>()

                while (approved.size < volumes.length) {
                    // Check if we've exceeded max wait time
                    if (Date.now() - startTime > maxWaitTime) {
                        logger.warn('[Orchestrator] 72h timeout - proceeding with approved volumes', {
                            data: { jobId, approved: approved.size, total: volumes.length }
                        })
                        break
                    }

                    // Check database for approved volumes
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: job } = await (supabase.from('proposal_jobs') as any)
                        .select('volume_status')
                        .eq('job_id', jobId)
                        .single()

                    if (job?.volume_status) {
                        for (const volume of volumes) {
                            const volumeKey = `volume${volume.id}`
                            const status = job.volume_status[volumeKey]
                            if ((status === 'approved' || status === 'complete') && !approved.has(volume.id)) {
                                approved.add(volume.id)
                                logger.info(`[Orchestrator] Volume ${volume.id} approved`, {
                                    data: { jobId, volume: volume.id, count: approved.size, total: volumes.length }
                                })
                            }
                        }
                    }

                    // If all approved, break
                    if (approved.size >= volumes.length) {
                        logger.info('[Orchestrator] All volumes approved!', {
                            data: { jobId, count: approved.size }
                        })
                        break
                    }

                    // Wait before next poll
                    await new Promise(resolve => setTimeout(resolve, pollInterval))
                }

                return Array.from(approved)
            })

            logger.info('[Orchestrator] Proceeding to final assembly', { data: { jobId } })

            // ================================================================
            // PHASE 4: FINAL ASSEMBLY
            // ================================================================

            logger.info('[Orchestrator] Phase 4: Triggering final assembly', { data: { jobId } })

            await step.sendEvent('trigger-assembly', {
                name: 'proposal/assembly.start',
                data: { jobId }
            })

            const assemblyComplete = await step.waitForEvent('wait-assembly-complete', {
                event: 'proposal/assembly.complete',
                timeout: '15m',
                if: `async.data.jobId == '${jobId}'`,
            })

            // ✅ STALEMATE PREVENTION: Continue even if assembly fails
            if (!assemblyComplete) {
                logger.warn('[Orchestrator] Final assembly timed out - SKIPPING TO COMPLETION', { data: { jobId } })
                await updateJobStatus(jobId, 'completed', {
                    current_step: 'Completed with assembly timeout',
                    assembly_status: 'failed'
                })
                // Skip to completion instead of failing
            } else {
                logger.info('[Orchestrator] Final assembly complete', { data: { jobId } })

                // ================================================================
                // PHASE 5: FINAL SCORING
                // ================================================================

                logger.info('[Orchestrator] Phase 5: Triggering final scoring', { data: { jobId } })

                await step.sendEvent('trigger-scoring', {
                    name: 'proposal/scoring.start',
                    data: { jobId }
                })

                const scoringComplete = await step.waitForEvent('wait-scoring-complete', {
                    event: 'proposal/scoring.complete',
                    timeout: '10m',
                    if: `async.data.jobId == '${jobId}'`,
                })

                // ✅ STALEMATE PREVENTION: Complete job even if scoring fails
                if (!scoringComplete) {
                    logger.warn('[Orchestrator] Final scoring timed out - MARKING AS COMPLETED', { data: { jobId } })
                    await updateJobStatus(jobId, 'completed', {
                        current_step: 'Completed with scoring timeout',
                        final_scoring_status: 'failed'
                    })
                } else {
                    logger.info('[Orchestrator] Final scoring complete', { data: { jobId } })
                }
            }

            // ================================================================
            // COMPLETION
            // ================================================================

            const duration = Math.round((Date.now() - startTime) / 1000 / 60)
            logger.pipelineComplete(jobId, duration)

            // Clear context cache to free memory
            clearContextCache()
            logger.info('[Orchestrator] Context cache cleared after job completion', { jobId })

            return {
                status: 'completed',
                jobId,
                duration: `${duration} minutes`
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.pipelineFailed(jobId, errorMessage)

            await updateJobStatus(jobId, 'failed', {
                current_step: `Error: ${errorMessage}`
            })

            // Clear context cache even on error to prevent memory leaks
            try {
                clearContextCache()
                logger.info('[Orchestrator] Context cache cleared after error', { jobId })
            } catch (cacheError) {
                logger.error('[Orchestrator] Failed to clear context cache', {
                    data: { error: cacheError instanceof Error ? cacheError.message : String(cacheError) }
                })
            }

            throw error
        }
    }
)

