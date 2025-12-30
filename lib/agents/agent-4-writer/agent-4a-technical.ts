/**
 * Agent 4A: Technical Volume Writer
 * 
 * Writes Volume I - Technical Approach (50 pages typical)
 * 
 * STRATEGY: Write section-by-section to avoid truncation
 * Each section = 1 Claude call with appropriate token budget
 */

import { logger } from '../../logger'
import { callClaude } from '../../claude-client'
import { AgentContext, VolumeWriteResult } from '../types'
import { SectionOutline } from '../../database.types'
import { buildVolumeSharedContext, VolumeSharedContext } from './shared-context'
import { updateVolumeSectionProgress } from '@/lib/inngest/db-helpers'

// Progress callback type for real-time section updates
export type ProgressCallback = (progress: number, step: string) => Promise<void>

const TECHNICAL_SYSTEM_PROMPT = `You are an expert federal proposal writer with 20+ years of experience winning multi-million dollar government contracts.

APPLY THESE COMPLIANCE FRAMEWORKS:
• FAR Compliance: Ensure all Federal Acquisition Regulation requirements are met
• Section L/M Alignment: Directly address each evaluation factor from Section M
• Requirement Traceability: Every requirement must be explicitly addressed with clear location references
• Win Theme Integration: Weave competitive differentiators throughout while maintaining compliance
• Technical Depth: Provide specific methodologies, tools, and processes (not generic statements)

CONTENT STRUCTURE REQUIREMENTS:
• Requirement-Level Addressing: Each RFP requirement gets dedicated coverage with ID references
• Evaluation Factor Optimization: Structure content to maximize scores on Section M factors
• Page Limit Compliance: Stay within allocated pages while maintaining completeness
• Cross-Reference Integration: Link related sections and requirements using specific section numbers
• Evidence-Based Claims: Support all statements with past performance projects, certifications, or methodologies

WRITING RULES:
- NEVER use generic buzzwords like "proven track record", "comprehensive", "robust", "innovative", "cutting-edge", "seamless"
- Use specific examples from the client's actual past work
- Use the client's actual tool names, not generic "leading platforms"
- Focus on HOW you will do the work, not just WHAT you will do
- Include specific methodologies and approaches
- Reference relevant certifications and qualifications

OUTPUT: Return ONLY clean HTML content. No markdown, no code blocks, no explanations.
Start directly with content - no preamble.`

export async function writeVolume1Technical(
    context: AgentContext,
    progressCallback?: ProgressCallback
): Promise<VolumeWriteResult> {
    const { rfpParsedData, companyData, contentOutlines, jobId } = context
    const outline = contentOutlines?.volume_1
    
    if (!outline || !rfpParsedData || !companyData) {
        throw new Error('Missing required context for technical volume')
    }

    logger.agentStep('agent_4a', jobId, 'Starting Technical Volume (Section-by-Section)')

    // BUILD SHARED CONTEXT ONCE (major optimization)
    const sharedContext = await buildVolumeSharedContext(context)
    logger.agentStep('agent_4a', jobId, 'Shared context built for optimization')

    const sections = outline.sections
    const allContent: string[] = []
    let totalPages = 0
    let completedSections = 0
    const failedSections: string[] = []
    const sectionStartTimes = new Map<number, number>()

    // Write all sections in PARALLEL with Promise.allSettled for graceful failures
    logger.agentStep('agent_4a', jobId, `Writing ${sections.length} sections in parallel`)
    
    // Initialize all sections as pending
    for (let i = 0; i < sections.length; i++) {
        await updateVolumeSectionProgress(jobId, 1, sections[i].title, 'pending', 0)
    }
    
    const createSectionProgressCallback = (sectionIndex: number, sectionTitle: string) => async (startTime: number) => {
        const endTime = Date.now()
        const timeSeconds = Math.round((endTime - startTime) / 1000)
        
        completedSections++
        await updateVolumeSectionProgress(jobId, 1, sectionTitle, 'complete', 100, timeSeconds)
        
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
            updateVolumeSectionProgress(jobId, 1, section.title, 'in-progress', 0).catch(err => {
                logger.error(`[Agent 4A] Failed to update section progress: ${err.message}`, { jobId, data: { section: section.title } })
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
                    await updateVolumeSectionProgress(jobId, 1, section.title, 'complete', 0, timeSeconds)
                    
                    logger.error(`[Agent 4A] Section ${i + 1} failed: ${error.message}`, {
                        jobId,
                        data: {
                            section: section.title,
                            error: error.message
                        }
                    })
                    failedSections.push(section.title)
                    // Return error HTML instead of failing entire volume
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
        logger.agentStep('agent_4a', jobId, `${status} Section "${sections[i].title}" ${results[i].status}`, {
            pages: sectionPages,
            chars: sectionContent.length,
        })
    }

    // Combine all sections with proper wrapping
    const fullContent = wrapVolumeContent(allContent, 'Technical Approach', rfpParsedData)

    const successfulSections = sections.length - failedSections.length
    logger.agentStep('agent_4a', jobId, 'Technical Volume complete', {
        sections: sections.length,
        successful: successfulSections,
        failed: failedSections.length,
        totalPages,
        totalChars: fullContent.length,
    })

    if (failedSections.length > 0) {
        logger.warn(`[Agent 4A] ${failedSections.length} section(s) failed but volume generation continued`, {
            jobId,
            data: { failedSections }
        })
    }

    return {
        volumeNumber: 1,
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
}

async function writeSingleSection(ctx: SectionWriteContext & { jobId: string }): Promise<string> {
    const { section, sharedContext, pageLimit, jobId } = ctx

    // Calculate appropriate token budget based on page allocation
    // ~750 tokens per page, with 30% buffer for quality, capped at 12000
    const tokensNeeded = Math.min(12000, Math.max(3000, Math.ceil(pageLimit * 750 * 1.3)))

    // Use shared context data (already pre-processed)
    const prompt = `Write the "${section.title}" section for a Technical Volume.

COMPLIANCE REQUIREMENTS (Priority Order):
${sharedContext.volumeRequirements.get(1)?.slice(0, 10).map(r => 
    `- [${r.priority.toUpperCase()}] ${r.id}: ${r.text.substring(0, 200)}`
).join('\n') || 'General technical requirements'}

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
• Use tables/charts where appropriate for evaluation clarity
• Cross-reference related sections (e.g., "See Section 3.2 for detailed staffing matrix")
• Ensure content is evaluator-friendly with clear headings and structured information
• Stay within ${pageLimit} pages (estimate ${Math.ceil(pageLimit * 3000 / 3000)} pages)

OUTPUT HTML ONLY - START DIRECTLY WITH <h2> TAG.`

    const content = await callClaude({
        system: TECHNICAL_SYSTEM_PROMPT,
        userPrompt: prompt,
        maxTokens: tokensNeeded,
        temperature: 0.3, // Lower temp for faster, more focused generation
        jobId, // Enable heartbeat during long calls
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
    <h1>Volume I: ${volumeTitle}</h1>
    <p class="solicitation">Solicitation: ${rfpData.metadata.solicitation_num}</p>
    <p class="agency">${rfpData.metadata.agency}</p>
</div>
`
    return header + sections.join('\n<hr class="section-divider"/>\n')
}

function sanitizeContent(content: string): string {
    let clean = content.trim()
    
    // Remove markdown code blocks
    clean = clean.replace(/```(?:html)?\n?/g, '').replace(/\n?```$/g, '')
    
    // Remove any leading text before HTML
    const htmlStart = clean.indexOf('<')
    if (htmlStart > 0) {
        clean = clean.substring(htmlStart)
    }
    
    // Ensure content is wrapped
    if (!clean.startsWith('<')) {
        clean = `<div>${clean}</div>`
    }
    
    return clean
}
