/**
 * Agent 4C: Past Performance Volume Writer
 * 
 * Writes Volume III - Past Performance (25 pages typical)
 * 
 * STRATEGY: Write one contract at a time to ensure completeness
 * CRITICAL: Use ONLY verified contracts from company data - NO invention
 */

import { logger } from '../../logger'
import { callClaude } from '../../claude-client'
import { AgentContext, VolumeWriteResult } from '../types'
import { buildVolumeSharedContext, VolumeSharedContext } from './shared-context'
import { ProgressCallback } from './agent-4a-technical'
import { updateVolumeSectionProgress } from '@/lib/inngest/db-helpers'

const PAST_PERFORMANCE_SYSTEM_PROMPT = `You are an expert federal proposal writer with 20+ years of experience winning multi-million dollar government contracts.

APPLY THESE COMPLIANCE FRAMEWORKS:
• FAR Compliance: Ensure all Federal Acquisition Regulation requirements are met
• Section L/M Alignment: Directly address each evaluation factor from Section M
• Requirement Traceability: Every requirement must be explicitly addressed with clear location references
• Win Theme Integration: Weave competitive differentiators throughout while maintaining compliance
• Past Performance Depth: Provide specific project details, quantified outcomes, and clear relevance to current RFP

CONTENT STRUCTURE REQUIREMENTS:
• Requirement-Level Addressing: Each RFP requirement gets dedicated coverage with ID references
• Evaluation Factor Optimization: Structure content to maximize scores on Section M factors
• Page Limit Compliance: Stay within allocated pages while maintaining completeness
• Cross-Reference Integration: Link related sections and requirements using specific section numbers
• Evidence-Based Claims: Support all statements with verified contract data, POC information, and quantified outcomes

CRITICAL RULES:
- Use ONLY the contract information provided - do NOT invent contracts
- Include all POC information exactly as provided
- Quantify outcomes with specific numbers from the data
- Show relevance to the current RFP requirements with explicit mapping
- Follow CPARS-style formatting with clear sections
- Include lessons learned where appropriate

OUTPUT: Return ONLY clean HTML content. No markdown, no code blocks.
Start directly with content - no preamble.`

export async function writeVolume3PastPerformance(
    context: AgentContext,
    progressCallback?: ProgressCallback
): Promise<VolumeWriteResult> {
    const { rfpParsedData, companyData, contentOutlines, jobId } = context
    const outline = contentOutlines?.volume_3
    
    if (!outline || !rfpParsedData || !companyData) {
        throw new Error('Missing required context for past performance volume')
    }

    logger.agentStep('agent_4c', jobId, 'Starting Past Performance Volume')

    // BUILD SHARED CONTEXT ONCE (major optimization)
    const sharedContext = await buildVolumeSharedContext(context)
    logger.agentStep('agent_4c', jobId, 'Shared context built for optimization')

    const pastPerformance = companyData.pastPerformance
    const allContent: string[] = []
    let totalPages = 0
    let completedSections = 0
    const failedSections: string[] = []
    
    const contractsToWrite = pastPerformance.slice(0, Math.min(pastPerformance.length, 5))
    const totalSections = 2 + contractsToWrite.length // summary + contracts + matrix

    // Initialize sections as pending
    await updateVolumeSectionProgress(jobId, 3, 'Summary', 'pending', 0)
    for (let i = 0; i < contractsToWrite.length; i++) {
        await updateVolumeSectionProgress(jobId, 3, contractsToWrite[i].project_name, 'pending', 0)
    }
    await updateVolumeSectionProgress(jobId, 3, 'Relevance Matrix', 'pending', 0)

    // 1. Write summary/overview section
    logger.agentStep('agent_4c', jobId, 'Writing Past Performance Summary')
    const summaryStartTime = Date.now()
    await updateVolumeSectionProgress(jobId, 3, 'Summary', 'in-progress', 0)
    
    try {
        const summaryContent = await writeSummarySection(pastPerformance, rfpParsedData, companyData.company, sharedContext, jobId)
        allContent.push(summaryContent)
        totalPages += Math.ceil(summaryContent.length / 3000)
        completedSections++
        
        const summaryTimeSeconds = Math.round((Date.now() - summaryStartTime) / 1000)
        await updateVolumeSectionProgress(jobId, 3, 'Summary', 'complete', 100, summaryTimeSeconds)
        
        if (progressCallback) {
            await progressCallback(Math.round((completedSections / totalSections) * 100), 'Summary complete')
        }
    } catch (error) {
        const summaryTimeSeconds = Math.round((Date.now() - summaryStartTime) / 1000)
        await updateVolumeSectionProgress(jobId, 3, 'Summary', 'complete', 0, summaryTimeSeconds)
        
        logger.error(`[Agent 4C] Summary section failed: ${error instanceof Error ? error.message : String(error)}`, { jobId })
        failedSections.push('Summary')
        allContent.push(`<div class="section-error"><h2>Past Performance Summary</h2><p>⚠️ Section failed to generate</p></div>`)
        completedSections++
    }

    // 2. Write all contracts in PARALLEL with Promise.allSettled for graceful failures
    const pagesPerContract = Math.floor((outline.page_limit - 3) / Math.min(pastPerformance.length, 5))
    const contractStartTimes = new Map<number, number>()
    
    logger.agentStep('agent_4c', jobId, `Writing ${contractsToWrite.length} contracts in parallel`)
    
    const results = await Promise.allSettled(
        contractsToWrite.map((contract, i) => {
            const startTime = Date.now()
            contractStartTimes.set(i, startTime)
            updateVolumeSectionProgress(jobId, 3, contract.project_name, 'in-progress', 0).catch(err => {
                logger.error(`[Agent 4C] Failed to update section progress: ${err.message}`, { jobId, data: { section: contract.project_name } })
            })
            
            return writeContractSection(contract, rfpParsedData, sharedContext, pagesPerContract, jobId)
                .then(async result => {
                    const endTime = Date.now()
                    const timeSeconds = Math.round((endTime - startTime) / 1000)
                    completedSections++
                    await updateVolumeSectionProgress(jobId, 3, contract.project_name, 'complete', 100, timeSeconds)
                    
                    if (progressCallback) {
                        await progressCallback(
                            Math.round((completedSections / totalSections) * 100),
                            `Contract ${i + 1}/${contractsToWrite.length} complete: ${contract.project_name}`
                        )
                    }
                    return result
                })
                .catch(async (error: unknown) => {
                    const endTime = Date.now()
                    const startTime = contractStartTimes.get(i) || endTime
                    const timeSeconds = Math.round((endTime - startTime) / 1000)
                    completedSections++
                    await updateVolumeSectionProgress(jobId, 3, contract.project_name, 'complete', 0, timeSeconds)
                    
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    logger.error(`[Agent 4C] Contract "${contract.project_name}" failed: ${errorMessage}`, { jobId })
                    failedSections.push(contract.project_name)
                    return `<div class="section-error">
                        <h2>${contract.project_name}</h2>
                        <p class="error-message">⚠️ This contract failed to generate: ${errorMessage}</p>
                    </div>`
                })
        })
    )
    
    // Extract all results
    const contractContents = results.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
    )
    
    // Add all contract contents
    for (let i = 0; i < contractContents.length; i++) {
        const contractContent = contractContents[i]
        allContent.push(contractContent)
        
        const pages = Math.ceil(contractContent.length / 3000)
        totalPages += pages
        
        const status = results[i].status === 'fulfilled' ? '✓' : '✗'
        logger.agentStep('agent_4c', jobId, `${status} Contract "${contractsToWrite[i].project_name}" ${results[i].status}`, { pages })
    }

    // 3. Write relevance matrix
    logger.agentStep('agent_4c', jobId, 'Writing Relevance Matrix')
    const matrixStartTime = Date.now()
    await updateVolumeSectionProgress(jobId, 3, 'Relevance Matrix', 'in-progress', 0)
    
    try {
        const matrixContent = await writeRelevanceMatrix(pastPerformance, rfpParsedData, sharedContext, jobId)
        allContent.push(matrixContent)
        totalPages += Math.ceil(matrixContent.length / 3000)
        completedSections++
        
        const matrixTimeSeconds = Math.round((Date.now() - matrixStartTime) / 1000)
        await updateVolumeSectionProgress(jobId, 3, 'Relevance Matrix', 'complete', 100, matrixTimeSeconds)
        
        if (progressCallback) {
            await progressCallback(100, 'Relevance Matrix complete')
        }
    } catch (error) {
        const matrixTimeSeconds = Math.round((Date.now() - matrixStartTime) / 1000)
        await updateVolumeSectionProgress(jobId, 3, 'Relevance Matrix', 'complete', 0, matrixTimeSeconds)
        
        logger.error(`[Agent 4C] Relevance Matrix failed: ${error instanceof Error ? error.message : String(error)}`, { jobId })
        failedSections.push('Relevance Matrix')
        allContent.push(`<div class="section-error"><h2>Relevance Matrix</h2><p>⚠️ Section failed to generate</p></div>`)
        completedSections++
    }

    const fullContent = wrapVolumeContent(allContent, 'Past Performance', rfpParsedData)

    const successfulSections = totalSections - failedSections.length
    logger.agentStep('agent_4c', jobId, 'Past Performance Volume complete', {
        contracts: contractsToWrite.length,
        successful: successfulSections,
        failed: failedSections.length,
        totalPages,
    })

    if (failedSections.length > 0) {
        logger.warn(`[Agent 4C] ${failedSections.length} section(s) failed but volume generation continued`, {
            jobId,
            data: { failedSections }
        })
    }

    return {
        volumeNumber: 3,
        content: fullContent,
        pageCount: totalPages,
        sectionsWritten: ['Summary', ...pastPerformance.slice(0, 5).map(p => p.project_name), 'Relevance Matrix'],
        failedSections,
        requirementsAddressed: ['Past Performance Requirements'],
    }
}

async function writeSummarySection(
    contracts: import('../../database.types').PastPerformance[],
    rfpData: import('../../database.types').RfpParsedData,
    company: import('../../database.types').Company,
    sharedContext: VolumeSharedContext,
    jobId: string
): Promise<string> {
    const contractSummary = contracts.slice(0, 5).map(c => 
        `- ${c.project_name}: ${c.agency}, $${(c.contract_value || 0).toLocaleString()}, ${c.contract_type || 'N/A'}`
    ).join('\n')

    const prompt = `Write a Past Performance Summary section (2 pages).

EVALUATION FACTORS TO MAXIMIZE:
${sharedContext.rfpSummary.evaluationFactors.map(f => 
    `- ${f.name} (Weight: ${f.weight}%)`
).join('\n')}

COMPANY: ${company.name}
SOLICITATION: ${rfpData.metadata.solicitation_num}
AGENCY: ${rfpData.metadata.agency}

CONTRACTS TO SUMMARIZE:
${contractSummary}

Include:
1. Opening statement about ${company.name}'s relevant experience aligned with RFP requirements
2. Summary table with columns: Contract Name, Customer, Value, Type, Period, CPARS Rating
3. Brief overview of each contract's relevance to this RFP with specific requirement mappings
4. Statement about customer satisfaction trends and quality ratings

OUTPUT HTML - START WITH <h2>Past Performance Summary</h2>`

    const content = await callClaude({
        system: PAST_PERFORMANCE_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 4000,
        temperature: 0.3,
        jobId,
    })

    return sanitizeContent(content)
}

async function writeContractSection(
    contract: import('../../database.types').PastPerformance,
    rfpData: import('../../database.types').RfpParsedData,
    sharedContext: VolumeSharedContext,
    targetPages: number,
    jobId: string
): Promise<string> {
    const tokensNeeded = Math.max(2500, Math.ceil(targetPages * 750 * 1.3))

    const quantifiedOutcomes = contract.quantified_outcomes
        ?.map((o: { metric: string; value: string }) => `- ${o.metric}: ${o.value}`)
        .join('\n') || 'Outcomes documented in performance summary'

    const prompt = `Write a detailed Past Performance contract writeup (~${targetPages} pages).

CONTRACT: ${contract.project_name}
- Contract Number: ${contract.contract_number}
- Customer: ${contract.agency}${contract.customer_office ? ` / ${contract.customer_office}` : ''}
- Contract Type: ${contract.contract_type || 'Not specified'}
- Contract Value: $${(contract.contract_value || 0).toLocaleString()}
- Period: ${contract.start_date} to ${contract.end_date}
- Scope: ${contract.scope}
- Performance Summary: ${contract.performance_summary}
- CPARS Rating: ${contract.cpars_rating || 'N/A'}

POC INFORMATION:
- Name: ${contract.poc_name}
- Title: ${contract.poc_title || 'Contact'}
- Phone: ${contract.poc_phone}
- Email: ${contract.poc_email}

QUANTIFIED OUTCOMES:
${quantifiedOutcomes}

RELEVANCE TAGS: ${contract.relevance_tags?.join(', ') || 'N/A'}

Write professional content with:
1. Contract header with key info
2. Scope and objectives (what was the challenge)
3. Our approach and methods (how we solved it)
4. Results and quantified outcomes (specific numbers)
5. Customer feedback summary
6. Relevance to ${rfpData.metadata.agency} requirements
7. Lessons learned applicable to this contract

FORMAT: Use tables for key data, bullet points for outcomes.
OUTPUT HTML - START WITH <h2>${contract.project_name}</h2>`

    const content = await callClaude({
        system: PAST_PERFORMANCE_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: tokensNeeded,
        temperature: 0.3, // Lower temp for faster generation
        jobId,
    })

    return sanitizeContent(content)
}

async function writeRelevanceMatrix(
    contracts: import('../../database.types').PastPerformance[],
    rfpData: import('../../database.types').RfpParsedData,
    sharedContext: VolumeSharedContext,
    jobId: string
): Promise<string> {
    const factors = rfpData.section_m.factors.map(f => f.name).join(', ')
    const contractNames = contracts.slice(0, 5).map(c => c.project_name).join(', ')

    const prompt = `Write a Past Performance Relevance Matrix section (1-2 pages).

EVALUATION FACTORS: ${factors}
CONTRACTS: ${contractNames}

Create a table showing how each contract demonstrates capability in each evaluation factor:
- Rows: Each contract
- Columns: Each evaluation factor
- Cells: Specific evidence of capability

Also include a narrative summary explaining:
1. Overall pattern of strong performance
2. How experience directly applies to this RFP
3. Risk mitigation from lessons learned

OUTPUT HTML - START WITH <h2>Relevance Matrix</h2>`

    const content = await callClaude({
        system: PAST_PERFORMANCE_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: 3000,
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
    <h1>Volume III: ${volumeTitle}</h1>
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
