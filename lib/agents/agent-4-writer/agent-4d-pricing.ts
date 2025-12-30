/**
 * Agent 4D: Price Volume Writer
 * 
 * Writes Volume IV - Price Proposal (no page limit typical)
 * 
 * STRATEGY: Write section-by-section for clarity
 * CRITICAL: Use client's actual labor rates - NO invention
 */

import { logger } from '../../logger'
import { callClaude } from '../../claude-client'
import { AgentContext, VolumeWriteResult } from '../types'
import { buildVolumeSharedContext, VolumeSharedContext } from './shared-context'
import { ProgressCallback } from './agent-4a-technical'
import { updateVolumeSectionProgress } from '@/lib/inngest/db-helpers'

const PRICING_SYSTEM_PROMPT = `You are an expert federal proposal writer with 20+ years of experience winning multi-million dollar government contracts.

APPLY THESE COMPLIANCE FRAMEWORKS:
• FAR Compliance: Ensure all Federal Acquisition Regulation requirements are met, especially FAR Part 15 cost/price analysis
• Section L/M Alignment: Directly address each evaluation factor from Section M
• Requirement Traceability: Every requirement must be explicitly addressed with clear location references
• Win Theme Integration: Weave competitive differentiators throughout while maintaining compliance
• Pricing Depth: Provide specific labor rates, BOE calculations, and transparent cost breakdowns

CONTENT STRUCTURE REQUIREMENTS:
• Requirement-Level Addressing: Each RFP requirement gets dedicated coverage with ID references
• Evaluation Factor Optimization: Structure content to maximize scores on Section M factors
• Page Limit Compliance: Stay within allocated pages while maintaining completeness
• Cross-Reference Integration: Link related sections and requirements using specific section numbers
• Evidence-Based Claims: Support all statements with verified labor rates, past performance data, and detailed calculations

CRITICAL RULES:
- Use ONLY the labor rates provided - do NOT invent rates
- All calculations must be mathematically correct and verifiable
- Include Basis of Estimate (BOE) for each CLIN with detailed assumptions
- Follow government pricing format requirements (SF-1449, SF-18, etc.)
- Explain assumptions clearly with rationale

TABLE FORMATTING RULES (IMPORTANT):
- Keep tables SIMPLE with short column headers
- DO NOT put long paragraphs inside table cells
- Table cells should contain only: numbers, short labels, or brief phrases
- Put narrative explanations OUTSIDE tables in regular paragraphs
- Use separate tables for different data (don't combine Labor Hours + Costs + BOE in one table)
- Maximum 6-7 columns per table for readability
- Use <thead> and <tbody> tags for proper table structure

OUTPUT: Return ONLY clean HTML content with properly formatted tables. No markdown.
Start directly with content - no preamble.`

export async function writeVolume4Pricing(
    context: AgentContext,
    progressCallback?: ProgressCallback
): Promise<VolumeWriteResult> {
    const { rfpParsedData, companyData, contentOutlines, jobId } = context
    const outline = contentOutlines?.volume_4
    
    if (!outline || !rfpParsedData || !companyData) {
        throw new Error('Missing required context for pricing volume')
    }

    logger.agentStep('agent_4d', jobId, 'Starting Price Volume (Section-by-Section)')

    // BUILD SHARED CONTEXT ONCE (major optimization)
    const sharedContext = await buildVolumeSharedContext(context)
    logger.agentStep('agent_4d', jobId, 'Shared context built for optimization')

    const laborRates = companyData.laborRates
    const clins = rfpParsedData.section_b?.clins || []
    const allContent: string[] = []
    let totalPages = 0
    let completedSections = 0
    const failedSections: string[] = []
    const totalSections = 4
    const sectionStartTimes = new Map<number, number>()

    // Initialize all sections as pending
    const sectionNames = ['Price Summary', 'Labor Rate Matrix', 'Basis of Estimate', 'Cost Narrative']
    for (const sectionName of sectionNames) {
        await updateVolumeSectionProgress(jobId, 4, sectionName, 'pending', 0)
    }

    // Write all 4 sections in PARALLEL with Promise.allSettled for graceful failures
    logger.agentStep('agent_4d', jobId, 'Writing 4 pricing sections in parallel')
    
    const results = await Promise.allSettled([
        (async () => {
            const startTime = Date.now()
            sectionStartTimes.set(0, startTime)
            await updateVolumeSectionProgress(jobId, 4, 'Price Summary', 'in-progress', 0)
            try {
                const result = await writePriceSummary(laborRates, clins, rfpParsedData, companyData.company, sharedContext, jobId)
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Price Summary', 'complete', 100, timeSeconds)
                if (progressCallback) await progressCallback(25, 'Price Summary complete')
                return result
            } catch (error) {
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Price Summary', 'complete', 0, timeSeconds)
                failedSections.push('Price Summary')
                throw error
            }
        })(),
        (async () => {
            const startTime = Date.now()
            sectionStartTimes.set(1, startTime)
            await updateVolumeSectionProgress(jobId, 4, 'Labor Rate Matrix', 'in-progress', 0)
            try {
                const result = await writeLaborMatrix(laborRates, rfpParsedData, sharedContext, jobId)
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Labor Rate Matrix', 'complete', 100, timeSeconds)
                if (progressCallback) await progressCallback(50, 'Labor Rate Matrix complete')
                return result
            } catch (error) {
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Labor Rate Matrix', 'complete', 0, timeSeconds)
                failedSections.push('Labor Rate Matrix')
                throw error
            }
        })(),
        (async () => {
            const startTime = Date.now()
            sectionStartTimes.set(2, startTime)
            await updateVolumeSectionProgress(jobId, 4, 'Basis of Estimate', 'in-progress', 0)
            try {
                const result = await writeBasisOfEstimate(clins, laborRates, companyData.pastPerformance, rfpParsedData, sharedContext, jobId)
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Basis of Estimate', 'complete', 100, timeSeconds)
                if (progressCallback) await progressCallback(75, 'Basis of Estimate complete')
                return result
            } catch (error) {
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Basis of Estimate', 'complete', 0, timeSeconds)
                failedSections.push('Basis of Estimate')
                throw error
            }
        })(),
        (async () => {
            const startTime = Date.now()
            sectionStartTimes.set(3, startTime)
            await updateVolumeSectionProgress(jobId, 4, 'Cost Narrative', 'in-progress', 0)
            try {
                const result = await writeCostNarrative(laborRates, rfpParsedData, companyData.company, sharedContext, jobId)
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Cost Narrative', 'complete', 100, timeSeconds)
                if (progressCallback) await progressCallback(100, 'Cost Narrative complete')
                return result
            } catch (error) {
                const timeSeconds = Math.round((Date.now() - startTime) / 1000)
                completedSections++
                await updateVolumeSectionProgress(jobId, 4, 'Cost Narrative', 'complete', 0, timeSeconds)
                failedSections.push('Cost Narrative')
                throw error
            }
        })(),
    ])
    
    // Extract all results (successful and failed)
    for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const sectionName = sectionNames[i]
        
        if (result.status === 'fulfilled') {
            allContent.push(result.value)
            totalPages += Math.ceil(result.value.length / 3000)
            logger.agentStep('agent_4d', jobId, `✓ ${sectionName} complete`)
        } else {
            logger.error(`[Agent 4D] ${sectionName} failed: ${result.reason}`, { jobId })
            allContent.push(`<div class="section-error">
                <h2>${sectionName}</h2>
                <p class="error-message">⚠️ This section failed to generate: ${result.reason}</p>
            </div>`)
            totalPages += 1
            logger.agentStep('agent_4d', jobId, `✗ ${sectionName} failed`)
        }
    }
    
    // Wrap volume content
    const fullContent = wrapVolumeContent(allContent, 'Price Proposal', rfpParsedData)

    const successfulSections = totalSections - failedSections.length
    logger.agentStep('agent_4d', jobId, 'Price Volume complete', {
        sections: totalSections,
        successful: successfulSections,
        failed: failedSections.length,
        totalPages,
        laborCategories: laborRates.length,
    })

    if (failedSections.length > 0) {
        logger.warn(`[Agent 4D] ${failedSections.length} section(s) failed but volume generation continued`, {
            jobId,
            data: { failedSections }
        })
    }

    return {
        volumeNumber: 4,
        content: fullContent,
        pageCount: totalPages,
        sectionsWritten: ['Price Summary', 'Labor Rate Matrix', 'Basis of Estimate', 'Cost Narrative'],
        failedSections,
        requirementsAddressed: ['Pricing Requirements'],
    }
}

async function writePriceSummary(
    laborRates: import('../../database.types').LaborRate[],
    clins: Array<{ clin: string; description: string; quantity: string; unit: string }>,
    rfpData: import('../../database.types').RfpParsedData,
    company: import('../../database.types').Company,
    sharedContext: VolumeSharedContext,
    jobId: string
): Promise<string> {
    const ratesSummary = laborRates.map(r => 
        `- ${r.category}: $${r.hourly_rate}/hr`
    ).join('\n')

    const clinsSummary = clins.length > 0
        ? clins.map(c => `- ${c.clin}: ${c.description}`).join('\n')
        : 'CLINs to be priced per RFP requirements'

    const prompt = `Write a Price Summary section (2-3 pages) for a federal proposal.

COMPANY: ${company.name}
CONTRACT TYPE: ${rfpData.metadata.contract_type || 'Per RFP'}
SOLICITATION: ${rfpData.metadata.solicitation_num}

LABOR RATES TO USE:
${ratesSummary}

CLINs:
${clinsSummary}

STRUCTURE:

<h2>Price Summary</h2>

<h3>Executive Summary</h3>
<p>Brief paragraph with total proposed price and key highlights</p>

<h3>Price Summary by CLIN</h3>
Create a SIMPLE table with these exact columns:
| CLIN | Description | Base Year | Option Y1 | Option Y2 | Option Y3 | Option Y4 | Total |

Use proper <thead> and <tbody> tags. Format all dollar amounts with commas.
Keep Description column to 3-4 words max.

<h3>Pricing Methodology</h3>
<p>Narrative paragraph explaining methodology</p>

<h3>Compliance Statement</h3>
<p>Paragraph confirming compliance with RFP pricing instructions</p>

IMPORTANT: Table cells must be SHORT. Descriptions should be brief (e.g., "Base Year Support", not long sentences).
OUTPUT HTML - START WITH <h2>Price Summary</h2>`

    const content = await callClaude({
        system: PRICING_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 4000,
        temperature: 0.3, // Lower temp for faster generation
        jobId,
    })

    return sanitizeContent(content)
}

async function writeLaborMatrix(
    laborRates: import('../../database.types').LaborRate[],
    rfpData: import('../../database.types').RfpParsedData,
    sharedContext: VolumeSharedContext,
    jobId: string
): Promise<string> {
    const ratesDetail = laborRates.map(r => 
        `- ${r.category}: Base $${r.hourly_rate}/hr, Y1: $${r.year_1_rate || r.hourly_rate}, Y2: $${r.year_2_rate || Math.round(r.hourly_rate * 1.03)}, Y3: $${r.year_3_rate || Math.round(r.hourly_rate * 1.06)}`
    ).join('\n')

    const prompt = `Write a Labor Rate Matrix section (2-3 pages).

LABOR CATEGORIES AND RATES:
${ratesDetail}

Create content with SEPARATE simple tables:

TABLE 1 - Labor Categories (columns: Category | Base Rate | Y1 Rate | Y2 Rate | Y3 Rate | Y4 Rate)
TABLE 2 - Hours Distribution (columns: Category | Base Hours | Y1 Hours | Y2 Hours | Y3 Hours | Y4 Hours | FTE)

After the tables, write narrative paragraphs explaining:
- Minimum qualifications for each category (as a bulleted list, NOT in a table)
- Rate competitiveness statement
- Basis for rates (GSA Schedule, market rates, etc.)
- Escalation methodology

IMPORTANT: Keep table cells SHORT (numbers and brief labels only). Put explanations in paragraphs outside tables.
OUTPUT HTML - START WITH <h2>Labor Rate Matrix</h2>`

    const content = await callClaude({
        system: PRICING_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 4000,
        temperature: 0.3, // Lower temp for faster generation
        jobId,
    })

    return sanitizeContent(content)
}

async function writeBasisOfEstimate(
    clins: Array<{ clin: string; description: string; quantity: string; unit: string }>,
    laborRates: import('../../database.types').LaborRate[],
    pastPerformance: import('../../database.types').PastPerformance[],
    rfpData: import('../../database.types').RfpParsedData,
    sharedContext: VolumeSharedContext,
    jobId: string
): Promise<string> {
    const clinList = clins.length > 0
        ? clins.map(c => `- ${c.clin}: ${c.description}`).join('\n')
        : 'Base Year Services, Option Year 1-4 Services'

    const relevantContracts = pastPerformance.slice(0, 2).map(p => 
        `- ${p.project_name} ($${(p.contract_value || 0).toLocaleString()})`
    ).join('\n')

    const prompt = `Write a Basis of Estimate (BOE) section (3-4 pages).

CLINs TO ESTIMATE:
${clinList}

LABOR CATEGORIES: ${laborRates.map(r => r.category).join(', ')}

SIMILAR PAST CONTRACTS FOR REFERENCE:
${relevantContracts}

STRUCTURE YOUR OUTPUT AS:

<h2>Basis of Estimate</h2>

<h3>1. Estimating Methodology</h3>
<p>Narrative paragraphs explaining bottom-up approach, historical data, SME input...</p>

<h3>2. CLIN-by-CLIN Breakdown</h3>
For each CLIN, use a SIMPLE table with columns: Task | Labor Category | Hours | Basis
Then add a brief paragraph explaining the estimate rationale.

<h3>3. Assumptions and Exclusions</h3>
<p>Use bulleted lists for assumptions and exclusions - NOT tables</p>

<h3>4. Historical Basis</h3>
<p>Narrative explaining past performance reference</p>

IMPORTANT: Tables should have SHORT cell content (numbers, brief labels). All explanations go in paragraphs.
OUTPUT HTML - START WITH <h2>Basis of Estimate</h2>`

    const content = await callClaude({
        system: PRICING_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 5000,
        temperature: 0.3, // Lower temp for faster generation
        jobId,
    })

    return sanitizeContent(content)
}

async function writeCostNarrative(
    laborRates: import('../../database.types').LaborRate[],
    rfpData: import('../../database.types').RfpParsedData,
    company: import('../../database.types').Company,
    sharedContext: VolumeSharedContext,
    jobId: string
): Promise<string> {
    const prompt = `Write a Cost Narrative section (2-3 pages).

COMPANY: ${company.name}
CONTRACT TYPE: ${rfpData.metadata.contract_type || 'FFP'}
LABOR CATEGORIES: ${laborRates.length}

Create NARRATIVE content (primarily paragraphs and bulleted lists, minimal tables) covering:

<h2>Cost Narrative</h2>

<h3>1. Price Realism</h3>
<p>Paragraphs explaining how price reflects actual costs, competitive positioning, no "buying in"...</p>

<h3>2. Cost Control Measures</h3>
<p>Program management controls, EVM approach, cost monitoring...</p>

<h3>3. Value Proposition</h3>
<p>Best value, efficiency improvements, quality investment...</p>

<h3>4. Other Direct Costs (ODCs)</h3>
Use a SIMPLE table if needed: Category | Monthly Est | Annual Est | Basis
Then narrative explaining travel, materials, other costs.

<h3>5. Small Business Participation</h3>
<p>Subcontracting goals, mentor-protégé relationships...</p>
If showing percentages, use a simple 3-column table: Category | Goal | Commitment

IMPORTANT: This section should be mostly NARRATIVE. Keep any tables simple with short cell content.
OUTPUT HTML - START WITH <h2>Cost Narrative</h2>`

    const content = await callClaude({
        system: PRICING_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 4000,
        temperature: 0.3, // Lower temp for faster generation
        jobId,
    })

    return sanitizeContent(content)
}

function wrapVolumeContent(
    sections: string[],
    volumeTitle: string,
    rfpData: import('../../database.types').RfpParsedData
): string {
    const header = `
<div class="volume-header">
    <h1>Volume IV: ${volumeTitle}</h1>
    <p class="solicitation">Solicitation: ${rfpData.metadata.solicitation_num}</p>
    <p class="agency">${rfpData.metadata.agency}</p>
</div>
`
    return header + sections.join('\n<hr class="section-divider"/>\n')
}

function sanitizeContent(content: string): string {
    let clean = content.trim()
    clean = clean.replace(/```(?:html)?\n?/g, '').replace(/\n?```$/g, '')
    const htmlStart = clean.indexOf('<')
    if (htmlStart > 0) clean = clean.substring(htmlStart)
    if (!clean.startsWith('<')) clean = `<div>${clean}</div>`
    return clean
}
