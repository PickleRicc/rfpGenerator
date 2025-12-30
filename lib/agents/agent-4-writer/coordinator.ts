/**
 * Agent 4: Master Writing Coordinator
 * 
 * PRIMARY MISSION: Orchestrate 4 sub-agents to write volumes in parallel,
 * ensuring consistency and quality.
 * 
 * RESPONSIBILITIES:
 * 1. Coordinate sub-agents 4A, 4B, 4C, 4D (one per volume)
 * 2. Ensure consistent voice across volumes
 * 3. Monitor page counts in real-time
 * 4. Prevent hallucinations and generic content
 */

import { supabase } from '../../supabase'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent4Output,
    VolumeWriteResult,
} from '../types'
import { writeVolume1Technical, ProgressCallback } from './agent-4a-technical'
import { writeVolume2Management } from './agent-4b-management'
import { writeVolume3PastPerformance } from './agent-4c-past-performance'
import { writeVolume4Pricing } from './agent-4d-pricing'

export class Agent4Coordinator implements Agent<AgentContext, Agent4Output> {
    name = 'agent_4' as const
    description = 'Coordinates parallel volume writing'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []

        if (!context.jobId) {
            errors.push('Job ID is required')
        }

        if (!context.rfpParsedData) {
            errors.push('RFP parsed data is required')
        }

        if (!context.companyData) {
            errors.push('Company data is required')
        }

        if (!context.contentOutlines) {
            errors.push('Content outlines are required (run Agent 3 first)')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }

    async execute(
        context: AgentContext,
        targetVolumeOverride?: number,
        progressCallback?: ProgressCallback
    ): Promise<AgentResult<Agent4Output>> {
        const targetVolume = targetVolumeOverride || context.targetVolume
        console.log(`[Agent 4] Starting ${targetVolume ? `volume ${targetVolume}` : 'parallel volume'} writing for job ${context.jobId}`)
        const startTime = Date.now()

        try {
            // Validate prerequisites
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                return {
                    status: 'error',
                    data: null as unknown as Agent4Output,
                    errors: validation.errors,
                }
            }

            // Update status
            await this.updateAgentStatus(context.jobId, 'running')

            // Check for existing checkpoints from previous attempts
            const checkpoints = await this.loadCheckpoints(context.jobId)
            console.log(`[Agent 4] Checkpoint status: ${Object.keys(checkpoints).join(', ') || 'none'}`)
            
            // NEW: Per-volume mode - generate only the specified volume
            if (targetVolume) {
                if (![1, 2, 3, 4].includes(targetVolume)) {
                    return {
                        status: 'error',
                        data: null as unknown as Agent4Output,
                        errors: [`Invalid volume number: ${targetVolume}. Must be 1, 2, 3, or 4.`],
                    }
                }
                return await this.executeSingleVolume(context, targetVolume as 1 | 2 | 3 | 4, checkpoints, startTime, progressCallback)
            }
            
            // LEGACY: Run all 4 volume writers in parallel, using checkpoints if available
            console.log(`[Agent 4] Starting parallel volume generation...`)
            
            const [volume1, volume2, volume3, volume4] = await Promise.all([
                checkpoints.volume1 ? Promise.resolve(checkpoints.volume1) : this.writeWithProgress(context, 1, writeVolume1Technical),
                checkpoints.volume2 ? Promise.resolve(checkpoints.volume2) : this.writeWithProgress(context, 2, writeVolume2Management),
                checkpoints.volume3 ? Promise.resolve(checkpoints.volume3) : this.writeWithProgress(context, 3, writeVolume3PastPerformance),
                checkpoints.volume4 ? Promise.resolve(checkpoints.volume4) : this.writeWithProgress(context, 4, writeVolume4Pricing),
            ])

            // Calculate totals
            const totalPages = volume1.pageCount + volume2.pageCount + volume3.pageCount + volume4.pageCount

            const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
            console.log(`[Agent 4] ✓ All volumes complete in ${elapsed} minutes`)
            console.log(`[Agent 4] Volume I: ${volume1.pageCount} pages`)
            console.log(`[Agent 4] Volume II: ${volume2.pageCount} pages`)
            console.log(`[Agent 4] Volume III: ${volume3.pageCount} pages`)
            console.log(`[Agent 4] Volume IV: ${volume4.pageCount} pages`)
            console.log(`[Agent 4] Total: ${totalPages} pages`)

            // Save volumes to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('proposal_jobs') as any)
                .update({
                    executive_summary: volume1.content.substring(0, 50000), // First part
                    technical_approach: volume1.content,
                    management_approach: volume2.content,
                    past_performance_volume: volume3.content,
                    pricing: volume4.content,
                    volume_progress: {
                        volume_1: { pages: volume1.pageCount, status: 'complete' },
                        volume_2: { pages: volume2.pageCount, status: 'complete' },
                        volume_3: { pages: volume3.pageCount, status: 'complete' },
                        volume_4: { pages: volume4.pageCount, status: 'complete' },
                    },
                    current_agent: 'agent_4',
                    agent_progress: {
                        agent_0: { status: 'complete' },
                        agent_1: { status: 'complete' },
                        agent_2: { status: 'complete' },
                        agent_3: { status: 'complete' },
                        agent_4: {
                            status: 'complete',
                            started_at: new Date(startTime).toISOString(),
                            completed_at: new Date().toISOString(),
                        },
                    },
                })
                .eq('job_id', context.jobId)

            if (error) {
                throw new Error(`Failed to save volumes: ${error.message}`)
            }

            return {
                status: 'success',
                data: {
                    volumes: {
                        volume1,
                        volume2,
                        volume3,
                        volume4,
                    },
                    totalPages,
                },
                nextAgent: 'agent_5',
                metadata: {
                    durationMinutes: parseFloat(elapsed),
                    totalCharacters: volume1.content.length + volume2.content.length + 
                                    volume3.content.length + volume4.content.length,
                },
            }
        } catch (error) {
            console.error(`[Agent 4] ❌ Error:`, error)
            await this.updateAgentStatus(context.jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
            
            return {
                status: 'error',
                data: null as unknown as Agent4Output,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            }
        }
    }

    /**
     * Execute a single volume generation (for volume-by-volume iteration mode)
     */
    private async executeSingleVolume(
        context: AgentContext,
        volumeNumber: 1 | 2 | 3 | 4,
        checkpoints: {
            volume1?: VolumeWriteResult
            volume2?: VolumeWriteResult
            volume3?: VolumeWriteResult
            volume4?: VolumeWriteResult
        },
        startTime: number,
        progressCallback?: ProgressCallback
    ): Promise<AgentResult<Agent4Output>> {
        console.log(`[Agent 4] Single-volume mode: generating Volume ${volumeNumber} only`)
        
        // Get the checkpoint for this volume if available
        const checkpointKey = `volume${volumeNumber}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        const checkpoint = checkpoints[checkpointKey]
        
        // Map volume number to writer function
        const writerMap = {
            1: (ctx: AgentContext, callback?: ProgressCallback) => writeVolume1Technical(ctx, callback),
            2: (ctx: AgentContext, callback?: ProgressCallback) => writeVolume2Management(ctx, callback),
            3: (ctx: AgentContext, callback?: ProgressCallback) => writeVolume3PastPerformance(ctx, callback),
            4: (ctx: AgentContext, callback?: ProgressCallback) => writeVolume4Pricing(ctx, callback),
        }
        
        // Generate the volume with progress callback
        const volumeResult = checkpoint 
            ? await Promise.resolve(checkpoint)
            : await this.writeWithProgress(context, volumeNumber, writerMap[volumeNumber], progressCallback)
        
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
        console.log(`[Agent 4] ✓ Volume ${volumeNumber} complete in ${elapsed} minutes (${volumeResult.pageCount} pages)`)
        
        // Save to database (single volume)
        const volumeFieldMap = {
            1: 'technical_approach',
            2: 'management_approach',
            3: 'past_performance_volume',
            4: 'pricing',
        }
        
        const updates: Record<string, unknown> = {
            [volumeFieldMap[volumeNumber]]: volumeResult.content,
            volume_progress: {
                [`volume_${volumeNumber}`]: { 
                    pages: volumeResult.pageCount, 
                    status: 'complete' 
                },
            },
            current_agent: 'agent_4',
            agent_progress: {
                agent_4: {
                    status: 'complete',
                    started_at: new Date(startTime).toISOString(),
                    completed_at: new Date().toISOString(),
                },
            },
        }
        
        // Also save executive summary for volume 1
        if (volumeNumber === 1) {
            updates.executive_summary = volumeResult.content.substring(0, 50000)
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update(updates)
            .eq('job_id', context.jobId)
        
        if (error) {
            throw new Error(`Failed to save volume ${volumeNumber}: ${error.message}`)
        }
        
        // Return result with only this volume
        const volumes = {
            volume1: volumeNumber === 1 ? volumeResult : undefined,
            volume2: volumeNumber === 2 ? volumeResult : undefined,
            volume3: volumeNumber === 3 ? volumeResult : undefined,
            volume4: volumeNumber === 4 ? volumeResult : undefined,
        }
        
        return {
            status: 'success',
            data: {
                volumes: volumes as Agent4Output['volumes'],
                totalPages: volumeResult.pageCount,
            },
            nextAgent: 'agent_5', // Still goes to agent 5 for scoring
            metadata: {
                durationMinutes: parseFloat(elapsed),
                totalCharacters: volumeResult.content.length,
                singleVolumeMode: true,
                volumeNumber,
            },
        }
    }

    private async writeWithProgress(
        context: AgentContext,
        volumeNumber: number,
        writeFn: (context: AgentContext, callback?: ProgressCallback) => Promise<VolumeWriteResult>,
        progressCallback?: ProgressCallback
    ): Promise<VolumeWriteResult> {
        console.log(`[Agent 4${String.fromCharCode(64 + volumeNumber)}] Starting Volume ${volumeNumber}...`)
        
        try {
            // Mark as running
            await this.updateVolumeProgress(context.jobId, volumeNumber, 0, 'running')
            
            const result = await writeFn(context, progressCallback)
            console.log(`[Agent 4${String.fromCharCode(64 + volumeNumber)}] ✓ Volume ${volumeNumber} complete (${result.pageCount} pages)`)
            
            // CHECKPOINT: Save completed volume content immediately
            await this.saveVolumeCheckpoint(context.jobId, volumeNumber, result)
            
            // Update progress in database
            await this.updateVolumeProgress(context.jobId, volumeNumber, result.pageCount, 'complete')
            
            return result
        } catch (error) {
            console.error(`[Agent 4${String.fromCharCode(64 + volumeNumber)}] ✗ Volume ${volumeNumber} failed:`, error)
            await this.updateVolumeProgress(context.jobId, volumeNumber, 0, 'failed')
            throw error
        }
    }
    
    /**
     * Save volume content as a checkpoint so progress isn't lost if the job fails
     */
    private async saveVolumeCheckpoint(
        jobId: string,
        volumeNumber: number,
        result: VolumeWriteResult
    ): Promise<void> {
        const volumeField = volumeNumber === 1 ? 'technical_approach' :
                           volumeNumber === 2 ? 'management_approach' :
                           volumeNumber === 3 ? 'past_performance_volume' :
                           'pricing'
        
        // Also save executive summary from volume 1
        const updates: Record<string, unknown> = {
            [volumeField]: result.content,
        }
        
        if (volumeNumber === 1) {
            updates.executive_summary = result.content.substring(0, 50000)
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update(updates)
            .eq('job_id', jobId)
            
        console.log(`[Agent 4${String.fromCharCode(64 + volumeNumber)}] ✓ Volume ${volumeNumber} checkpoint saved`)
    }
    
    /**
     * Load existing volume checkpoints from a previous (failed) attempt
     * Returns volumes that were already completed so they don't need to be regenerated
     */
    private async loadCheckpoints(jobId: string): Promise<{
        volume1?: VolumeWriteResult
        volume2?: VolumeWriteResult
        volume3?: VolumeWriteResult
        volume4?: VolumeWriteResult
    }> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await (supabase.from('proposal_jobs') as any)
                .select('technical_approach, management_approach, past_performance_volume, pricing, volume_progress')
                .eq('job_id', jobId)
                .single()
            
            if (!data) return {}
            
            const checkpoints: Record<string, VolumeWriteResult> = {}
            
            // Check if each volume has content and was marked complete
            const volumeProgress = data.volume_progress || {}
            
            if (data.technical_approach && volumeProgress.volume_1?.status === 'complete') {
                const pages = volumeProgress.volume_1.pages || Math.ceil(data.technical_approach.length / 3000)
                checkpoints.volume1 = {
                    volumeNumber: 1,
                    content: data.technical_approach,
                    pageCount: pages,
                    sectionsWritten: [],
                    requirementsAddressed: [],
                }
                console.log(`[Agent 4A] ✓ Volume 1 loaded from checkpoint (${pages} pages)`)
            }
            
            if (data.management_approach && volumeProgress.volume_2?.status === 'complete') {
                const pages = volumeProgress.volume_2.pages || Math.ceil(data.management_approach.length / 3000)
                checkpoints.volume2 = {
                    volumeNumber: 2,
                    content: data.management_approach,
                    pageCount: pages,
                    sectionsWritten: [],
                    requirementsAddressed: [],
                }
                console.log(`[Agent 4B] ✓ Volume 2 loaded from checkpoint (${pages} pages)`)
            }
            
            if (data.past_performance_volume && volumeProgress.volume_3?.status === 'complete') {
                const pages = volumeProgress.volume_3.pages || Math.ceil(data.past_performance_volume.length / 3000)
                checkpoints.volume3 = {
                    volumeNumber: 3,
                    content: data.past_performance_volume,
                    pageCount: pages,
                    sectionsWritten: [],
                    requirementsAddressed: [],
                }
                console.log(`[Agent 4C] ✓ Volume 3 loaded from checkpoint (${pages} pages)`)
            }
            
            if (data.pricing && volumeProgress.volume_4?.status === 'complete') {
                const pages = volumeProgress.volume_4.pages || Math.ceil(data.pricing.length / 3000)
                checkpoints.volume4 = {
                    volumeNumber: 4,
                    content: data.pricing,
                    pageCount: pages,
                    sectionsWritten: [],
                    requirementsAddressed: [],
                }
                console.log(`[Agent 4D] ✓ Volume 4 loaded from checkpoint (${pages} pages)`)
            }
            
            return checkpoints
        } catch (error) {
            console.error(`[Agent 4] Failed to load checkpoints:`, error)
            return {}
        }
    }

    private async updateVolumeProgress(
        jobId: string,
        volumeNumber: number,
        pages: number,
        status: 'running' | 'complete' | 'failed'
    ): Promise<void> {
        const volumeKey = `volume_${volumeNumber}`
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                volume_progress: {
                    [volumeKey]: { pages, status },
                },
            })
            .eq('job_id', jobId)
    }

    private async updateAgentStatus(
        jobId: string,
        status: 'running' | 'complete' | 'failed',
        error?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                current_agent: 'agent_4',
                agent_progress: {
                    agent_4: {
                        status,
                        ...(status === 'running' && { started_at: new Date().toISOString() }),
                        ...((status === 'complete' || status === 'failed') && { completed_at: new Date().toISOString() }),
                        ...(error && { error }),
                    },
                },
            })
            .eq('job_id', jobId)
    }
}

// Export singleton instance
export const agent4 = new Agent4Coordinator()




