/**
 * Agent 0: Volume Structure Enforcer
 * 
 * PRIMARY MISSION: Prevent the #1 disqualifying error by ensuring 4 separate 
 * volumes exist from the start with enforced page limits.
 * 
 * RESPONSIBILITIES:
 * 1. Create 4 separate document containers BEFORE any writing begins
 * 2. Set page limits per volume based on RFP requirements
 * 3. Initialize tracking for real-time page counting
 */

import { supabase } from '../supabase'
import { logger } from '../logger'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent0Output,
} from './types'
import { VolumePageLimits, VolumeProgress, AgentStatus } from '../database.types'

// Default page limits if not specified in RFP
const DEFAULT_PAGE_LIMITS: VolumePageLimits = {
    volume_1_technical: 50,
    volume_2_management: 30,
    volume_3_past_performance: 25,
    volume_4_price: null, // No limit
}

export class Agent0VolumeStructure implements Agent<AgentContext, Agent0Output> {
    name = 'agent_0' as const
    description = 'Creates 4 volume containers and enforces page limits'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []

        if (!context.jobId) {
            errors.push('Job ID is required')
        }

        if (!context.companyId) {
            errors.push('Company ID is required')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }

    async execute(context: AgentContext): Promise<AgentResult<Agent0Output>> {
        logger.agentStep('agent_0', context.jobId, 'Initializing volume structure')

        try {
            // Validate prerequisites
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                logger.error('Prerequisite validation failed', { 
                    jobId: context.jobId, 
                    agent: 'agent_0',
                    data: { errors: validation.errors }
                })
                return {
                    status: 'error',
                    data: null as unknown as Agent0Output,
                    errors: validation.errors,
                }
            }

            // Determine page limits from RFP or use defaults
            const volumePageLimits = this.extractPageLimits(context.rfpParsedData)
            logger.agentStep('agent_0', context.jobId, 'Determined page limits', { volumePageLimits })

            // Initialize volume progress tracking
            const volumeProgress: VolumeProgress = {
                volume_1: { pages: 0, status: 'pending' as AgentStatus },
                volume_2: { pages: 0, status: 'pending' as AgentStatus },
                volume_3: { pages: 0, status: 'pending' as AgentStatus },
                volume_4: { pages: 0, status: 'pending' as AgentStatus },
            }

            // Create placeholder URLs for volumes in Supabase Storage
            const volumeUrls = {
                volume1: `proposals/${context.jobId}/volume_1_technical.html`,
                volume2: `proposals/${context.jobId}/volume_2_management.html`,
                volume3: `proposals/${context.jobId}/volume_3_past_performance.html`,
                volume4: `proposals/${context.jobId}/volume_4_price.html`,
            }

            // Update proposal_jobs with volume structure
            // Note: agent_progress is updated by the Inngest orchestrator, not here
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('proposal_jobs') as any)
                .update({
                    volume_page_limits: volumePageLimits,
                    volume_progress: volumeProgress,
                    volume_1_url: volumeUrls.volume1,
                    volume_2_url: volumeUrls.volume2,
                    volume_3_url: volumeUrls.volume3,
                    volume_4_url: volumeUrls.volume4,
                    // current_agent and agent_progress are managed by Inngest orchestrator
                })
                .eq('job_id', context.jobId)

            if (error) {
                throw new Error(`Failed to update proposal job: ${error.message}`)
            }

            logger.agentStep('agent_0', context.jobId, 'Volume structure created', {
                volume_1: `${volumePageLimits.volume_1_technical} pages max`,
                volume_2: `${volumePageLimits.volume_2_management} pages max`,
                volume_3: `${volumePageLimits.volume_3_past_performance} pages max`,
                volume_4: `${volumePageLimits.volume_4_price ?? 'No limit'} pages`,
            })

            return {
                status: 'success',
                data: {
                    volumePageLimits,
                    volumeProgress,
                    volumeUrls,
                },
                nextAgent: 'agent_1',
                metadata: {
                    totalVolumeLimit: 
                        (volumePageLimits.volume_1_technical || 0) +
                        (volumePageLimits.volume_2_management || 0) +
                        (volumePageLimits.volume_3_past_performance || 0),
                },
            }
        } catch (error) {
            logger.error(error instanceof Error ? error.message : 'Unknown error', {
                jobId: context.jobId,
                agent: 'agent_0',
            })
            return {
                status: 'error',
                data: null as unknown as Agent0Output,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            }
        }
    }

    /**
     * Extract page limits from parsed RFP data or use defaults
     */
    private extractPageLimits(rfpParsedData?: import('../database.types').RfpParsedData): VolumePageLimits {
        if (rfpParsedData?.section_l?.page_limits) {
            return rfpParsedData.section_l.page_limits
        }

        // Return defaults if RFP data not available yet
        return DEFAULT_PAGE_LIMITS
    }
}

// Export singleton instance
export const agent0 = new Agent0VolumeStructure()

// Export helper for page limit validation
export function validatePageCount(
    volumeNumber: 1 | 2 | 3 | 4,
    currentPages: number,
    limits: VolumePageLimits
): { withinLimit: boolean; warning: boolean; message: string } {
    const limitKey = `volume_${volumeNumber}_${{
        1: 'technical',
        2: 'management',
        3: 'past_performance',
        4: 'price',
    }[volumeNumber]}` as keyof VolumePageLimits

    const limit = limits[limitKey]

    // Volume 4 (Price) typically has no limit
    if (limit === null) {
        return {
            withinLimit: true,
            warning: false,
            message: `Volume ${volumeNumber}: ${currentPages} pages (no limit)`,
        }
    }

    const warningThreshold = Math.floor(limit * 0.9)
    const withinLimit = currentPages <= limit
    const warning = currentPages >= warningThreshold && currentPages <= limit

    let message: string
    if (!withinLimit) {
        message = `Volume ${volumeNumber}: ${currentPages}/${limit} pages - EXCEEDS LIMIT`
    } else if (warning) {
        message = `Volume ${volumeNumber}: ${currentPages}/${limit} pages - APPROACHING LIMIT`
    } else {
        message = `Volume ${volumeNumber}: ${currentPages}/${limit} pages - OK`
    }

    return { withinLimit, warning, message }
}


