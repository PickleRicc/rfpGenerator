/**
 * Inngest Functions for Proposal Generation
 * 
 * Uses Inngest's step functions for:
 * - Durable execution (automatic retries)
 * - Progress tracking between steps
 * - Timeout handling
 * - Cancellation support
 */

import { inngest, MAX_JOB_DURATION_MINUTES } from './client'
import { supabase } from '../supabase'
import { callClaude } from '../claude-client'
import { normalizeCompanyData, NormalizedCompanyData } from '../utils/normalize-data'
import { createAnalyzeRfpPrompt, parseRfpAnalysis, RfpAnalysis } from '../prompts/analyze-rfp'
import {
    createExecutiveSummaryPrompt,
    createTechnicalApproachPrompt,
    createManagementApproachPrompt,
    createPastPerformancePrompt,
    createPricingPrompt,
    createComplianceMatrixPrompt,
    createKeyPersonnelResumesPrompt,
    createAppendicesPrompt,
    sanitizeHtmlContent,
} from '../prompts/generate'
import { assembleProposalHtml, estimatePageCount, extractContractValue } from '../prompts/format'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function updateProgress(
    jobId: string,
    progress: number,
    step: string,
    sections?: string[],
    extra?: Record<string, unknown>
): Promise<void> {
    const update: Record<string, unknown> = {
        progress_percent: progress,
        current_step: step,
    }

    if (sections) update.sections_completed = sections
    if (extra) Object.assign(update, extra)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('proposal_jobs') as any).update(update).eq('job_id', jobId)
}

async function markFailed(jobId: string, error: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('proposal_jobs') as any).update({
        status: 'failed',
        current_step: `Error: ${error}`,
    }).eq('job_id', jobId)
}

async function checkCancelled(jobId: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase
        .from('proposal_jobs') as any)
        .select('status, current_step')
        .eq('job_id', jobId)
        .single()

    return data?.status === 'failed' && data?.current_step === 'Cancelled by user'
}

async function fetchCompanyData(companyId: string): Promise<NormalizedCompanyData> {
    console.log(`[DB] Fetching company data...`)

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

    return normalizeCompanyData(
        companyResult.data,
        ppResult.data || [],
        personnelResult.data || [],
        ratesResult.data || []
    )
}

// ============================================================================
// MAIN INNGEST FUNCTION
// ============================================================================

export const generateProposalFunction = inngest.createFunction(
    {
        id: 'generate-proposal',
        name: 'Generate Proposal',
        // Timeout the entire function after MAX_JOB_DURATION_MINUTES
        timeouts: {
            finish: `${MAX_JOB_DURATION_MINUTES}m`,
        },
        // Retry configuration
        retries: 2,
        // Cancel this function when a cancel event is received for the same jobId
        cancelOn: [
            {
                event: 'proposal/generate.cancelled',
                match: 'data.jobId',
            },
        ],
    },
    { event: 'proposal/generate.requested' },
    async ({ event, step }) => {
        const { jobId, rfpText, companyId, email, estimatedDurationMinutes } = event.data
        const startTime = Date.now()
        const sections: string[] = []

        console.log(`\n${'='.repeat(60)}`)
        console.log(`[Job ${jobId}] STARTING PROPOSAL (Inngest Orchestrated)`)
        console.log(`[Job ${jobId}] Estimated: ${estimatedDurationMinutes} min | Max: ${MAX_JOB_DURATION_MINUTES} min`)
        console.log(`${'='.repeat(60)}`)

        try {
            // ================================================================
            // STEP 1: ANALYZE RFP + LOAD DATA
            // ================================================================
            const { rfpAnalysis, companyData } = await step.run('analyze-rfp', async () => {
                console.log(`[Job ${jobId}] STEP 1: Analyzing RFP...`)
                await updateProgress(jobId, 5, 'Analyzing RFP...')

                const analyzePrompt = createAnalyzeRfpPrompt(rfpText)

                const [analysisResponse, company] = await Promise.all([
                    callClaude({
                        system: analyzePrompt.system,
                        userPrompt: analyzePrompt.userPrompt,
                        maxTokens: 4000,
                        temperature: 0.3,
                    }),
                    fetchCompanyData(companyId),
                ])

                const analysis = parseRfpAnalysis(analysisResponse)
                console.log(`[Job ${jobId}] ✓ RFP: ${analysis.metadata.solicitationNum}`)
                console.log(`[Job ${jobId}] ✓ Company: ${company.company.name}`)

                return { rfpAnalysis: analysis, companyData: company }
            })

            sections.push('RFP Analysis', 'Company Data')
            await updateProgress(jobId, 10, 'Starting section generation...', sections, {
                rfp_metadata: {
                    agency: rfpAnalysis.metadata.agency,
                    solicitationNum: rfpAnalysis.metadata.solicitationNum,
                    deadline: rfpAnalysis.metadata.deadline,
                }
            })

            if (await checkCancelled(jobId)) {
                return { status: 'cancelled', jobId }
            }

            // ================================================================
            // STEP 2: EXECUTIVE SUMMARY
            // ================================================================
            const executiveSummary = await step.run('generate-executive-summary', async () => {
                console.log(`[Job ${jobId}] STEP 2: Executive Summary...`)
                await updateProgress(jobId, 15, 'Generating Executive Summary...', sections)

                const prompt = createExecutiveSummaryPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 4000,
                    temperature: 0.7,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Executive Summary (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Executive Summary')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 3: TECHNICAL APPROACH
            // ================================================================
            const technicalApproach = await step.run('generate-technical-approach', async () => {
                console.log(`[Job ${jobId}] STEP 3: Technical Approach...`)
                await updateProgress(jobId, 25, 'Generating Technical Approach...', sections)

                const prompt = createTechnicalApproachPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 6000,
                    temperature: 0.7,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Technical Approach (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Technical Approach')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 4: MANAGEMENT APPROACH
            // ================================================================
            const managementApproach = await step.run('generate-management-approach', async () => {
                console.log(`[Job ${jobId}] STEP 4: Management Approach...`)
                await updateProgress(jobId, 38, 'Generating Management Approach...', sections)

                const prompt = createManagementApproachPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 4000,
                    temperature: 0.7,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Management Approach (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Management Approach')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 5: PAST PERFORMANCE
            // ================================================================
            const pastPerformance = await step.run('generate-past-performance', async () => {
                console.log(`[Job ${jobId}] STEP 5: Past Performance...`)
                await updateProgress(jobId, 48, 'Generating Past Performance...', sections)

                const prompt = createPastPerformancePrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 4000,
                    temperature: 0.7,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Past Performance (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Past Performance')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 6: PRICING
            // ================================================================
            const pricing = await step.run('generate-pricing', async () => {
                console.log(`[Job ${jobId}] STEP 6: Pricing...`)
                await updateProgress(jobId, 58, 'Generating Pricing...', sections)

                const prompt = createPricingPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 4000,
                    temperature: 0.5,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Pricing (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Pricing')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 7: COMPLIANCE MATRIX
            // ================================================================
            const complianceMatrix = await step.run('generate-compliance-matrix', async () => {
                console.log(`[Job ${jobId}] STEP 7: Compliance Matrix...`)
                await updateProgress(jobId, 68, 'Generating Compliance Matrix...', sections)

                const prompt = createComplianceMatrixPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 4000,
                    temperature: 0.5,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Compliance Matrix (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Compliance Matrix')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 8: KEY PERSONNEL RESUMES
            // ================================================================
            const keyPersonnelResumes = await step.run('generate-key-personnel', async () => {
                console.log(`[Job ${jobId}] STEP 8: Key Personnel Resumes...`)
                await updateProgress(jobId, 78, 'Generating Key Personnel Resumes...', sections)

                const prompt = createKeyPersonnelResumesPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 6000,
                    temperature: 0.7,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Key Personnel Resumes (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Key Personnel')
            if (await checkCancelled(jobId)) return { status: 'cancelled', jobId }

            // ================================================================
            // STEP 9: APPENDICES
            // ================================================================
            const appendices = await step.run('generate-appendices', async () => {
                console.log(`[Job ${jobId}] STEP 9: Appendices...`)
                await updateProgress(jobId, 88, 'Generating Appendices...', sections)

                const prompt = createAppendicesPrompt(rfpAnalysis, companyData)
                const result = await callClaude({
                    system: prompt.system,
                    userPrompt: prompt.userPrompt,
                    maxTokens: 6000,  // Increased for 5 full appendices
                    temperature: 0.5,
                })

                const sanitized = sanitizeHtmlContent(result)
                console.log(`[Job ${jobId}] ✓ Appendices (${sanitized.length} chars)`)
                return sanitized
            })

            sections.push('Appendices')

            // ================================================================
            // STEP 10: ASSEMBLE & SAVE
            // ================================================================
            await step.run('assemble-and-save', async () => {
                console.log(`[Job ${jobId}] STEP 10: Assembling document...`)
                await updateProgress(jobId, 95, 'Assembling final document...', sections)

                const combinedContent = `
<h1>SECTION 1.0 - EXECUTIVE SUMMARY</h1>
${executiveSummary}

<h1>SECTION 2.0 - TECHNICAL APPROACH</h1>
${technicalApproach}

<h1>SECTION 3.0 - MANAGEMENT APPROACH</h1>
${managementApproach}

<h1>SECTION 4.0 - PAST PERFORMANCE</h1>
${pastPerformance}

<h1>SECTION 5.0 - PRICING SUMMARY</h1>
${pricing}

<h1>SECTION 6.0 - COMPLIANCE MATRIX</h1>
${complianceMatrix}

<h1>SECTION 7.0 - KEY PERSONNEL RESUMES</h1>
${keyPersonnelResumes}

<h1>SECTION 8.0 - APPENDICES</h1>
${appendices}
`

                const finalHtml = assembleProposalHtml(rfpAnalysis, companyData, combinedContent)
                const pageCount = estimatePageCount(finalHtml)
                const contractValue = extractContractValue(pricing)

                // Save to database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any).update({
                    status: 'completed',
                    progress_percent: 100,
                    current_step: 'Complete',
                    sections_completed: [...sections, 'Final Assembly'],
                    executive_summary: executiveSummary,
                    technical_approach: technicalApproach,
                    management_approach: managementApproach,
                    past_performance_volume: pastPerformance,
                    pricing: pricing,
                    compliance_matrix: complianceMatrix,
                    cover_and_toc: keyPersonnelResumes,
                    appendices: appendices,
                    final_html: finalHtml,
                    rfp_metadata: {
                        agency: rfpAnalysis.metadata.agency,
                        solicitationNum: rfpAnalysis.metadata.solicitationNum,
                        deadline: rfpAnalysis.metadata.deadline,
                        contractValue: contractValue,
                        totalPages: pageCount,
                    },
                    completed_at: new Date().toISOString(),
                }).eq('job_id', jobId)

                const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
                console.log(`\n${'='.repeat(60)}`)
                console.log(`[Job ${jobId}] ✅ COMPLETE in ${elapsed} minutes!`)
                console.log(`[Job ${jobId}] Pages: ~${pageCount} | Value: ${contractValue}`)
                console.log(`${'='.repeat(60)}\n`)

                if (email) {
                    console.log(`[Job ${jobId}] Would notify: ${email}`)
                }
            })

            return {
                status: 'completed',
                jobId,
                duration: Math.round((Date.now() - startTime) / 1000),
            }

        } catch (error) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            console.error(`[Job ${jobId}] ❌ FAILED after ${elapsed}s:`, error)
            await markFailed(jobId, error instanceof Error ? error.message : 'Unknown error')
            throw error
        }
    }
)

// ============================================================================
// STALLED JOB MONITOR (Cron Function)
// ============================================================================

export const monitorStalledJobs = inngest.createFunction(
    {
        id: 'monitor-stalled-jobs',
        name: 'Monitor Stalled Jobs',
    },
    { cron: '*/5 * * * *' }, // Run every 5 minutes
    async ({ step }) => {
        await step.run('check-stalled-jobs', async () => {
            console.log('[Monitor] Checking for stalled jobs...')

            // Find jobs that have been "processing" for too long
            const maxAgeMs = MAX_JOB_DURATION_MINUTES * 60 * 1000
            const cutoffTime = new Date(Date.now() - maxAgeMs).toISOString()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: stalledJobs } = await (supabase
                .from('proposal_jobs') as any)
                .select('job_id, created_at, current_step')
                .eq('status', 'processing')
                .lt('created_at', cutoffTime)

            if (stalledJobs && stalledJobs.length > 0) {
                console.log(`[Monitor] Found ${stalledJobs.length} stalled jobs`)

                for (const job of stalledJobs) {
                    console.log(`[Monitor] Marking job ${job.job_id} as failed (timeout)`)
                    await markFailed(
                        job.job_id,
                        `Job timed out after ${MAX_JOB_DURATION_MINUTES} minutes. Last step: ${job.current_step}`
                    )
                }
            } else {
                console.log('[Monitor] No stalled jobs found')
            }

            return { checkedAt: new Date().toISOString(), stalledCount: stalledJobs?.length || 0 }
        })
    }
)

