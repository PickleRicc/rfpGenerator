import { supabase } from './supabase'
import { callClaude } from './claude-client'
import {
    createRfpExtractionPrompt,
    createExecutiveSummaryPrompt,
    createTechnicalApproachPrompt,
    createManagementApproachPrompt,
    createPastPerformancePrompt,
    createComplianceMatrixPrompt,
    createCoverAndTocPrompt,
    createPricingPrompt,
    createAppendicesPrompt,
    CompanyData,
    RfpExtractionResult,
} from './prompts'
import { Company, PastPerformance, Personnel, LaborRate } from './database.types'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update job progress in database
 */
async function updateJobProgress(
    jobId: string,
    progress: number,
    currentStep: string,
    sectionsCompleted?: string[],
    additionalData?: Record<string, unknown>
): Promise<void> {
    const updateData: Record<string, unknown> = {
        progress_percent: progress,
        current_step: currentStep,
    }

    if (sectionsCompleted) {
        updateData.sections_completed = sectionsCompleted
    }

    if (additionalData) {
        Object.assign(updateData, additionalData)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
        .from('proposal_jobs') as any)
        .update(updateData)
        .eq('job_id', jobId)

    if (error) {
        console.error('Error updating job progress:', error)
    }
}

/**
 * Mark job as failed with error message
 */
async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase
        .from('proposal_jobs') as any)
        .update({
            status: 'failed',
            current_step: `Error: ${errorMessage}`,
        })
        .eq('job_id', jobId)
}

/**
 * Check if job has been cancelled
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase
        .from('proposal_jobs') as any)
        .select('status, current_step')
        .eq('job_id', jobId)
        .single()

    return data?.status === 'failed' && data?.current_step === 'Cancelled by user'
}

/**
 * Parse JSON from Claude response, handling markdown code blocks
 */
function parseClaudeJson(response: string): RfpExtractionResult {
    let cleanedResponse = response.trim()
    
    // Remove ```json or ``` markers
    if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    try {
        return JSON.parse(cleanedResponse)
    } catch (error) {
        console.error('Failed to parse JSON response:', cleanedResponse.substring(0, 500))
        throw new Error(`Failed to parse RFP extraction response: ${error}`)
    }
}

/**
 * Fetch all company data from Supabase
 */
async function fetchCompanyData(companyId: string): Promise<CompanyData> {
    // Fetch all data in parallel for speed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [companyResult, pastPerfResult, personnelResult, laborRatesResult] = await Promise.all([
        (supabase.from('companies') as any).select('*').eq('id', companyId).single(),
        (supabase.from('past_performance') as any).select('*').eq('company_id', companyId),
        (supabase.from('personnel') as any).select('*').eq('company_id', companyId),
        (supabase.from('labor_rates') as any).select('*').eq('company_id', companyId),
    ])

    if (companyResult.error || !companyResult.data) {
        throw new Error(`Failed to fetch company: ${companyResult.error?.message || 'Company not found'}`)
    }

    return {
        company: companyResult.data as Company,
        pastPerformance: (pastPerfResult.data || []) as PastPerformance[],
        personnel: (personnelResult.data || []) as Personnel[],
        laborRates: (laborRatesResult.data || []) as LaborRate[],
    }
}

/**
 * Assemble final HTML document from sections (NO Claude call - instant!)
 */
function assembleProposalHtml(
    rfpData: RfpExtractionResult,
    companyData: CompanyData,
    sections: {
        coverAndToc: string
        executiveSummary: string
        technicalApproach: string
        managementApproach: string
        pastPerformanceVolume: string
        pricing: string
        complianceMatrix: string
        appendices: string
    }
): string {
    const { company } = companyData
    const solicitationNum = rfpData.metadata?.solicitationNum || 'Unknown'
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Technical Proposal - ${solicitationNum} - ${company.name}</title>
<style>
body {
  font-family: 'Times New Roman', Arial, sans-serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #000;
  margin: 1in;
  max-width: 8.5in;
}

h1 {
  font-size: 18pt;
  font-weight: bold;
  margin-top: 24pt;
  margin-bottom: 12pt;
  page-break-before: always;
  border-bottom: 2px solid #000;
  padding-bottom: 6pt;
}

h1:first-of-type {
  page-break-before: avoid;
}

h2 {
  font-size: 14pt;
  font-weight: bold;
  margin-top: 18pt;
  margin-bottom: 10pt;
  color: #1a1a1a;
}

h3 {
  font-size: 12pt;
  font-weight: bold;
  margin-top: 12pt;
  margin-bottom: 8pt;
  color: #333;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 12pt 0;
  font-size: 11pt;
}

th {
  background-color: #2c5282;
  color: white;
  font-weight: bold;
  padding: 8pt;
  text-align: left;
  border: 1px solid #1a365d;
}

td {
  padding: 6pt 8pt;
  border: 1px solid #ccc;
  vertical-align: top;
}

tr:nth-child(even) {
  background-color: #f7fafc;
}

.page-break {
  page-break-after: always;
}

.volume-break {
  page-break-before: always;
  margin-top: 0;
}

.cover-page {
  text-align: center;
  margin-top: 100pt;
}

.cover-page h1 {
  border: none;
  font-size: 24pt;
  margin: 20pt 0;
  page-break-before: avoid;
}

.header {
  text-align: right;
  font-size: 10pt;
  color: #666;
  margin-bottom: 12pt;
  padding-bottom: 6pt;
  border-bottom: 1px solid #ccc;
}

.footer {
  text-align: center;
  font-size: 10pt;
  color: #666;
  margin-top: 24pt;
  padding-top: 6pt;
  border-top: 1px solid #ccc;
}

@media print {
  body { margin: 1in; }
  .page-break { page-break-after: always; }
  .volume-break { page-break-before: always; }
}
</style>
</head>
<body>

<!-- Cover Page & TOC -->
${sections.coverAndToc}

<div class="page-break"></div>

<!-- Executive Summary -->
<div class="header">${solicitationNum} - ${company.name} - Executive Summary</div>
${sections.executiveSummary}

<div class="page-break volume-break"></div>

<!-- Technical Approach -->
<div class="header">${solicitationNum} - ${company.name} - Volume I: Technical Approach</div>
<h1>VOLUME I: TECHNICAL APPROACH</h1>
${sections.technicalApproach}

<div class="page-break volume-break"></div>

<!-- Management Approach -->
<div class="header">${solicitationNum} - ${company.name} - Volume II: Management Approach</div>
<h1>VOLUME II: MANAGEMENT APPROACH</h1>
${sections.managementApproach}

<div class="page-break volume-break"></div>

<!-- Past Performance -->
<div class="header">${solicitationNum} - ${company.name} - Volume III: Past Performance</div>
<h1>VOLUME III: PAST PERFORMANCE</h1>
${sections.pastPerformanceVolume}

<div class="page-break volume-break"></div>

<!-- Pricing -->
<div class="header">${solicitationNum} - ${company.name} - Volume IV: Price Proposal</div>
<h1>VOLUME IV: PRICE PROPOSAL</h1>
${sections.pricing}

<div class="page-break volume-break"></div>

<!-- Compliance Matrix -->
<div class="header">${solicitationNum} - ${company.name} - Appendix A: Compliance Matrix</div>
<h1>APPENDIX A: COMPLIANCE MATRIX</h1>
${sections.complianceMatrix}

<div class="page-break"></div>

<!-- Appendices -->
<div class="header">${solicitationNum} - ${company.name} - Appendices</div>
${sections.appendices}

</body>
</html>`
}

// ============================================================================
// MAIN PROCESSOR - OPTIMIZED FOR SPEED
// ============================================================================

/**
 * Main proposal processing function - OPTIMIZED
 * Runs RFP extraction and company fetch in parallel
 * Starts appendices early (doesn't need RFP data)
 * Assembles HTML locally (no Claude call)
 */
export async function processProposal(
    jobId: string,
    rfpText: string,
    companyId: string,
    email?: string
): Promise<void> {
    console.log(`[Job ${jobId}] Starting OPTIMIZED proposal processing...`)
    console.log(`[Job ${jobId}] RFP text length: ${rfpText?.length || 0} characters`)
    
    const sectionsCompleted: string[] = []
    let completedSectionCount = 0
    const totalSections = 8

    const trackSection = async (sectionName: string) => {
        completedSectionCount++
        sectionsCompleted.push(sectionName)
        const progress = 10 + Math.round((completedSectionCount / totalSections) * 80)
        console.log(`[Job ${jobId}] ✓ ${sectionName} complete (${completedSectionCount}/${totalSections})`)
        await updateJobProgress(jobId, progress, `Generated ${sectionName}`, sectionsCompleted)
    }

    try {
        // ====================================================================
        // PHASE 1: PARALLEL INITIALIZATION (RFP + Company data simultaneously)
        // ====================================================================
        console.log(`[Job ${jobId}] Phase 1: Starting parallel data loading...`)
        await updateJobProgress(jobId, 5, 'Loading data in parallel...')

        // Start both in parallel
        const extractionPrompt = createRfpExtractionPrompt(rfpText)
        
        const [rfpExtractionResult, companyData] = await Promise.all([
            // RFP Extraction (slower - ~60-90 seconds)
            callClaude({
                system: extractionPrompt.system,
                userPrompt: extractionPrompt.userPrompt,
                temperature: 0.3,
                maxTokens: 8000,
            }),
            // Company data fetch (fast - ~1 second)
            fetchCompanyData(companyId),
        ])

        console.log(`[Job ${jobId}] Company data loaded: ${companyData.company.name}`)
        
        // Parse RFP data
        const rfpData = parseClaudeJson(rfpExtractionResult)
        console.log(`[Job ${jobId}] RFP parsed: ${rfpData.metadata?.solicitationNum}`)
        
        sectionsCompleted.push('RFP Analysis', 'Company Data Loaded')
        await updateJobProgress(jobId, 10, 'Data loaded, generating sections...', sectionsCompleted, {
            rfp_metadata: {
                agency: rfpData.metadata?.agency || 'Unknown Agency',
                solicitationNum: rfpData.metadata?.solicitationNum || 'Unknown',
                deadline: rfpData.metadata?.deadline || 'Not specified',
            },
        })

        // Check for cancellation
        if (await isJobCancelled(jobId)) {
            console.log(`[Job ${jobId}] Cancelled by user`)
            return
        }

        // ====================================================================
        // PHASE 2: GENERATE ALL 8 SECTIONS IN PARALLEL
        // ====================================================================
        console.log(`[Job ${jobId}] Phase 2: Generating all 8 sections in parallel...`)

        // Create all prompts
        const prompts = {
            executiveSummary: createExecutiveSummaryPrompt(rfpData, companyData),
            technicalApproach: createTechnicalApproachPrompt(rfpData, companyData),
            managementApproach: createManagementApproachPrompt(rfpData, companyData),
            pastPerformance: createPastPerformancePrompt(rfpData, companyData),
            complianceMatrix: createComplianceMatrixPrompt(rfpData),
            coverAndToc: createCoverAndTocPrompt(rfpData, companyData),
            pricing: createPricingPrompt(rfpData, companyData),
            appendices: createAppendicesPrompt(companyData),
        }

        // Execute ALL sections in parallel
        const [
            executiveSummaryResult,
            technicalApproachResult,
            managementApproachResult,
            pastPerformanceResult,
            complianceMatrixResult,
            coverAndTocResult,
            pricingResult,
            appendicesResult,
        ] = await Promise.all([
            callClaude({
                system: prompts.executiveSummary.system,
                userPrompt: prompts.executiveSummary.userPrompt,
                temperature: 0.7,
                maxTokens: 16000,
            }).then(async (r) => { await trackSection('Executive Summary'); return r }),

            callClaude({
                system: prompts.technicalApproach.system,
                userPrompt: prompts.technicalApproach.userPrompt,
                temperature: 0.7,
                maxTokens: 32000, // Reduced for faster response
            }).then(async (r) => { await trackSection('Technical Approach'); return r }),

            callClaude({
                system: prompts.managementApproach.system,
                userPrompt: prompts.managementApproach.userPrompt,
                temperature: 0.7,
                maxTokens: 24000, // Reduced for faster response
            }).then(async (r) => { await trackSection('Management Approach'); return r }),

            callClaude({
                system: prompts.pastPerformance.system,
                userPrompt: prompts.pastPerformance.userPrompt,
                temperature: 0.7,
                maxTokens: 24000, // Reduced for faster response
            }).then(async (r) => { await trackSection('Past Performance'); return r }),

            callClaude({
                system: prompts.complianceMatrix.system,
                userPrompt: prompts.complianceMatrix.userPrompt,
                temperature: 0.5,
                maxTokens: 8000,
            }).then(async (r) => { await trackSection('Compliance Matrix'); return r }),

            callClaude({
                system: prompts.coverAndToc.system,
                userPrompt: prompts.coverAndToc.userPrompt,
                temperature: 0.5,
                maxTokens: 4000,
            }).then(async (r) => { await trackSection('Cover & TOC'); return r }),

            callClaude({
                system: prompts.pricing.system,
                userPrompt: prompts.pricing.userPrompt,
                temperature: 0.5,
                maxTokens: 12000,
            }).then(async (r) => { await trackSection('Pricing'); return r }),

            callClaude({
                system: prompts.appendices.system,
                userPrompt: prompts.appendices.userPrompt,
                temperature: 0.5,
                maxTokens: 12000,
            }).then(async (r) => { await trackSection('Appendices'); return r }),
        ])

        // Check for cancellation
        if (await isJobCancelled(jobId)) {
            console.log(`[Job ${jobId}] Cancelled by user`)
            return
        }

        // ====================================================================
        // PHASE 3: LOCAL HTML ASSEMBLY (NO Claude call - instant!)
        // ====================================================================
        console.log(`[Job ${jobId}] Phase 3: Assembling final document locally...`)
        await updateJobProgress(jobId, 95, 'Assembling final document...', sectionsCompleted)

        const finalHtml = assembleProposalHtml(rfpData, companyData, {
            coverAndToc: coverAndTocResult,
            executiveSummary: executiveSummaryResult,
            technicalApproach: technicalApproachResult,
            managementApproach: managementApproachResult,
            pastPerformanceVolume: pastPerformanceResult,
            pricing: pricingResult,
            complianceMatrix: complianceMatrixResult,
            appendices: appendicesResult,
        })

        // Extract contract value from pricing
        const contractValueMatch = pricingResult.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M))?/gi)
        const contractValue = contractValueMatch ? contractValueMatch[contractValueMatch.length - 1] : 'TBD'

        // ====================================================================
        // PHASE 4: SAVE TO DATABASE
        // ====================================================================
        console.log(`[Job ${jobId}] Phase 4: Saving to database...`)
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase
            .from('proposal_jobs') as any)
            .update({
                status: 'completed',
                progress_percent: 100,
                current_step: 'Complete',
                sections_completed: [...sectionsCompleted, 'Final Assembly'],
                executive_summary: executiveSummaryResult,
                technical_approach: technicalApproachResult,
                management_approach: managementApproachResult,
                past_performance_volume: pastPerformanceResult,
                compliance_matrix: complianceMatrixResult,
                cover_and_toc: coverAndTocResult,
                pricing: pricingResult,
                appendices: appendicesResult,
                final_html: finalHtml,
                rfp_metadata: {
                    agency: rfpData.metadata?.agency || 'Unknown Agency',
                    solicitationNum: rfpData.metadata?.solicitationNum || 'Unknown',
                    deadline: rfpData.metadata?.deadline || 'Not specified',
                    contractValue: contractValue,
                    totalPages: 143, // Estimated
                },
                completed_at: new Date().toISOString(),
            })
            .eq('job_id', jobId)

        if (email) {
            console.log(`[Job ${jobId}] Would send notification to: ${email}`)
        }

        console.log(`[Job ${jobId}] ✅ PROPOSAL GENERATION COMPLETE!`)

    } catch (error) {
        console.error(`[Job ${jobId}] ❌ PROPOSAL GENERATION FAILED:`)
        console.error(`[Job ${jobId}] Error:`, error)
        if (error instanceof Error) {
            console.error(`[Job ${jobId}] Message:`, error.message)
            console.error(`[Job ${jobId}] Stack:`, error.stack)
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        await markJobFailed(jobId, errorMessage)
        throw error
    }
}
