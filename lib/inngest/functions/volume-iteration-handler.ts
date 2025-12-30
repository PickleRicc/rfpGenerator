/**
 * Volume Iteration Handler - Dedicated Function
 * 
 * Handles user-requested iterations on volumes
 * Executes rewriter agent and re-scores the volume
 * Works seamlessly with parallel pipeline
 * 
 * Triggered by: proposal/volume.iterate
 * Emits: proposal/volume.iteration.complete
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { AgentContext, NormalizedCompanyData, agent5 } from '../../agents'
import { agentRewriter } from '../../agents/agent-rewriter'
import {
    updateVolumeStatus,
    updateVolumeIteration,
    updateJobStatus,
    updateVolumeScore,
    storeVolumeComplianceDetails,
    batchSaveVolumes,
} from '../db-helpers'

// Helper to fetch company data
async function fetchCompanyData(companyId: string): Promise<NormalizedCompanyData> {
    logger.info('Fetching company data from database', { data: { companyId } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [companyResult, ppResult, personnelResult, ratesResult] = await Promise.all([
        (supabase.from('companies') as any).select('*').eq('id', companyId).single(),
        (supabase.from('past_performance') as any).select('*').eq('company_id', companyId),
        (supabase.from('personnel') as any).select('*').eq('company_id', companyId),
        (supabase.from('labor_rates') as any).select('*').eq('company_id', companyId),
    ])

    if (companyResult.error || !companyResult.data) {
        throw new Error(`Company not found: ${companyResult.error?.message}`)
    }

    const data = {
        company: companyResult.data,
        pastPerformance: ppResult.data || [],
        personnel: personnelResult.data || [],
        laborRates: ratesResult.data || [],
    }

    return data
}

/**
 * Dedicated function for handling volume iterations
 * Triggered when user requests changes to a volume
 * Executes rewriter agent and re-scores the volume
 */
export const handleVolumeIterationFunction = inngest.createFunction(
    {
        id: 'rfp-proposal-volume-iteration',
        name: 'Handle Volume Iteration',
        retries: 2,
    },
    { event: 'proposal/volume.iterate' },
    async ({ event, step }) => {
        const { jobId, volume, userFeedback, currentScore, iteration } = event.data

        logger.info(`[Iteration] Starting Volume ${volume} iteration ${iteration + 1}`, {
            data: { jobId, volume, iteration: iteration + 1, feedbackLength: userFeedback.length }
        })

        try {
            // ================================================================
            // STEP 1: Fetch context and validate
            // ================================================================
            const context = await step.run('fetch-context', async () => {
                logger.info(`[Iteration] Fetching job context`, { data: { jobId, volume } })

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: job, error } = await (supabase.from('proposal_jobs') as any)
                    .select('*')
                    .eq('job_id', jobId)
                    .single()

                if (error || !job) {
                    throw new Error(`Job not found: ${jobId}`)
                }

                // Fetch company data
                const companyData = await fetchCompanyData(job.company_id)

                // Build context
                const agentContext: AgentContext = {
                    jobId,
                    companyId: job.company_id,
                    rfpText: job.rfp_text,
                    rfpParsedData: job.rfp_parsed_data,
                    companyData,
                    volumePageLimits: job.volume_page_limits,
                    volumes: job.volumes || {}
                }

                return agentContext
            })

            // ================================================================
            // STEP 2: Update job status
            // ================================================================
            await step.run('update-status-iterating', async () => {
                await updateVolumeStatus(jobId, volume, 'iterating')
                await updateVolumeIteration(jobId, volume, iteration + 1)
                await updateJobStatus(jobId, 'processing', {
                    current_step: `Rewriting Volume ${volume} based on feedback (Iteration ${iteration + 1})`,
                    current_volume: volume
                })
            })

            // ================================================================
            // STEP 3: Execute rewriter agent
            // ================================================================
            const rewriteResult = await step.run('rewrite-volume', async () => {
                logger.info(`[Iteration] Rewriting Volume ${volume}`, {
                    data: { jobId, volume, iteration: iteration + 1 }
                })

                const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                const originalContent = context.volumes?.[volumeKey] || ''

                if (!originalContent) {
                    throw new Error(`No original content found for Volume ${volume}`)
                }

                // Get consultant insights from database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: jobData } = await (supabase.from('proposal_jobs') as any)
                    .select('current_volume_insights')
                    .eq('job_id', jobId)
                    .single()

                const consultantInsights = jobData?.current_volume_insights

                if (!consultantInsights) {
                    throw new Error(`Missing consultant insights for Volume ${volume}`)
                }

                // Execute rewriter
                const result = await agentRewriter.execute(context, {
                    volume,
                    originalContent,
                    consultantInsights,
                    userFeedback,
                    rfpRequirements: JSON.stringify(context.rfpParsedData?.section_c.requirements || []),
                    iteration: iteration + 1,
                    pageLimits: {
                        maxPages: context.volumePageLimits?.[`volume_${volume}_technical` as keyof typeof context.volumePageLimits] || 50,
                        currentPages: Math.ceil(originalContent.length / 3000)
                    }
                })

                if (result.status === 'error') {
                    throw new Error(`Volume ${volume} rewrite failed: ${result.errors?.join(', ')}`)
                }

                return result.data
            })

            // ================================================================
            // STEP 4: Save rewritten content
            // ================================================================
            await step.run('save-rewritten-content', async () => {
                const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                const rewrittenContent = rewriteResult.rewrittenContent

                if (!rewrittenContent) {
                    throw new Error(`Rewriter did not produce content for Volume ${volume}`)
                }

                logger.info(`[Iteration] Saving rewritten Volume ${volume}`, {
                    data: {
                        jobId,
                        volume,
                        contentSizeKB: Math.round(rewrittenContent.length / 1024)
                    }
                })

                await batchSaveVolumes(jobId, { [volumeKey]: rewrittenContent }, 1)

                // Update context in database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
                    .select('volumes')
                    .eq('job_id', jobId)
                    .single()

                const updatedVolumes = {
                    ...currentJob?.volumes,
                    [volumeKey]: rewrittenContent
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        volumes: updatedVolumes,
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)
            })

            // ================================================================
            // STEP 5: Re-score the volume
            // ================================================================
            const newScore = await step.run('rescore-volume', async () => {
                logger.info(`[Iteration] Re-scoring Volume ${volume}`, {
                    data: { jobId, volume }
                })

                await updateVolumeStatus(jobId, volume, 'scoring')

                const result = await agent5.execute(context)

                if (result.status === 'error') {
                    throw new Error(`Volume ${volume} re-scoring failed: ${result.errors?.join(', ')}`)
                }

                if (typeof result.data?.overallScore !== 'number' || result.data.overallScore < 0 || result.data.overallScore > 100) {
                    throw new Error(`Volume ${volume} re-scoring produced invalid score: ${result.data?.overallScore}`)
                }

                await updateVolumeScore(jobId, volume, result.data.overallScore)
                await storeVolumeComplianceDetails(jobId, volume, {
                    requirementScores: result.data.requirementScores || [],
                    strengths: result.data.strengths || [],
                    criticalGaps: result.data.criticalGaps || [],
                    overallScore: result.data.overallScore
                })

                logger.info(`[Iteration] Volume ${volume} re-scored: ${result.data.overallScore}% (was ${currentScore}%)`, {
                    data: { jobId, volume, newScore: result.data.overallScore, oldScore: currentScore }
                })

                return result.data.overallScore
            })

            // ================================================================
            // STEP 6: Update status and emit completion
            // ================================================================
            await step.run('complete-iteration', async () => {
                await updateVolumeStatus(jobId, volume, 'awaiting_approval')
                await updateJobStatus(jobId, 'review', {
                    current_step: `Volume ${volume} iteration ${iteration + 1} complete - awaiting approval`,
                    current_volume: volume
                })
            })

            const improvement = newScore - currentScore

            logger.info(`[Iteration] Volume ${volume} iteration complete`, {
                data: { jobId, volume, iteration: iteration + 1, newScore, improvement }
            })

            // Emit completion event for orchestrator
            await step.sendEvent('emit-iteration-complete', {
                name: 'proposal/volume.iteration.complete',
                data: {
                    jobId,
                    volume,
                    iteration: iteration + 1,
                    newScore,
                    improvement
                }
            })

            return {
                success: true,
                volume,
                iteration: iteration + 1,
                newScore,
                improvement
            }

        } catch (error) {
            logger.error(`[Iteration] Volume ${volume} iteration failed`, {
                data: {
                    jobId,
                    volume,
                    iteration: iteration + 1,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            await updateVolumeStatus(jobId, volume, 'blocked')
            await updateJobStatus(jobId, 'failed', {
                current_step: `Volume ${volume} iteration failed`,
                error_message: error instanceof Error ? error.message : String(error)
            })

            throw error
        }
    }
)



