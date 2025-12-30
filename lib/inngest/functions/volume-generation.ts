/**
 * Volume Generation Function - Modular Inngest Function
 * 
 * Executes Agent 4 (Writer) for a single volume
 * Designed to run in parallel (4 instances simultaneously)
 * 
 * Triggered by: proposal/volume.generate
 * Emits: proposal/volume.generated
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { agent4, AgentContext } from '../../agents'
import { updateJobStatus, updateVolumeStatus, updateVolumeIteration, batchSaveVolumes } from '../db-helpers'

// ============================================================================
// PROGRESS HELPER
// ============================================================================

async function updateProgress(
    jobId: string,
    progress: number,
    step: string,
    currentAgent?: string
): Promise<void> {
    try {
        const updateData: {
            progress_percent: number
            current_step: string
            current_agent?: string
            updated_at: string
        } = {
            progress_percent: Math.round(progress),
            current_step: step,
            updated_at: new Date().toISOString(),
        }

        if (currentAgent) {
            updateData.current_agent = currentAgent
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('proposal_jobs') as any)
            .update(updateData)
            .eq('job_id', jobId)

        if (updateError) {
            logger.error(`[updateProgress] Database update failed: ${updateError.message}`, { 
                jobId, 
                data: { progress, step }
            })
        }
    } catch (error) {
        logger.error(`[updateProgress] Unexpected error: ${error instanceof Error ? error.message : String(error)}`, { jobId })
    }
}

async function updateVolumeSectionProgress(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    sectionProgress: Record<string, { status: string; progress: number }>
): Promise<void> {
    try {
        // Fetch current volume_section_progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('volume_section_progress')
            .eq('job_id', jobId)
            .single()

        const allProgress = currentJob?.volume_section_progress || {}
        allProgress[`volume${volume}`] = sectionProgress

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                volume_section_progress: allProgress,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)
    } catch (error) {
        logger.error('[updateVolumeSectionProgress] Failed to update section progress', {
            data: { jobId, volume, error: error instanceof Error ? error.message : String(error) }
        })
    }
}

// ============================================================================
// VOLUME GENERATION FUNCTION
// ============================================================================

export const volumeGenerationFunction = inngest.createFunction(
    {
        id: 'volume-generation',
        name: 'Volume Generation (Agent 4)',
        retries: 2,
        concurrency: {
            limit: 4, // Allow 4 volumes to generate in parallel
        }
    },
    { event: 'proposal/volume.generate' },
    async ({ event, step }) => {
        const { jobId, volume, volumeName, progressStart, progressEnd } = event.data

        logger.info(`[Vol Gen ${volume}] Starting volume generation`, { 
            data: { jobId, volume, volumeName } 
        })

        try {
            // Mark volume as generating
            await updateVolumeStatus(jobId, volume, 'generating')
            await updateVolumeIteration(jobId, volume, 1)

            // Update job status
            await updateJobStatus(jobId, 'processing', {
                current_step: `Generating Volume ${volume}: ${volumeName}`,
                current_volume: volume
            })

            // Update volume generation status in database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
                .select('volume_generation_status')
                .eq('job_id', jobId)
                .single()

            const volumeGenStatus = currentJob?.volume_generation_status || {}
            volumeGenStatus[`volume${volume}`] = 'generating'

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    volume_generation_status: volumeGenStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', jobId)

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

            // Generate volume with Agent 4
            const volumeResult = await step.run('generate-volume', async () => {
                logger.info(`[Vol Gen ${volume}] Executing Agent 4`, { data: { jobId, volume } })

                // Create progress callback for real-time section updates
                const volumeProgressCallback = async (progress: number, stepDesc: string, sectionProgress?: Record<string, { status: string; progress: number }>) => {
                    const overallProgress = Math.round(
                        progressStart + ((progressEnd - progressStart) * progress / 100)
                    )
                    await updateProgress(jobId, overallProgress, `Vol ${volume}: ${stepDesc}`, `agent_4_volume_${volume}`)

                    // Update section-level progress if provided
                    if (sectionProgress) {
                        await updateVolumeSectionProgress(jobId, volume, sectionProgress)
                    }
                }

                const result = await agent4.execute(context, volume, volumeProgressCallback)

                if (result.status === 'error') {
                    throw new Error(`Volume ${volume} generation failed: ${result.errors?.join(', ')}`)
                }

                // Validate that volume was actually generated
                const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                if (!result.data?.volumes?.[volumeKey]?.content) {
                    throw new Error(`Volume ${volume} generation completed but no content was produced`)
                }

                return result.data
            })

            // Save volume to database
            await step.run('save-volume', async () => {
                const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                const volumeContent = volumeResult.volumes[volumeKey]?.content || ''

                if (!volumeContent) {
                    throw new Error(`Cannot save Volume ${volume} - no content generated`)
                }

                const volumeSizeKB = Math.round(volumeContent.length / 1024)
                logger.info(`[Vol Gen ${volume}] Saving volume to database (${volumeSizeKB} KB)`, {
                    data: { jobId, volume, sizeKB: volumeSizeKB }
                })

                await batchSaveVolumes(jobId, { [volumeKey]: volumeContent }, 1)

                logger.info(`[Vol Gen ${volume}] Volume saved successfully`, { data: { jobId, volume } })
            })

            // Update volume generation status to complete
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: updatedJob } = await (supabase.from('proposal_jobs') as any)
                .select('volume_generation_status')
                .eq('job_id', jobId)
                .single()

            const updatedGenStatus = updatedJob?.volume_generation_status || {}
            updatedGenStatus[`volume${volume}`] = 'complete'

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    volume_generation_status: updatedGenStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', jobId)

            logger.info(`[Vol Gen ${volume}] Volume generation complete`, { data: { jobId, volume } })

            // Mark volume as ready for scoring (user will trigger manually)
            await updateVolumeStatus(jobId, volume, 'ready_for_scoring')

            // Emit completion event
            await step.sendEvent('emit-volume-generated', {
                name: 'proposal/volume.generated',
                data: {
                    jobId,
                    volume,
                    volumeName,
                    success: true,
                }
            })

            logger.info(`[Vol Gen ${volume}] Ready for manual scoring trigger`, { 
                data: { jobId, volume } 
            })

            return {
                success: true,
                volume,
                volumeName,
                message: `Volume ${volume} generated successfully`
            }

        } catch (error) {
            logger.error(`[Vol Gen ${volume}] Volume generation failed`, {
                data: {
                    jobId,
                    volume,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            // Update volume status to failed
            await updateVolumeStatus(jobId, volume, 'blocked')

            // Update volume generation status
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
                .select('volume_generation_status')
                .eq('job_id', jobId)
                .single()

            const volumeGenStatus = currentJob?.volume_generation_status || {}
            volumeGenStatus[`volume${volume}`] = 'failed'

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    volume_generation_status: volumeGenStatus,
                    error_message: error instanceof Error ? error.message : String(error),
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', jobId)

            // ✅ CRITICAL: Emit event even on failure so orchestrator can progress
            await step.sendEvent('emit-volume-failed', {
                name: 'proposal/volume.generated',
                data: {
                    jobId,
                    volume,
                    volumeName,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            throw error
        }
    }
)

