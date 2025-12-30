/**
 * Volume Rewriter Agent
 * 
 * PRIMARY MISSION: Rewrite a single volume incorporating consultant insights
 * and user feedback using a two-pass strategy
 * 
 * RESPONSIBILITIES:
 * 1. Pass 1: Fix compliance gaps identified by consultant
 * 2. Pass 2: Enhance quality, readability, and win themes
 * 3. Maintain page limits and required structure
 * 4. Incorporate iteration history to avoid repeated mistakes
 * 5. Preserve high-scoring sections from previous version
 */

import { supabase } from '../supabase'
import { callClaude } from '../claude-client'
import { logger } from '../logger'
import { AgentContext, AgentResult } from './types'
import { ConsultantOutput } from './agent-consultant'

// ============================================================================
// TYPES
// ============================================================================

export interface RewriterInput {
    volume: 1 | 2 | 3 | 4
    originalContent: string
    consultantInsights: ConsultantOutput
    userFeedback?: string
    rfpRequirements: string
    iteration: number
    pageLimits: {
        maxPages: number
        currentPages: number
    }
}

export interface RewriterOutput {
    volumeNumber: number
    rewrittenContent: string
    changesApplied: Array<{
        section: string
        changeType: 'compliance_fix' | 'quality_enhancement' | 'user_feedback'
        description: string
    }>
    preservedSections: string[]
    iteration: number
}

// ============================================================================
// PROMPTS
// ============================================================================

const PASS1_SYSTEM_PROMPT = `You are an expert federal proposal writer specializing in compliance and technical accuracy.

This is PASS 1 of a two-pass rewriting process. Your ONLY job in this pass is to:
1. Fix compliance gaps identified by the consultant
2. Address specific user feedback (if provided)
3. Ensure all RFP requirements are fully met
4. Maintain proper structure and format

Do NOT focus on style, tone, or readability yet - that's Pass 2.
Do NOT remove or significantly alter sections that are already scoring well.

Return the complete rewritten volume content in HTML format, maintaining the original structure.`

const PASS2_SYSTEM_PROMPT = `You are an expert federal proposal editor specializing in quality, readability, and competitive positioning.

This is PASS 2 of a two-pass rewriting process. The compliance issues have been fixed in Pass 1.

Your job now is to:
1. Enhance readability and flow
2. Strengthen win themes and differentiators
3. Improve professional tone and persuasiveness
4. Ensure consistency and polish
5. Optimize page usage (meet max pages without going over)

Do NOT change factual content or compliance elements from Pass 1.
Do NOT add new substantive content - only refine what's there.

Return the complete polished volume content in HTML format.`

function buildPass1Prompt(input: RewriterInput): string {
    const volumeNames = ['Technical', 'Management', 'Past Performance', 'Pricing']
    const volumeName = volumeNames[input.volume - 1]
    
    let userFeedbackSection = ''
    if (input.userFeedback) {
        userFeedbackSection = `

## USER FEEDBACK (HIGHEST PRIORITY)
The user has reviewed this volume and provided specific feedback:

"${input.userFeedback}"

⚠️ CRITICAL: Address this feedback directly. The user's specific requests override consultant recommendations if they conflict.`
    }
    
    let areasToPreserve = ''
    if (input.consultantInsights.iterationContext?.areasToPreserve) {
        areasToPreserve = `

## AREAS TO PRESERVE (Do NOT modify these)
${input.consultantInsights.iterationContext.areasToPreserve.map(area => `- ${area}`).join('\n')}`
    }
    
    return `# TASK: Pass 1 Compliance Rewrite - Volume ${input.volume} (${volumeName})

## CONTEXT
- Iteration: ${input.iteration} of 5 max
- Current Score: ${input.consultantInsights.currentScore}%
- Target Score: ${input.consultantInsights.targetScore}%
- Page Limit: ${input.pageLimits.maxPages} pages (currently ${input.pageLimits.currentPages} pages)
${userFeedbackSection}
${areasToPreserve}

## COMPLIANCE GAPS TO FIX (Prioritized)
${input.consultantInsights.complianceGaps.map((gap, i) => `
### ${i + 1}. [${gap.priority.toUpperCase()}] ${gap.requirementId}
**Requirement**: ${gap.requirement}
**Current Issue**: ${gap.currentIssue}
**Recommended Fix**: ${gap.recommendedFix}
**Score Impact**: +${gap.estimatedScoreImpact} points
`).join('\n')}

## SPECIFIC RECOMMENDATIONS
${input.consultantInsights.recommendations.map((rec, i) => `
${i + 1}. **${rec.category}**: ${rec.action}
   - Rationale: ${rec.rationale}
   ${rec.exampleLanguage ? `- Example: "${rec.exampleLanguage}"` : ''}
`).join('\n')}

## RFP REQUIREMENTS (Key Sections)
${input.rfpRequirements.substring(0, 4000)}
[...truncated...]

## CURRENT VOLUME CONTENT
${input.originalContent}

---

## YOUR TASK

Rewrite the volume to address ALL identified compliance gaps and user feedback.

REQUIREMENTS:
1. Maintain the HTML structure and formatting
2. Preserve all sections that are scoring 85%+
3. Add missing required content per consultant recommendations
4. Address each compliance gap systematically
5. If user feedback was provided, prioritize it above all else
6. Stay within ${input.pageLimits.maxPages} page limit
7. Return ONLY the complete rewritten HTML content

Do NOT add explanations, comments, or markdown. Return ONLY the HTML content for the volume.`
}

function buildPass2Prompt(pass1Content: string, input: RewriterInput): string {
    const volumeNames = ['Technical', 'Management', 'Past Performance', 'Pricing']
    const volumeName = volumeNames[input.volume - 1]
    
    return `# TASK: Pass 2 Quality Enhancement - Volume ${input.volume} (${volumeName})

## CONTEXT
This volume has been rewritten in Pass 1 to fix compliance gaps. Now we need to polish and enhance quality.

## QUALITY ENHANCEMENT GOALS
1. **Readability**: Improve flow, transitions, and sentence structure
2. **Persuasiveness**: Strengthen win themes and competitive differentiators
3. **Professional Tone**: Ensure consistent, authoritative voice
4. **Clarity**: Simplify complex ideas without losing technical accuracy
5. **Page Optimization**: Use space efficiently (target ${input.pageLimits.maxPages} pages)

## STRENGTHS TO AMPLIFY
${input.consultantInsights.recommendations
    .filter(r => r.category === 'Competitive Positioning' || r.category === 'Win Themes')
    .map(r => `- ${r.action}`)
    .join('\n') || '- Maintain professional federal proposal standards'}

## PASS 1 CONTENT (Compliance-Fixed)
${pass1Content}

---

## YOUR TASK

Refine and polish the Pass 1 content for maximum impact.

REQUIREMENTS:
1. Maintain all compliance fixes from Pass 1
2. Do NOT add new substantive content
3. Enhance readability, flow, and persuasiveness
4. Ensure consistent professional tone
5. Optimize for page limit (${input.pageLimits.maxPages} pages max)
6. Return ONLY the complete polished HTML content

Do NOT add explanations, comments, or markdown. Return ONLY the HTML content for the volume.`
}

// ============================================================================
// AGENT CLASS
// ============================================================================

export class AgentRewriter {
    name = 'volume_rewriter' as const
    description = 'Rewrites volume using two-pass strategy (compliance + quality)'

    async execute(
        context: AgentContext,
        input: RewriterInput
    ): Promise<AgentResult<RewriterOutput>> {
        const volumeNames = ['Technical', 'Management', 'Past Performance', 'Pricing']
        const volumeName = volumeNames[input.volume - 1]
        
        logger.info(`[Rewriter] Starting two-pass rewrite for Volume ${input.volume} (${volumeName})`, {
            data: {
                jobId: context.jobId,
                volume: input.volume,
                iteration: input.iteration,
                hasUserFeedback: !!input.userFeedback,
                complianceGaps: input.consultantInsights.complianceGaps.length
            }
        })

        try {
            // PASS 1: Compliance Fixes
            logger.info(`[Rewriter] Pass 1: Fixing compliance gaps`, {
                data: { jobId: context.jobId, volume: input.volume }
            })
            
            const pass1Prompt = buildPass1Prompt(input)
            const pass1Content = await callClaude({
                system: PASS1_SYSTEM_PROMPT,
                userPrompt: pass1Prompt,
                maxTokens: 16000,
                jobId: context.jobId
            })

            // PASS 2: Quality Enhancement
            logger.info(`[Rewriter] Pass 2: Enhancing quality`, {
                data: { jobId: context.jobId, volume: input.volume }
            })
            
            const pass2Prompt = buildPass2Prompt(pass1Content, input)
            const finalContent = await callClaude({
                system: PASS2_SYSTEM_PROMPT,
                userPrompt: pass2Prompt,
                maxTokens: 16000,
                jobId: context.jobId
            })

            // Save rewritten volume to database
            await this.saveRewrittenVolume(context.jobId, input.volume, finalContent, input.iteration)

            // Track changes applied
            const changesApplied = this.trackChangesApplied(input)
            
            logger.info(`[Rewriter] Rewrite complete`, {
                data: {
                    jobId: context.jobId,
                    volume: input.volume,
                    iteration: input.iteration,
                    changesCount: changesApplied.length
                }
            })

            return {
                status: 'success',
                data: {
                    volumeNumber: input.volume,
                    rewrittenContent: finalContent,
                    changesApplied,
                    preservedSections: input.consultantInsights.iterationContext?.areasToPreserve || [],
                    iteration: input.iteration
                }
            }
        } catch (error) {
            logger.error(`[Rewriter] Rewrite failed`, {
                data: {
                    jobId: context.jobId,
                    volume: input.volume,
                    iteration: input.iteration,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            return {
                status: 'error',
                data: {
                    volumeNumber: input.volume,
                    rewrittenContent: input.originalContent, // Fallback to original
                    changesApplied: [],
                    preservedSections: [],
                    iteration: input.iteration
                },
                errors: [error instanceof Error ? error.message : String(error)]
            }
        }
    }

    private async saveRewrittenVolume(
        jobId: string,
        volume: number,
        content: string,
        iteration: number
    ): Promise<void> {
        const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('proposal_jobs') as any)
            .update({
                volumes: {
                    [volumeKey]: content
                },
                updated_at: new Date().toISOString()
            })
            .eq('job_id', jobId)

        if (error) {
            logger.error(`[Rewriter] Failed to save rewritten volume`, {
                data: { jobId, volume, error: error.message }
            })
            throw new Error(`Failed to save rewritten volume: ${error.message}`)
        }
    }

    private trackChangesApplied(input: RewriterInput): Array<{
        section: string
        changeType: 'compliance_fix' | 'quality_enhancement' | 'user_feedback'
        description: string
    }> {
        const changes: Array<{
            section: string
            changeType: 'compliance_fix' | 'quality_enhancement' | 'user_feedback'
            description: string
        }> = []

        // Track user feedback changes
        if (input.userFeedback) {
            changes.push({
                section: 'User-Specified',
                changeType: 'user_feedback',
                description: input.userFeedback.substring(0, 200)
            })
        }

        // Track compliance gap fixes
        input.consultantInsights.complianceGaps.forEach(gap => {
            changes.push({
                section: gap.requirementId,
                changeType: 'compliance_fix',
                description: gap.recommendedFix.substring(0, 200)
            })
        })

        // Track quality enhancements
        changes.push({
            section: 'Overall',
            changeType: 'quality_enhancement',
            description: 'Enhanced readability, flow, and professional tone in Pass 2'
        })

        return changes
    }
}

// Export singleton instance
export const agentRewriter = new AgentRewriter()


