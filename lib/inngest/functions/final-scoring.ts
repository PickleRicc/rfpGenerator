/**
 * Final Scoring Function - Modular Inngest Function
 * 
 * Performs cross-volume compliance analysis
 * Checks for duplicate content and consistency
 * Generates final comprehensive compliance report
 * 
 * Triggered by: proposal/scoring.start
 * Emits: proposal/scoring.complete
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { AgentContext } from '../../agents'
import { updateJobStatus } from '../db-helpers'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function updateProgress(
    jobId: string,
    progress: number,
    step: string
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                progress_percent: Math.round(progress),
                current_step: step,
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)
    } catch (error) {
        logger.error(`[updateProgress] Unexpected error: ${error instanceof Error ? error.message : String(error)}`, { jobId })
    }
}

interface CrossVolumeAnalysis {
    duplicateContentCheck: {
        passed: boolean
        details: string
        duplicateCount: number
    }
    consistencyCheck: {
        passed: boolean
        details: string
        inconsistencies: string[]
    }
    completenessCheck: {
        passed: boolean
        details: string
        missingElements: string[]
    }
    rfpAlignmentCheck: {
        passed: boolean
        details: string
        alignmentScore: number
    }
}

async function performCrossVolumeAnalysis(
    context: AgentContext,
    jobId: string
): Promise<CrossVolumeAnalysis> {
    logger.info('[Scoring] Performing cross-volume analysis', { data: { jobId } })

    const volumeKeys = ['volume1', 'volume2', 'volume3', 'volume4'] as const
    const volumes = volumeKeys.map(key => context.volumes?.[key] || '')

    // ================================================================
    // DUPLICATE CONTENT CHECK
    // ================================================================
    
    const duplicateCheck = (() => {
        const chunks = new Map<string, number>()
        let duplicateCount = 0

        // Extract significant chunks (100+ character sequences)
        for (const volume of volumes) {
            const words = volume.split(/\s+/)
            for (let i = 0; i < words.length - 20; i++) {
                const chunk = words.slice(i, i + 20).join(' ')
                if (chunk.length > 100) {
                    const existing = chunks.get(chunk) || 0
                    chunks.set(chunk, existing + 1)
                    if (existing > 0) duplicateCount++
                }
            }
        }

        const passed = duplicateCount < 10 // Allow some overlap, but not excessive
        return {
            passed,
            details: passed 
                ? `Minimal duplicate content detected (${duplicateCount} chunks)` 
                : `Excessive duplicate content detected (${duplicateCount} chunks)`,
            duplicateCount
        }
    })()

    // ================================================================
    // CONSISTENCY CHECK
    // ================================================================
    
    const consistencyCheck = await (async () => {
        const inconsistencies: string[] = []

        // Check company name consistency
        const companyName = context.companyData?.company?.name || ''
        if (companyName) {
            for (let i = 0; i < volumes.length; i++) {
                const volume = volumes[i]
                // Look for misspellings or variations
                const nameCount = (volume.match(new RegExp(companyName, 'gi')) || []).length
                if (nameCount === 0 && volume.length > 1000) {
                    inconsistencies.push(`Volume ${i + 1} may not reference company name`)
                }
            }
        }

        // Check for consistent terminology across volumes
        const keyTerms = ['proposal', 'requirement', 'solution', 'approach']
        for (const term of keyTerms) {
            const usageCounts = volumes.map(v => (v.match(new RegExp(term, 'gi')) || []).length)
            const avg = usageCounts.reduce((a, b) => a + b, 0) / usageCounts.length
            // Flag volumes with significantly different usage
            usageCounts.forEach((count, i) => {
                if (volumes[i].length > 1000 && count < avg * 0.3) {
                    inconsistencies.push(`Volume ${i + 1} has unusual "${term}" usage`)
                }
            })
        }

        return {
            passed: inconsistencies.length === 0,
            details: inconsistencies.length === 0 
                ? 'All volumes show consistent terminology and formatting' 
                : `Found ${inconsistencies.length} potential inconsistencies`,
            inconsistencies
        }
    })()

    // ================================================================
    // COMPLETENESS CHECK
    // ================================================================
    
    const completenessCheck = (() => {
        const missingElements: string[] = []

        // Check each volume has substantial content
        volumes.forEach((volume, i) => {
            if (volume.length < 5000) {
                missingElements.push(`Volume ${i + 1} may be incomplete (too short)`)
            }
        })

        // Check for key sections that should appear
        const expectedSections = [
            { name: 'Executive Summary', pattern: /executive\s+summary/i },
            { name: 'Technical Approach', pattern: /technical\s+approach/i },
            { name: 'Experience', pattern: /experience|past\s+performance/i },
            { name: 'Pricing', pattern: /pric(e|ing)|cost/i }
        ]

        for (const section of expectedSections) {
            const found = volumes.some(v => section.pattern.test(v))
            if (!found) {
                missingElements.push(`No "${section.name}" section found across volumes`)
            }
        }

        return {
            passed: missingElements.length === 0,
            details: missingElements.length === 0 
                ? 'All expected content elements present' 
                : `Missing ${missingElements.length} expected elements`,
            missingElements
        }
    })()

    // ================================================================
    // RFP ALIGNMENT CHECK
    // ================================================================
    
    const rfpAlignmentCheck = await (async () => {
        // Fetch individual volume scores
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job } = await (supabase.from('proposal_jobs') as any)
            .select('volume_scores')
            .eq('job_id', jobId)
            .single()

        const volumeScores = job?.volume_scores || {}
        const scores = [
            volumeScores.volume1 || 0,
            volumeScores.volume2 || 0,
            volumeScores.volume3 || 0,
            volumeScores.volume4 || 0
        ]

        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
        const minScore = Math.min(...scores)

        // Check if all volumes meet minimum threshold
        const passed = minScore >= 70 && avgScore >= 75

        return {
            passed,
            details: passed 
                ? `Strong RFP alignment (avg: ${avgScore.toFixed(1)}%, min: ${minScore}%)` 
                : `Some volumes need improvement (avg: ${avgScore.toFixed(1)}%, min: ${minScore}%)`,
            alignmentScore: avgScore
        }
    })()

    return {
        duplicateContentCheck: duplicateCheck,
        consistencyCheck,
        completenessCheck,
        rfpAlignmentCheck
    }
}

// ============================================================================
// FINAL SCORING FUNCTION
// ============================================================================

export const finalScoringFunction = inngest.createFunction(
    {
        id: 'final-scoring',
        name: 'Final Scoring & Compliance Report',
        retries: 2,
    },
    { event: 'proposal/scoring.start' },
    async ({ event, step }) => {
        const { jobId } = event.data

        logger.info('[Scoring] Starting final scoring and compliance analysis', { data: { jobId } })

        try {
            // Update job status
            await updateJobStatus(jobId, 'processing', {
                current_step: 'Final Scoring - Cross-Volume Analysis',
                final_scoring_status: 'running'
            })

            await updateProgress(jobId, 95, 'Analyzing cross-volume compliance')

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
                    volumes: job.volumes || {}
                }

                return agentContext
            })

            // ================================================================
            // CROSS-VOLUME ANALYSIS
            // ================================================================

            const crossVolumeAnalysis = await step.run('cross-volume-analysis', async () => {
                return await performCrossVolumeAnalysis(context, jobId)
            })

            await updateProgress(jobId, 97, 'Generating final compliance report')

            // ================================================================
            // GENERATE FINAL COMPLIANCE REPORT
            // ================================================================

            const finalReport = await step.run('generate-final-report', async () => {
                // Fetch individual volume compliance details
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: job } = await (supabase.from('proposal_jobs') as any)
                    .select('volume_scores, volume_compliance_details, quality_checks')
                    .eq('job_id', jobId)
                    .single()

                const volumeScores = job?.volume_scores || {}
                const complianceDetails = job?.volume_compliance_details || {}
                const qualityChecks = job?.quality_checks || []

                // Calculate overall compliance score
                const scores = [
                    volumeScores.volume1 || 0,
                    volumeScores.volume2 || 0,
                    volumeScores.volume3 || 0,
                    volumeScores.volume4 || 0
                ]
                const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length

                // Aggregate all critical gaps across volumes
                const allCriticalGaps: string[] = []
                for (const volumeKey of ['volume1', 'volume2', 'volume3', 'volume4']) {
                    const details = complianceDetails[volumeKey]
                    if (details?.criticalGaps) {
                        allCriticalGaps.push(...details.criticalGaps.map((gap: string) => `${volumeKey}: ${gap}`))
                    }
                }

                // Determine if proposal needs revision
                const needsRevision = 
                    overallScore < 75 ||
                    !crossVolumeAnalysis.duplicateContentCheck.passed ||
                    !crossVolumeAnalysis.completenessCheck.passed ||
                    allCriticalGaps.length > 5

                const report = {
                    overallComplianceScore: overallScore,
                    volumeScores: {
                        volume1: volumeScores.volume1 || 0,
                        volume2: volumeScores.volume2 || 0,
                        volume3: volumeScores.volume3 || 0,
                        volume4: volumeScores.volume4 || 0
                    },
                    crossVolumeAnalysis,
                    qualityChecks,
                    allCriticalGaps,
                    needsRevision,
                    recommendation: needsRevision 
                        ? 'Manual review recommended before submission' 
                        : 'Proposal ready for submission',
                    generatedAt: new Date().toISOString()
                }

                logger.info('[Scoring] Final compliance report generated', {
                    data: { 
                        jobId, 
                        overallScore: overallScore.toFixed(1), 
                        needsRevision 
                    }
                })

                return report
            })

            // ================================================================
            // STORE FINAL REPORT AND UPDATE STATUS
            // ================================================================

            await step.run('store-final-report', async () => {
                const finalStatus = finalReport.needsRevision ? 'needs_revision' : 'completed'

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        final_compliance_report: finalReport,
                        final_scoring_status: 'complete',
                        status: finalStatus,
                        progress_percent: 100,
                        current_step: finalReport.needsRevision 
                            ? 'Complete - Manual review recommended' 
                            : 'Complete - Ready for submission',
                        completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)

                logger.info('[Scoring] Final scoring complete', { 
                    data: { jobId, status: finalStatus } 
                })
            })

            await updateProgress(jobId, 100, 'Proposal generation complete')

            // Emit completion event
            await step.sendEvent('emit-scoring-complete', {
                name: 'proposal/scoring.complete',
                data: {
                    jobId,
                    overallScore: finalReport.overallComplianceScore,
                    needsRevision: finalReport.needsRevision
                }
            })

            return {
                success: true,
                message: 'Final scoring complete',
                report: finalReport
            }

        } catch (error) {
            logger.error('[Scoring] Final scoring failed', {
                data: {
                    jobId,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            await updateJobStatus(jobId, 'failed', {
                current_step: 'Final scoring failed',
                final_scoring_status: 'failed',
                error_message: error instanceof Error ? error.message : String(error)
            })

            throw error
        }
    }
)



