/**
 * Final Assembly Function - Modular Inngest Function
 * 
 * Executes Agent 7 (Cover Page/TOC) and Agent 8 (Final Packaging)
 * Performs quality assurance checks
 * Assembles all volumes into final proposal
 * 
 * Triggered by: proposal/assembly.start
 * Emits: proposal/assembly.complete
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { agent8, AgentContext } from '../../agents'
import { updateJobStatus } from '../db-helpers'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface AgentProgressUpdate {
    status: 'pending' | 'running' | 'complete' | 'failed' | 'blocked'
    started_at?: string
    completed_at?: string
    error?: string
}

async function updateProgress(
    jobId: string,
    progress: number,
    step: string,
    currentAgent?: string,
    agentProgressUpdate?: { agent: string; progress: AgentProgressUpdate }
): Promise<void> {
    try {
        const updateData: {
            progress_percent: number
            current_step: string
            current_agent?: string
            agent_progress?: Record<string, AgentProgressUpdate>
            updated_at: string
        } = {
            progress_percent: Math.round(progress),
            current_step: step,
            updated_at: new Date().toISOString(),
        }

        if (currentAgent) {
            updateData.current_agent = currentAgent
        }

        // Atomic merge with retry logic
        if (agentProgressUpdate) {
            let retries = 3
            let success = false

            while (retries > 0 && !success) {
                try {
                    // Fetch current agent_progress
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
                        .select('agent_progress')
                        .eq('job_id', jobId)
                        .single()

                    const agentProgress = currentJob?.agent_progress || {}
                    
                    // Atomic merge: preserve existing data, only update specified agent
                    agentProgress[agentProgressUpdate.agent] = {
                        ...agentProgress[agentProgressUpdate.agent],
                        ...agentProgressUpdate.progress
                    }

                    updateData.agent_progress = agentProgress
                    success = true
                } catch (fetchError) {
                    retries--
                    if (retries === 0) {
                        logger.warn(`[updateProgress] Failed to fetch agent_progress after retries, continuing without agent update`, { 
                            data: { jobId, error: fetchError instanceof Error ? fetchError.message : String(fetchError) }
                        })
                        delete updateData.agent_progress
                        success = true
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 100))
                    }
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('proposal_jobs') as any)
            .update(updateData)
            .eq('job_id', jobId)

        if (updateError) {
            logger.error(`[updateProgress] Database update failed: ${updateError.message}`, { 
                jobId, 
                data: { progress, step, hasAgentProgress: !!updateData.agent_progress }
            })
        }
    } catch (error) {
        logger.error(`[updateProgress] Unexpected error: ${error instanceof Error ? error.message : String(error)}`, { jobId })
    }
}

interface QualityCheck {
    check: string
    passed: boolean
    details?: string
}

async function performQualityChecks(
    context: AgentContext,
    jobId: string
): Promise<QualityCheck[]> {
    const checks: QualityCheck[] = []

    // Check 1: All volumes present
    const volumeKeys = ['volume1', 'volume2', 'volume3', 'volume4'] as const
    const allVolumesPresent = volumeKeys.every(key => {
        const content = context.volumes?.[key]
        return content && content.length > 0
    })
    checks.push({
        check: 'All 4 volumes present',
        passed: allVolumesPresent,
        details: allVolumesPresent ? 'All volumes generated' : 'Missing one or more volumes'
    })

    // Check 2: Page limits respected (estimate based on character count)
    for (const volumeKey of volumeKeys) {
        const content = context.volumes?.[volumeKey] || ''
        const estimatedPages = Math.ceil(content.length / 3000) // ~3000 chars per page
        const volumeNum = volumeKey.replace('volume', '')
        const maxPages = context.volumePageLimits?.[`volume_${volumeNum}_technical` as keyof typeof context.volumePageLimits] || 50
        
        checks.push({
            check: `${volumeKey} page limit`,
            passed: estimatedPages <= maxPages,
            details: `Estimated ${estimatedPages} pages (max: ${maxPages})`
        })
    }

    // Check 3: Content quality - minimum length check
    for (const volumeKey of volumeKeys) {
        const content = context.volumes?.[volumeKey] || ''
        const minLength = 5000 // At least 5KB per volume
        
        checks.push({
            check: `${volumeKey} minimum content`,
            passed: content.length >= minLength,
            details: `${Math.round(content.length / 1024)} KB`
        })
    }

    // Check 4: All volumes approved
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job } = await (supabase.from('proposal_jobs') as any)
        .select('volume_status')
        .eq('job_id', jobId)
        .single()

    const volumeStatus = job?.volume_status || {}
    const allApproved = volumeKeys.every(key => volumeStatus[key] === 'approved')
    checks.push({
        check: 'All volumes approved',
        passed: allApproved,
        details: allApproved ? 'All volumes approved by user' : 'Some volumes not approved'
    })

    return checks
}

// ============================================================================
// FINAL ASSEMBLY FUNCTION
// ============================================================================

export const finalAssemblyFunction = inngest.createFunction(
    {
        id: 'final-assembly',
        name: 'Final Assembly & Quality Assurance',
        retries: 2,
    },
    { event: 'proposal/assembly.start' },
    async ({ event, step }) => {
        const { jobId } = event.data

        logger.info('[Assembly] Starting final assembly', { data: { jobId } })

        try {
            // Update job status
            await updateJobStatus(jobId, 'processing', {
                current_step: 'Final Assembly - Quality Assurance',
                assembly_status: 'running'
            })

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
            // QUALITY ASSURANCE CHECKS
            // ================================================================

            const qualityChecks = await step.run('quality-checks', async () => {
                logger.info('[Assembly] Running quality assurance checks', { data: { jobId } })
                await updateProgress(jobId, 90, 'Running quality assurance checks', 'qa')

                const checks = await performQualityChecks(context, jobId)

                // Log all checks
                for (const check of checks) {
                    logger.info(`[Assembly] QA Check: ${check.check}`, {
                        data: { jobId, passed: check.passed, details: check.details }
                    })
                }

                // Store QA results in database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        quality_checks: checks,
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)

                // Check if any critical checks failed
                const criticalChecks = ['All 4 volumes present', 'All volumes approved']
                const criticalFailures = checks.filter(c => criticalChecks.includes(c.check) && !c.passed)

                if (criticalFailures.length > 0) {
                    throw new Error(`Critical QA checks failed: ${criticalFailures.map(c => c.check).join(', ')}`)
                }

                return checks
            })

            // ================================================================
            // AGENT 8: Final Packaging
            // ================================================================

            const finalHtml = await step.run('agent-8-packaging', async () => {
                logger.agentStart('agent_8', jobId, 'Assembling final proposal')
                await updateProgress(jobId, 95, 'Assembling final proposal', 'agent_8', {
                    agent: 'agent_8',
                    progress: { status: 'running', started_at: new Date().toISOString() }
                })

                const result = await agent8.execute(context)

                if (result.status === 'error') {
                    throw new Error(`Agent 8 failed: ${result.errors?.join(', ')}`)
                }

                await updateProgress(jobId, 98, 'Final proposal assembled', 'agent_8', {
                    agent: 'agent_8',
                    progress: { status: 'complete', completed_at: new Date().toISOString() }
                })

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (result.data as any).finalHtml || result.data
            })

            // Store final HTML in database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    final_html: finalHtml,
                    assembly_status: 'complete',
                    updated_at: new Date().toISOString()
                })
                .eq('job_id', jobId)

            // Calculate final size
            const finalSizeKB = Math.round(finalHtml.length / 1024)
            logger.info('[Assembly] Final assembly complete', { 
                data: { jobId, sizeKB: finalSizeKB } 
            })

            await updateJobStatus(jobId, 'processing', {
                current_step: 'Assembly complete - ready for final scoring'
            })

            // Emit completion event
            await step.sendEvent('emit-assembly-complete', {
                name: 'proposal/assembly.complete',
                data: {
                    jobId,
                    qualityChecks,
                    finalSizeKB
                }
            })

            return {
                success: true,
                message: 'Final assembly complete',
                qualityChecks,
                finalSizeKB
            }

        } catch (error) {
            logger.error('[Assembly] Final assembly failed', {
                data: {
                    jobId,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            await updateJobStatus(jobId, 'failed', {
                current_step: 'Final assembly failed',
                assembly_status: 'failed',
                error_message: error instanceof Error ? error.message : String(error)
            })

            throw error
        }
    }
)



