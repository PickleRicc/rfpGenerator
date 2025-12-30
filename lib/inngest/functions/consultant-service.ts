/**
 * Consultant Service Function - Modular Inngest Function
 * 
 * Executes Agent 5 (Compliance Scorer) and Agent 6 (Consultant)
 * Waits for user decision (approve/iterate)
 * Delegates iteration to handleVolumeIterationFunction
 * 
 * Triggered by: proposal/volume.consult
 * Emits: proposal/volume.consulted, proposal/volume.iterate (if needed)
 * Waits for: proposal/volume.approved or proposal/volume.iteration.complete
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { agent5, AgentContext } from '../../agents'
import { agentConsultant } from '../../agents/agent-consultant'
import {
    updateJobStatus,
    updateVolumeStatus,
    updateVolumeScore,
    updateVolumeInsights,
    setAwaitingApproval,
    storeVolumeComplianceDetails,
    storeUserFeedback
} from '../db-helpers'

// ============================================================================
// CONSULTANT SERVICE FUNCTION
// ============================================================================

export const consultantServiceFunction = inngest.createFunction(
    {
        id: 'consultant-service',
        name: 'Consultant Service (Scoring & Analysis)',
        retries: 2,
    },
    { event: 'proposal/volume.consult' },
    async ({ event, step }) => {
        const { jobId, volume, volumeName, iteration = 1 } = event.data

        logger.info(`[Consultant ${volume}] Starting consultation and scoring`, {
            data: { jobId, volume, volumeName, iteration }
        })

        try {
            // Load context from database
            const context = await step.run('load-context', async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: job } = await (supabase.from('proposal_jobs') as any)
                    .select('*')
                    .eq('job_id', jobId)
                    .single()

                if (!job) {
                    throw new Error(`Job ${jobId} not found`)
                }

                const agentContext: AgentContext = {
                    jobId,
                    companyId: job.company_id,
                    rfpText: job.rfp_text,
                    rfpParsedData: job.rfp_parsed_data,
                    companyData: job.company_data,
                    volumePageLimits: job.volume_page_limits,
                    contentOutlines: job.content_outlines,
                    validationReport: job.validation_report,
                    volumes: job.volumes || {},
                    targetVolume: volume
                }

                return agentContext
            })

            // ================================================================
            // AGENT 5: Compliance Scoring
            // ================================================================

            await updateVolumeStatus(jobId, volume, 'scoring')
            await updateJobStatus(jobId, 'processing', {
                current_step: `Scoring Volume ${volume}: ${volumeName}`,
                current_volume: volume
            })

            const scoreResult = await step.run('score-volume', async () => {
                logger.info(`[Consultant ${volume}] Executing Agent 5 (Compliance Scorer)`, {
                    data: { jobId, volume }
                })

                const result = await agent5.execute(context)

                if (result.status === 'error') {
                    logger.error(`[Consultant ${volume}] Scoring failed`, {
                        data: { jobId, volume, errors: result.errors }
                    })
                    throw new Error(`Volume ${volume} scoring failed: ${result.errors?.join(', ')}`)
                }

                // Validate scoring result
                if (typeof result.data?.overallScore !== 'number' || result.data.overallScore < 0 || result.data.overallScore > 100) {
                    throw new Error(`Volume ${volume} scoring produced invalid score: ${result.data?.overallScore}`)
                }

                return result.data
            })

            // Store score and compliance details
            await updateVolumeScore(jobId, volume, scoreResult.overallScore)
            await storeVolumeComplianceDetails(jobId, volume, {
                requirementScores: scoreResult.requirementScores || [],
                strengths: scoreResult.strengths || [],
                criticalGaps: scoreResult.criticalGaps || [],
                overallScore: scoreResult.overallScore
            })

            logger.info(`[Consultant ${volume}] Volume scored: ${scoreResult.overallScore}%`, {
                data: { jobId, volume, score: scoreResult.overallScore }
            })

            // ================================================================
            // AGENT 6: Consultant (Only if score < 80%)
            // ================================================================

            let consultantInsights = null
            if (scoreResult.overallScore < 80) {
                consultantInsights = await step.run('consult-volume', async () => {
                    logger.info(`[Consultant ${volume}] Executing Agent 6 (Consultant) - score below 80%`, {
                        data: { jobId, volume, score: scoreResult.overallScore }
                    })

                    const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                    const result = await agentConsultant.execute(context, {
                        volume,
                        volumeContent: context.volumes?.[volumeKey] || '',
                        scoreResult: {
                            overallScore: scoreResult.overallScore,
                            requirementScores: scoreResult.requirementScores || [],
                            strengths: scoreResult.strengths || [],
                            criticalGaps: scoreResult.criticalGaps || []
                        },
                        rfpRequirements: JSON.stringify(context.rfpParsedData?.section_c.requirements || []).substring(0, 10000),
                        iteration
                    })

                    if (result.status === 'error') {
                        logger.warn(`[Consultant ${volume}] Consultant analysis failed, continuing`, {
                            data: { jobId, volume, error: result.errors }
                        })
                        return null
                    }

                    return result.data
                })

                if (consultantInsights) {
                    await updateVolumeInsights(jobId, volume, consultantInsights)
                }
            }

            // ================================================================
            // WAIT FOR USER DECISION
            // ================================================================

            await updateVolumeStatus(jobId, volume, 'awaiting_approval')
            await setAwaitingApproval(jobId, volume, true)
            await updateJobStatus(jobId, 'review', {
                current_step: `Review Volume ${volume}: ${volumeName}`,
                current_volume: volume
            })

            logger.info(`[Consultant ${volume}] Waiting for user decision`, {
                data: { jobId, volume, iteration, score: scoreResult.overallScore }
            })

            const MAX_ITERATIONS = 5

            const userDecision = await step.waitForEvent(`volume-${volume}-decision-${iteration}`, {
                event: 'proposal/volume.decision',
                timeout: '7d',
                if: `async.data.jobId == '${jobId}' && async.data.volume == ${volume}`,
            })

            await setAwaitingApproval(jobId, volume, false)

            // ================================================================
            // HANDLE USER DECISION
            // ================================================================

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decision = (userDecision as any)?.data?.decision

            if (decision === 'approved') {
                // Volume approved - mark complete
                await updateVolumeStatus(jobId, volume, 'approved')
                logger.info(`[Consultant ${volume}] Volume approved by user`, {
                    data: { jobId, volume, finalScore: scoreResult.overallScore }
                })

                // Emit approval confirmation
                await step.sendEvent('emit-volume-approved', {
                    name: 'proposal/volume.consulted',
                    data: {
                        jobId,
                        volume,
                        volumeName,
                        decision: 'approved',
                        finalScore: scoreResult.overallScore
                    }
                })

                return {
                    success: true,
                    volume,
                    volumeName,
                    decision: 'approved',
                    finalScore: scoreResult.overallScore
                }

            } else if (decision === 'iterate') {
                // Iteration requested - check if we've reached max iterations
                if (iteration >= MAX_ITERATIONS) {
                    await updateJobStatus(jobId, 'blocked', {
                        current_step: `Volume ${volume} reached max iterations (${MAX_ITERATIONS}) - manual review required`
                    })
                    
                    logger.warn(`[Consultant ${volume}] Max iterations reached`, {
                        data: { jobId, volume, iteration: MAX_ITERATIONS }
                    })

                    return {
                        success: false,
                        volume,
                        volumeName,
                        decision: 'max_iterations_reached',
                        message: `Volume ${volume} reached maximum iterations`
                    }
                }

                // Store feedback for tracking
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const feedback = (userDecision as any)?.data?.userFeedback || ''
                await storeUserFeedback(jobId, volume, iteration, feedback)

                logger.info(`[Consultant ${volume}] Iteration requested - delegating to iteration handler`, {
                    data: { jobId, volume, iteration: iteration + 1, feedbackLength: feedback.length }
                })

                // Trigger iteration handler via event (it's already registered as a separate function)
                // The iteration handler will emit proposal/volume.iteration.complete when done
                
                // Wait for iteration to complete
                const iterationComplete = await step.waitForEvent(`volume-${volume}-iteration-complete-${iteration}`, {
                    event: 'proposal/volume.iteration.complete',
                    timeout: '2h',
                    if: `async.data.jobId == '${jobId}' && async.data.volume == ${volume}`,
                })

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const completeData = iterationComplete as any
                logger.info(`[Consultant ${volume}] Iteration complete`, {
                    data: {
                        jobId,
                        volume,
                        iteration: completeData.data?.iteration,
                        newScore: completeData.data?.newScore,
                        improvement: completeData.data?.improvement
                    }
                })

                // After iteration, trigger another consultation cycle with the updated content
                await step.sendEvent('emit-reconsult', {
                    name: 'proposal/volume.consult',
                    data: {
                        jobId,
                        volume,
                        volumeName,
                        iteration: iteration + 1
                    }
                })

                return {
                    success: true,
                    volume,
                    volumeName,
                    decision: 'iterated',
                    newIteration: iteration + 1,
                    newScore: completeData.data?.newScore
                }
            }

            // Shouldn't reach here, but handle gracefully
            logger.warn(`[Consultant ${volume}] Unexpected user decision`, {
                data: { jobId, volume, decision: userDecision?.name }
            })

            return {
                success: false,
                volume,
                volumeName,
                decision: 'unknown',
                message: 'Unexpected user decision'
            }

        } catch (error) {
            logger.error(`[Consultant ${volume}] Consultation failed`, {
                data: {
                    jobId,
                    volume,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            await updateVolumeStatus(jobId, volume, 'blocked')
            await updateJobStatus(jobId, 'failed', {
                current_step: `Volume ${volume} consultation failed`,
                error_message: error instanceof Error ? error.message : String(error)
            })

            // ✅ CRITICAL: Emit event even on failure so orchestrator can skip this volume
            await step.sendEvent('emit-consultation-failed', {
                name: 'proposal/volume.consulted',
                data: {
                    jobId,
                    volume,
                    volumeName,
                    decision: 'failed',
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            throw error
        }
    }
)

