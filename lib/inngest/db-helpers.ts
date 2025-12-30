/**
 * Database Helper Functions for Inngest Orchestration
 * 
 * Centralized database operations with:
 * - Proper error handling
 * - Heartbeat updates (updated_at)
 * - Detailed logging
 * - Type safety
 */

import { supabase } from '../supabase'
import { logger } from '../logger'

// ============================================================================
// VOLUME STATUS HELPERS
// ============================================================================

export async function updateVolumeScore(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    score: number
): Promise<void> {
    try {
        // Fetch current volume_scores
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('volume_scores')
            .eq('job_id', jobId)
            .single()

        const volumeScores = currentJob?.volume_scores || {}
        volumeScores[`volume${volume}`] = score

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                volume_scores: volumeScores,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update volume score: ${error.message}`)
        }

        logger.info('[DB] Updated volume score', {
            data: { jobId, volume, score }
        })
    } catch (error) {
        logger.error('[DB] Failed to update volume score', {
            data: {
                jobId,
                volume,
                score,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

export async function updateVolumeStatus(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    status: 'pending' | 'generating' | 'ready_for_scoring' | 'scoring' | 'awaiting_approval' | 'iterating' | 'approved' | 'blocked' | 'skipped'
): Promise<void> {
    try {
        // Fetch current volume_status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('volume_status')
            .eq('job_id', jobId)
            .single()

        const volumeStatus = currentJob?.volume_status || {}
        volumeStatus[`volume${volume}`] = status

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                volume_status: volumeStatus,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update volume status: ${error.message}`)
        }

        logger.info('[DB] Updated volume status', {
            data: { jobId, volume, status }
        })
    } catch (error) {
        logger.error('[DB] Failed to update volume status', {
            data: {
                jobId,
                volume,
                status,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

export async function updateVolumeIteration(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    iteration: number
): Promise<void> {
    try {
        // Fetch current volume_iterations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('volume_iterations')
            .eq('job_id', jobId)
            .single()

        const volumeIterations = currentJob?.volume_iterations || {}
        volumeIterations[`volume${volume}`] = iteration

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                volume_iterations: volumeIterations,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update volume iteration: ${error.message}`)
        }

        logger.info('[DB] Updated volume iteration', {
            data: { jobId, volume, iteration }
        })
    } catch (error) {
        logger.error('[DB] Failed to update volume iteration', {
            data: {
                jobId,
                volume,
                iteration,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

export async function updateVolumeInsights(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    insights: object
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                current_volume_insights: insights,
                current_volume: volume,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update volume insights: ${error.message}`)
        }

        logger.info('[DB] Updated volume insights', {
            data: { jobId, volume }
        })
    } catch (error) {
        logger.error('[DB] Failed to update volume insights', {
            data: {
                jobId,
                volume,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

export async function updateVolumeSectionProgress(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    sectionName: string,
    status: 'pending' | 'in-progress' | 'complete',
    progress: number,
    timeSeconds?: number
): Promise<void> {
    try {
        // Fetch current volume_section_progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('volume_section_progress')
            .eq('job_id', jobId)
            .single()

        const volumeSectionProgress = currentJob?.volume_section_progress || {}
        const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        
        if (!volumeSectionProgress[volumeKey]) {
            volumeSectionProgress[volumeKey] = { sections: [] }
        }

        const sections = volumeSectionProgress[volumeKey].sections || []
        const sectionIndex = sections.findIndex((s: { name: string }) => s.name === sectionName)
        
        const sectionData: {
            name: string
            status: string
            progress: number
            timeSeconds?: number
        } = {
            name: sectionName,
            status,
            progress
        }
        
        if (timeSeconds !== undefined) {
            sectionData.timeSeconds = timeSeconds
        }

        if (sectionIndex >= 0) {
            sections[sectionIndex] = sectionData
        } else {
            sections.push(sectionData)
        }

        volumeSectionProgress[volumeKey].sections = sections

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                volume_section_progress: volumeSectionProgress,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update volume section progress: ${error.message}`)
        }

        logger.info('[DB] Updated volume section progress', {
            data: { jobId, volume, sectionName, status, progress }
        })
    } catch (error) {
        logger.error('[DB] Failed to update volume section progress', {
            data: {
                jobId,
                volume,
                sectionName,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        // Don't throw - section progress updates are non-critical
    }
}

export async function storeVolumeComplianceDetails(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    complianceDetails: {
        requirementScores?: Array<{
            requirementId: string
            requirementText: string
            score: number
            rationale: string
            gaps: string[]
        }>
        strengths?: string[]
        criticalGaps?: string[]
        overallScore: number
    }
): Promise<void> {
    try {
        // Fetch current volume_compliance_details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('volume_compliance_details')
            .eq('job_id', jobId)
            .single()

        const volumeComplianceDetails = currentJob?.volume_compliance_details || {}
        const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        
        volumeComplianceDetails[volumeKey] = complianceDetails

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                volume_compliance_details: volumeComplianceDetails,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to store volume compliance details: ${error.message}`)
        }

        logger.info('[DB] Stored volume compliance details', {
            data: { jobId, volume, overallScore: complianceDetails.overallScore }
        })
    } catch (error) {
        logger.error('[DB] Failed to store volume compliance details', {
            data: {
                jobId,
                volume,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

// ============================================================================
// USER FEEDBACK HELPERS
// ============================================================================

export async function storeUserFeedback(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    iteration: number,
    feedback: string
): Promise<void> {
    try {
        // Fetch current feedback history
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('user_feedback_history')
            .eq('job_id', jobId)
            .single()

        const feedbackHistory = currentJob?.user_feedback_history || []
        feedbackHistory.push({
            volume,
            iteration,
            feedback,
            timestamp: new Date().toISOString()
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                user_feedback_history: feedbackHistory,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to store user feedback: ${error.message}`)
        }

        logger.info('[DB] Stored user feedback', {
            data: { jobId, volume, iteration, feedbackLength: feedback.length }
        })
    } catch (error) {
        logger.error('[DB] Failed to store user feedback', {
            data: {
                jobId,
                volume,
                iteration,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

export async function fetchUserFeedback(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    iteration?: number
): Promise<string | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('user_feedback_history')
            .eq('job_id', jobId)
            .single()

        const feedbackHistory = currentJob?.user_feedback_history || []
        
        // Filter by volume and optionally iteration
        const relevantFeedback = feedbackHistory.filter((f: { volume: number; iteration: number }) => 
            f.volume === volume && (iteration === undefined || f.iteration === iteration)
        )

        if (relevantFeedback.length === 0) {
            return null
        }

        // Return most recent feedback
        const latest = relevantFeedback[relevantFeedback.length - 1]
        return latest.feedback
    } catch (error) {
        logger.error('[DB] Failed to fetch user feedback', {
            data: {
                jobId,
                volume,
                iteration,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        return null
    }
}

// ============================================================================
// JOB STATUS HELPERS
// ============================================================================

export async function updateJobStatus(
    jobId: string,
    status: 'draft' | 'intake' | 'validating' | 'blocked' | 'processing' | 'review' | 'completed' | 'failed' | 'cancelled',
    additionalFields?: Record<string, unknown>
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                status,
                updated_at: new Date().toISOString(),
                ...additionalFields
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update job status: ${error.message}`)
        }

        logger.info('[DB] Updated job status', {
            data: { jobId, status, additionalFields }
        })
    } catch (error) {
        logger.error('[DB] Failed to update job status', {
            data: {
                jobId,
                status,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

export async function setAwaitingApproval(
    jobId: string,
    volume: 1 | 2 | 3 | 4,
    awaiting: boolean
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                awaiting_user_approval: awaiting,
                current_volume: volume,
                status: awaiting ? 'review' : 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to set awaiting approval: ${error.message}`)
        }

        logger.info('[DB] Set awaiting approval', {
            data: { jobId, volume, awaiting }
        })
    } catch (error) {
        logger.error('[DB] Failed to set awaiting approval', {
            data: {
                jobId,
                volume,
                awaiting,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

// ============================================================================
// BATCH OPERATIONS (Performance Optimization)
// ============================================================================

/**
 * Batch save volumes to prevent database timeouts
 * 
 * Saves large volume content in batches to avoid overwhelming the database
 * with a single massive update. Includes brief pauses between batches.
 * 
 * Pattern from marketing app's batchProcessingService.
 * 
 * @param jobId - Job ID
 * @param volumes - Volume content to save
 * @param batchSize - Number of volumes per batch (default: 2)
 */
export async function batchSaveVolumes(
    jobId: string,
    volumes: Record<string, string>,
    batchSize: number = 2
): Promise<void> {
    try {
        const volumeEntries = Object.entries(volumes)
        logger.info('[DB] Starting batch volume save', {
            data: { jobId, totalVolumes: volumeEntries.length, batchSize }
        })

        for (let i = 0; i < volumeEntries.length; i += batchSize) {
            const batch = volumeEntries.slice(i, i + batchSize)
            const batchNum = Math.floor(i / batchSize) + 1
            const totalBatches = Math.ceil(volumeEntries.length / batchSize)

            logger.info(`[DB] Saving batch ${batchNum}/${totalBatches}`, {
                data: { jobId, volumes: batch.map(([key]) => key) }
            })

            // Build update object for this batch
            const updateData: Record<string, unknown> = {
                updated_at: new Date().toISOString()
            }

            // Map volume keys to database fields
            const volumeFieldMap: Record<string, string> = {
                volume1: 'technical_approach',
                volume2: 'management_approach',
                volume3: 'past_performance_volume',
                volume4: 'pricing'
            }

            batch.forEach(([key, content]) => {
                const dbField = volumeFieldMap[key]
                if (dbField) {
                    updateData[dbField] = content
                    // Also save to volumes JSONB field for new system
                    if (!updateData.volumes) {
                        updateData.volumes = {}
                    }
                    (updateData.volumes as Record<string, string>)[key] = content
                }
            })

            // Execute batch update
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('proposal_jobs') as any)
                .update(updateData)
                .eq('job_id', jobId)

            if (error) {
                throw new Error(`Failed to save batch ${batchNum}: ${error.message}`)
            }

            logger.info(`[DB] Batch ${batchNum}/${totalBatches} saved successfully`, {
                data: { jobId }
            })

            // Brief pause between batches to prevent overwhelming the database
            if (i + batchSize < volumeEntries.length) {
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }

        logger.info('[DB] All volume batches saved successfully', {
            data: { jobId, totalVolumes: volumeEntries.length }
        })
    } catch (error) {
        logger.error('[DB] Failed to batch save volumes', {
            data: {
                jobId,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        throw error
    }
}

/**
 * Update overall progress and current step
 * 
 * @param jobId - Job ID
 * @param progress - Progress percentage (0-100)
 * @param step - Current step description
 * @param currentAgent - Current agent name (optional)
 * @param agentProgressUpdate - Agent-specific progress update (optional)
 */
export async function updateProgress(
    jobId: string,
    progress: number,
    step: string,
    currentAgent?: string,
    agentProgressUpdate?: { 
        agent: string
        progress: { 
            status: string
            started_at?: string
            completed_at?: string
            error?: string 
        } 
    }
): Promise<void> {
    try {
        const updateData: Record<string, unknown> = {
            progress_percent: Math.round(progress),
            current_step: step,
            updated_at: new Date().toISOString() // Heartbeat - keeps job alive
        }

        if (currentAgent) {
            updateData.current_agent = currentAgent
        }

        if (agentProgressUpdate) {
            // Fetch current agent_progress
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
                .select('agent_progress')
                .eq('job_id', jobId)
                .single()

            const agentProgress = currentJob?.agent_progress || {}
            agentProgress[agentProgressUpdate.agent] = agentProgressUpdate.progress
            updateData.agent_progress = agentProgress
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update(updateData)
            .eq('job_id', jobId)

        if (error) {
            throw new Error(`Failed to update progress: ${error.message}`)
        }

        // Only log significant progress updates to reduce noise
        if (progress % 5 === 0 || agentProgressUpdate) {
            logger.info('[DB] Updated progress', {
                data: { jobId, progress: Math.round(progress), step }
            })
        }
    } catch (error) {
        logger.error('[DB] Failed to update progress', {
            data: {
                jobId,
                progress,
                step,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        // Don't throw - progress updates are non-critical
    }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

export async function getJobDetails(jobId: string): Promise<{
    status: string
    current_volume?: number
    volume_iterations?: Record<string, number>
    volume_scores?: Record<string, number>
    volume_status?: Record<string, string>
    awaiting_user_approval?: boolean
} | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('proposal_jobs') as any)
            .select('status, current_volume, volume_iterations, volume_scores, volume_status, awaiting_user_approval')
            .eq('job_id', jobId)
            .single()

        if (error) {
            throw new Error(`Failed to get job details: ${error.message}`)
        }

        return data
    } catch (error) {
        logger.error('[DB] Failed to get job details', {
            data: {
                jobId,
                error: error instanceof Error ? error.message : String(error)
            }
        })
        return null
    }
}

