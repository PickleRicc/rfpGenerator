/**
 * Proposal Service - Micro-Prompt Architecture
 * 
 * Phase 1: Analyze RFP (~30 seconds)
 * Phase 2: Generate sections with micro-prompts (~4-5 minutes total)
 *   - Executive Summary (~30s)
 *   - Technical Approach (~45s)
 *   - Management Approach (~30s)
 *   - Past Performance (~30s)
 *   - Pricing (~30s)
 *   - Compliance Matrix (~30s)
 *   - Key Personnel Resumes (~45s)
 *   - Appendices (~30s)
 * Phase 3: Assemble HTML locally (instant)
 * 
 * Total: ~5-6 minutes
 */

import { supabase } from './supabase'
import { callClaude } from './claude-client'
import { normalizeCompanyData, NormalizedCompanyData } from './utils/normalize-data'
import { createAnalyzeRfpPrompt, parseRfpAnalysis, RfpAnalysis } from './prompts/analyze-rfp'
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
} from './prompts/generate'
import { assembleProposalHtml, estimatePageCount, extractContractValue } from './prompts/format'

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
// MAIN SERVICE - MICRO-PROMPT ARCHITECTURE
// ============================================================================

export async function generateProposal(
    jobId: string,
    rfpText: string,
    companyId: string,
    email?: string
): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[Job ${jobId}] STARTING PROPOSAL (Micro-Prompt Architecture)`)
    console.log(`${'='.repeat(60)}`)
    
    const startTime = Date.now()
    const sections: string[] = []
    
    try {
        // ================================================================
        // PHASE 1: ANALYZE RFP + LOAD DATA (parallel)
        // ================================================================
        console.log(`\n[Job ${jobId}] PHASE 1: Analyzing RFP...`)
        await updateProgress(jobId, 5, 'Analyzing RFP...')
        
        const analyzePrompt = createAnalyzeRfpPrompt(rfpText)
        
        const [analysisResponse, companyData] = await Promise.all([
            callClaude({
                system: analyzePrompt.system,
                userPrompt: analyzePrompt.userPrompt,
                maxTokens: 4000,
                temperature: 0.3,
            }),
            fetchCompanyData(companyId),
        ])
        
        const rfpAnalysis = parseRfpAnalysis(analysisResponse)
        console.log(`[Job ${jobId}] ✓ RFP: ${rfpAnalysis.metadata.solicitationNum}`)
        console.log(`[Job ${jobId}] ✓ Company: ${companyData.company.name}`)
        
        sections.push('RFP Analysis', 'Company Data')
        await updateProgress(jobId, 10, 'Starting section generation...', sections, {
            rfp_metadata: {
                agency: rfpAnalysis.metadata.agency,
                solicitationNum: rfpAnalysis.metadata.solicitationNum,
                deadline: rfpAnalysis.metadata.deadline,
            }
        })
        
        if (await checkCancelled(jobId)) return
        
        // ================================================================
        // PHASE 2: GENERATE SECTIONS (Sequential Micro-Prompts)
        // ================================================================
        console.log(`\n[Job ${jobId}] PHASE 2: Generating sections...`)
        
        // Section 1: Executive Summary (10% -> 20%)
        console.log(`[Job ${jobId}] → Executive Summary...`)
        await updateProgress(jobId, 15, 'Generating Executive Summary...', sections)
        const execPrompt = createExecutiveSummaryPrompt(rfpAnalysis, companyData)
        const executiveSummaryRaw = await callClaude({
            system: execPrompt.system,
            userPrompt: execPrompt.userPrompt,
            maxTokens: 4000,
            temperature: 0.7,
        })
        const executiveSummary = sanitizeHtmlContent(executiveSummaryRaw)
        sections.push('Executive Summary')
        console.log(`[Job ${jobId}] ✓ Executive Summary (${executiveSummary.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 2: Technical Approach (20% -> 35%)
        console.log(`[Job ${jobId}] → Technical Approach...`)
        await updateProgress(jobId, 25, 'Generating Technical Approach...', sections)
        const techPrompt = createTechnicalApproachPrompt(rfpAnalysis, companyData)
        const technicalApproachRaw = await callClaude({
            system: techPrompt.system,
            userPrompt: techPrompt.userPrompt,
            maxTokens: 6000,
            temperature: 0.7,
        })
        const technicalApproach = sanitizeHtmlContent(technicalApproachRaw)
        sections.push('Technical Approach')
        console.log(`[Job ${jobId}] ✓ Technical Approach (${technicalApproach.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 3: Management Approach (35% -> 45%)
        console.log(`[Job ${jobId}] → Management Approach...`)
        await updateProgress(jobId, 38, 'Generating Management Approach...', sections)
        const mgmtPrompt = createManagementApproachPrompt(rfpAnalysis, companyData)
        const managementApproachRaw = await callClaude({
            system: mgmtPrompt.system,
            userPrompt: mgmtPrompt.userPrompt,
            maxTokens: 4000,
            temperature: 0.7,
        })
        const managementApproach = sanitizeHtmlContent(managementApproachRaw)
        sections.push('Management Approach')
        console.log(`[Job ${jobId}] ✓ Management Approach (${managementApproach.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 4: Past Performance (45% -> 55%)
        console.log(`[Job ${jobId}] → Past Performance...`)
        await updateProgress(jobId, 48, 'Generating Past Performance...', sections)
        const ppPrompt = createPastPerformancePrompt(rfpAnalysis, companyData)
        const pastPerformanceRaw = await callClaude({
            system: ppPrompt.system,
            userPrompt: ppPrompt.userPrompt,
            maxTokens: 4000,
            temperature: 0.7,
        })
        const pastPerformance = sanitizeHtmlContent(pastPerformanceRaw)
        sections.push('Past Performance')
        console.log(`[Job ${jobId}] ✓ Past Performance (${pastPerformance.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 5: Pricing (55% -> 65%)
        console.log(`[Job ${jobId}] → Pricing...`)
        await updateProgress(jobId, 58, 'Generating Pricing...', sections)
        const pricingPrompt = createPricingPrompt(rfpAnalysis, companyData)
        const pricingRaw = await callClaude({
            system: pricingPrompt.system,
            userPrompt: pricingPrompt.userPrompt,
            maxTokens: 4000,
            temperature: 0.5,
        })
        const pricing = sanitizeHtmlContent(pricingRaw)
        sections.push('Pricing')
        console.log(`[Job ${jobId}] ✓ Pricing (${pricing.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 6: Compliance Matrix (65% -> 75%)
        console.log(`[Job ${jobId}] → Compliance Matrix...`)
        await updateProgress(jobId, 68, 'Generating Compliance Matrix...', sections)
        const compliancePrompt = createComplianceMatrixPrompt(rfpAnalysis, companyData)
        const complianceMatrixRaw = await callClaude({
            system: compliancePrompt.system,
            userPrompt: compliancePrompt.userPrompt,
            maxTokens: 4000,
            temperature: 0.5,
        })
        const complianceMatrix = sanitizeHtmlContent(complianceMatrixRaw)
        sections.push('Compliance Matrix')
        console.log(`[Job ${jobId}] ✓ Compliance Matrix (${complianceMatrix.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 7: Key Personnel Resumes (75% -> 85%)
        console.log(`[Job ${jobId}] → Key Personnel Resumes...`)
        await updateProgress(jobId, 78, 'Generating Key Personnel Resumes...', sections)
        const personnelPrompt = createKeyPersonnelResumesPrompt(rfpAnalysis, companyData)
        const keyPersonnelResumesRaw = await callClaude({
            system: personnelPrompt.system,
            userPrompt: personnelPrompt.userPrompt,
            maxTokens: 6000,
            temperature: 0.7,
        })
        const keyPersonnelResumes = sanitizeHtmlContent(keyPersonnelResumesRaw)
        sections.push('Key Personnel')
        console.log(`[Job ${jobId}] ✓ Key Personnel Resumes (${keyPersonnelResumes.length} chars)`)
        
        if (await checkCancelled(jobId)) return
        
        // Section 8: Appendices (85% -> 92%)
        console.log(`[Job ${jobId}] → Appendices...`)
        await updateProgress(jobId, 88, 'Generating Appendices...', sections)
        const appendicesPrompt = createAppendicesPrompt(rfpAnalysis, companyData)
        const appendicesRaw = await callClaude({
            system: appendicesPrompt.system,
            userPrompt: appendicesPrompt.userPrompt,
            maxTokens: 6000,  // Increased for 5 full appendices
            temperature: 0.5,
        })
        const appendices = sanitizeHtmlContent(appendicesRaw)
        sections.push('Appendices')
        console.log(`[Job ${jobId}] ✓ Appendices (${appendices.length} chars)`)
        
        // ================================================================
        // PHASE 3: ASSEMBLE HTML (Local - Instant!)
        // ================================================================
        console.log(`\n[Job ${jobId}] PHASE 3: Assembling document...`)
        await updateProgress(jobId, 95, 'Assembling final document...', sections)
        
        // Combine all sections with section numbers
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
        
        sections.push('Final Assembly')
        
        // ================================================================
        // SAVE TO DATABASE
        // ================================================================
        console.log(`[Job ${jobId}] Saving to database...`)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any).update({
            status: 'completed',
            progress_percent: 100,
            current_step: 'Complete',
            sections_completed: sections,
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
        
        if (email) console.log(`[Job ${jobId}] Would notify: ${email}`)
        
    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.error(`\n[Job ${jobId}] ❌ FAILED after ${elapsed}s:`, error)
        await markFailed(jobId, error instanceof Error ? error.message : 'Unknown error')
        throw error
    }
}
