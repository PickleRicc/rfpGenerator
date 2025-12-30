/**
 * Agent 4B: Management Volume Writer
 * 
 * Writes Volume II - Management Approach (30 pages typical)
 * 
 * STRATEGY: Write section-by-section to avoid truncation
 */

import { logger } from '../../logger'
import { callClaude } from '../../claude-client'
import { AgentContext, VolumeWriteResult } from '../types'
import { SectionOutline } from '../../database.types'
import { buildVolumeSharedContext, VolumeSharedContext } from './shared-context'
import { ProgressCallback } from './agent-4a-technical'
import { updateVolumeSectionProgress } from '@/lib/inngest/db-helpers'

const MANAGEMENT_SYSTEM_PROMPT = `You are an expert federal proposal writer with 20+ years of experience winning multi-million dollar government contracts.

APPLY THESE COMPLIANCE FRAMEWORKS:
• FAR Compliance: Ensure all Federal Acquisition Regulation requirements are met
• Section L/M Alignment: Directly address each evaluation factor from Section M
• Requirement Traceability: Every requirement must be explicitly addressed with clear location references
• Win Theme Integration: Weave competitive differentiators throughout while maintaining compliance
• Management Depth: Provide specific organizational structures, processes, and personnel qualifications

CONTENT STRUCTURE REQUIREMENTS:
• Requirement-Level Addressing: Each RFP requirement gets dedicated coverage with ID references
• Evaluation Factor Optimization: Structure content to maximize scores on Section M factors
• Page Limit Compliance: Stay within allocated pages while maintaining completeness
• Cross-Reference Integration: Link related sections and requirements using specific section numbers
• Evidence-Based Claims: Support all statements with past performance projects, certifications, or methodologies

WRITING RULES:
- Focus on WHO will do the work and HOW they'll be managed
- Include specific names of key personnel with qualifications
- Reference actual company methodologies and processes
- Avoid generic project management boilerplate
- Describe org chart structure clearly with reporting relationships
- Address transition planning with specific timelines
- Include quality and risk management specifics with metrics

OUTPUT: Return ONLY clean HTML content. No markdown, no code blocks.
Start directly with content - no preamble.`

export async function writeVolume2Management(
    context: AgentContext,
    progressCallback?: ProgressCallback
): Promise<VolumeWriteResult> {
    const { rfpParsedData, companyData, contentOutlines, jobId } = context
    const outline = contentOutlines?.volume_2
    
    if (!outline || !rfpParsedData || !companyData) {
        throw new Error('Missing required context for management volume')
    }

    logger.agentStep('agent_4b', jobId, 'Starting Management Volume (Section-by-Section)')

    // BUILD SHARED CONTEXT ONCE (major optimization)
    const sharedContext = await buildVolumeSharedContext(context)
    logger.agentStep('agent_4b', jobId, 'Shared context built for optimization')

    const sections = outline.sections
    const allContent: string[] = []
    let totalPages = 0
    let completedSections = 0
    const failedSections: string[] = []
    const sectionStartTimes = new Map<number, number>()

    // Write all sections in PARALLEL with Promise.allSettled for graceful failures
    logger.agentStep('agent_4b', jobId, `Writing ${sections.length} sections in parallel`)
    
    // Initialize all sections as pending
    for (let i = 0; i < sections.length; i++) {
        await updateVolumeSectionProgress(jobId, 2, sections[i].title, 'pending', 0)
    }
    
    const createSectionProgressCallback = (sectionIndex: number, sectionTitle: string) => async (startTime: number) => {
        const endTime = Date.now()
        const timeSeconds = Math.round((endTime - startTime) / 1000)
        
        completedSections++
        await updateVolumeSectionProgress(jobId, 2, sectionTitle, 'complete', 100, timeSeconds)
        
        if (progressCallback) {
            const sectionProgress = Math.round((completedSections / sections.length) * 100)
            await progressCallback(
                sectionProgress,
                `Section ${sectionIndex + 1}/${sections.length} complete: ${sectionTitle}`
            )
        }
    }
    
    const results = await Promise.allSettled(
        sections.map((section, i) => {
            const startTime = Date.now()
            sectionStartTimes.set(i, startTime)
            
            // Mark section as in-progress
            updateVolumeSectionProgress(jobId, 2, section.title, 'in-progress', 0).catch(err => {
                logger.error(`[Agent 4B] Failed to update section progress: ${err.message}`, { jobId, data: { section: section.title } })
            })
            
            return writeSingleSection({
                section,
                sectionIndex: i,
                totalSections: sections.length,
                sharedContext,
                pageLimit: section.page_allocation,
                jobId,
            })
                .then(async result => {
                    await createSectionProgressCallback(i, section.title)(startTime)
                    return result
                })
                .catch(async error => {
                    const endTime = Date.now()
                    const startTime = sectionStartTimes.get(i) || endTime
                    const timeSeconds = Math.round((endTime - startTime) / 1000)
                    
                    completedSections++
                    await updateVolumeSectionProgress(jobId, 2, section.title, 'complete', 0, timeSeconds)
                    
                    logger.error(`[Agent 4B] Section ${i + 1} failed: ${error.message}`, {
                        jobId,
                        data: {
                            section: section.title,
                            error: error.message
                        }
                    })
                    failedSections.push(section.title)
                    return `<div class="section-error">
                        <h2>${section.title}</h2>
                        <p class="error-message">⚠️ This section failed to generate: ${error.message}</p>
                        <p class="error-note">Please retry this section or contact support.</p>
                    </div>`
                })
        })
    )
    
    // Extract all results (successful and failed)
    const sectionContents = results.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
    )
    
    // Calculate total pages
    for (let i = 0; i < sectionContents.length; i++) {
        const sectionContent = sectionContents[i]
        allContent.push(sectionContent)
        
        const sectionPages = Math.ceil(sectionContent.length / 3000)
        totalPages += sectionPages
        
        const status = results[i].status === 'fulfilled' ? '✓' : '✗'
        logger.agentStep('agent_4b', jobId, `${status} Section "${sections[i].title}" ${results[i].status}`, {
            pages: sectionPages,
        })
    }

    const fullContent = wrapVolumeContent(allContent, 'Management Approach', rfpParsedData)

    const successfulSections = sections.length - failedSections.length
    logger.agentStep('agent_4b', jobId, 'Management Volume complete', {
        sections: sections.length,
        successful: successfulSections,
        failed: failedSections.length,
        totalPages,
    })

    if (failedSections.length > 0) {
        logger.warn(`[Agent 4B] ${failedSections.length} section(s) failed but volume generation continued`, {
            jobId,
            data: { failedSections }
        })
    }

    return {
        volumeNumber: 2,
        content: fullContent,
        pageCount: totalPages,
        sectionsWritten: sections.map(s => s.title),
        failedSections,
        requirementsAddressed: sections.flatMap(s => s.requirements_addressed || []),
    }
}

interface SectionWriteContext {
    section: SectionOutline
    sectionIndex: number
    totalSections: number
    sharedContext: VolumeSharedContext
    pageLimit: number
    jobId: string
}

async function writeSingleSection(ctx: SectionWriteContext): Promise<string> {
    const { section, sharedContext, pageLimit, jobId } = ctx

    const tokensNeeded = Math.min(12000, Math.max(3000, Math.ceil(pageLimit * 750 * 1.3)))

    const prompt = `Write the "${section.title}" section for a Management Volume.

COMPLIANCE REQUIREMENTS (Priority Order):
${sharedContext.volumeRequirements.get(2)?.slice(0, 10).map(r => 
    `- [${r.priority.toUpperCase()}] ${r.id}: ${r.text.substring(0, 200)}`
).join('\n') || 'General management requirements'}

EVALUATION FACTORS TO MAXIMIZE:
${sharedContext.rfpSummary.evaluationFactors.map(f => 
    `- ${f.name} (Weight: ${f.weight}%)`
).join('\n')}

COMPANY CAPABILITIES TO HIGHLIGHT:
${sharedContext.companySummary.capabilities.slice(0, 10).join(', ')}

KEY PERSONNEL TO REFERENCE BY NAME:
${sharedContext.companySummary.keyPersonnel.slice(0, 5).map(p => 
    `- ${p.name} (${p.role}, ${p.experience} years, ${p.certs.join(', ')})`
).join('\n')}

PAST PERFORMANCE TO CITE:
${sharedContext.companySummary.pastPerformance.slice(0, 3).map(pp => 
    `- ${pp.project} (${pp.agency}): ${pp.relevance}`
).join('\n')}

CONTEXT:
- Company: ${sharedContext.companySummary.name}
- Solicitation: ${sharedContext.rfpSummary.solicitationNum}
- Agency: ${sharedContext.rfpSummary.agency}
- This is section ${ctx.sectionIndex + 1} of ${ctx.totalSections}

TARGET LENGTH: ${pageLimit} pages (~${pageLimit * 3000} characters)

${section.subsections && section.subsections.length > 0 ? `
SUBSECTIONS TO INCLUDE:
${section.subsections.map(s => `- ${s.title} (${s.page_allocation} pages)`).join('\n')}
` : ''}

SECTION WRITING REQUIREMENTS:
• Address each requirement explicitly with ID references (e.g., "Per Requirement C.3.2.1...")
• Use specific methodologies (don't say "proven approach", say "Agile/Scrum with 2-week sprints")
• Reference actual past performance projects by name and agency
• Include specific personnel names and qualifications from the list above
• Use tables/charts where appropriate for evaluation clarity (org charts, staffing matrices)
• Cross-reference related sections (e.g., "See Section 3.2 for detailed staffing matrix")
• Ensure content is evaluator-friendly with clear headings and structured information
• Stay within ${pageLimit} pages (estimate ${Math.ceil(pageLimit * 3000 / 3000)} pages)

Write professional content covering appropriate topics for "${section.title}":
- If Program Management: org structure with names, leadership approach, governance processes
- If Transition: phase-in/out plans with timelines, knowledge transfer specifics, risk mitigation
- If Quality: QA processes with metrics, continuous improvement methodologies
- If Staffing: recruitment strategies, retention programs, training approach with specifics
- If Risk: identification methods, mitigation strategies, contingency planning

OUTPUT HTML ONLY - START DIRECTLY WITH <h2> TAG.`

    const content = await callClaude({
        system: MANAGEMENT_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: tokensNeeded,
        temperature: 0.3, // Lower temp for faster, more focused generation
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
    <h1>Volume II: ${volumeTitle}</h1>
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
