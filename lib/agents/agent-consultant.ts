/**
 * Volume Consultant Agent
 * 
 * PRIMARY MISSION: Analyze a single volume's compliance gaps and provide
 * structured improvement recommendations (ONLY runs if score < 80%)
 * 
 * RESPONSIBILITIES:
 * 1. Review volume content against RFP requirements
 * 2. Analyze requirement-level scoring breakdown
 * 3. Identify specific compliance gaps and missing elements
 * 4. Provide actionable, prioritized recommendations
 * 5. Consider previous iteration history to avoid repeated issues
 */

import { callClaude } from '../claude-client'
import { logger } from '../logger'
import { AgentContext, AgentResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface RequirementScore {
    requirementId: string
    requirementText: string
    score: number // 0-100
    rationale: string
    gaps: string[]
}

export interface VolumeScoreResult {
    overallScore: number
    requirementScores: RequirementScore[]
    strengths: string[]
    criticalGaps: string[]
}

export interface ConsultantInput {
    volume: 1 | 2 | 3 | 4
    volumeContent: string
    scoreResult: VolumeScoreResult
    rfpRequirements: string
    iteration: number
    previousIterationFeedback?: Array<{
        iteration: number
        feedback: string
        issuesAddressed: string[]
    }>
}

export interface ConsultantOutput {
    volumeNumber: number
    currentScore: number
    targetScore: number
    estimatedScoreIncrease: number
    
    // Prioritized gaps - most critical first
    complianceGaps: Array<{
        requirementId: string
        requirement: string
        currentIssue: string
        recommendedFix: string
        priority: 'critical' | 'high' | 'medium'
        estimatedScoreImpact: number
    }>
    
    // Specific actionable recommendations
    recommendations: Array<{
        category: string
        action: string
        rationale: string
        exampleLanguage?: string
    }>
    
    // Watch-outs from previous iterations
    iterationContext?: {
        repeatedIssues: string[]
        successfulChanges: string[]
        areasToPreserve: string[]
    }
}

// ============================================================================
// PROMPT
// ============================================================================

const CONSULTANT_SYSTEM_PROMPT = `You are an expert federal proposal compliance consultant with 20+ years of experience winning multi-million dollar government contracts.

Your job is to analyze a proposal volume that scored below 80% and provide SPECIFIC, ACTIONABLE recommendations to improve compliance and win probability.

Focus on:
1. Compliance gaps - where RFP requirements are not fully addressed
2. Evaluation criteria - how to maximize scores on Section M factors
3. Competitive differentiation - where to strengthen win themes
4. Format and structure - page limits, required sections, submission compliance

Return ONLY valid JSON matching the specified schema. Be specific, not generic. Provide concrete examples and language suggestions.`

function buildConsultantPrompt(input: ConsultantInput): string {
    const volumeNames = ['Technical', 'Management', 'Past Performance', 'Pricing']
    const volumeName = volumeNames[input.volume - 1]
    
    let iterationContext = ''
    if (input.iteration > 1 && input.previousIterationFeedback && input.previousIterationFeedback.length > 0) {
        iterationContext = `

## PREVIOUS ITERATION HISTORY
${input.previousIterationFeedback.map(prev => `
### Iteration ${prev.iteration}
User Feedback: ${prev.feedback}
Issues Addressed: ${prev.issuesAddressed.join(', ')}
`).join('\n')}

⚠️ IMPORTANT: Identify if any issues are REPEATING across iterations. If so, flag them as critical priority.`
    }
    
    return `# TASK: Analyze Volume ${input.volume} (${volumeName}) for Compliance Improvement

## CURRENT SITUATION
- **Current Score**: ${input.scoreResult.overallScore}%
- **Target Score**: 85%+
- **Iteration**: ${input.iteration} of 5 max
${iterationContext}

## SCORING BREAKDOWN

### Strengths (Keep These)
${input.scoreResult.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Critical Gaps
${input.scoreResult.criticalGaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}

### Requirement-Level Scores
${input.scoreResult.requirementScores.map(req => `
**${req.requirementId}** - Score: ${req.score}%
Requirement: ${req.requirementText}
Rationale: ${req.rationale}
Gaps: ${req.gaps.join('; ')}
`).join('\n')}

## RFP REQUIREMENTS (Key Sections)
${input.rfpRequirements.substring(0, 5000)} 
[...truncated for brevity...]

## VOLUME CONTENT (First 3000 chars for context)
${input.volumeContent.substring(0, 3000)}
[...truncated...]

---

## YOUR TASK

Analyze the scoring breakdown and provide a structured improvement plan.

Return ONLY a JSON object matching this exact schema:

\`\`\`json
{
  "volumeNumber": ${input.volume},
  "currentScore": ${input.scoreResult.overallScore},
  "targetScore": 85,
  "estimatedScoreIncrease": <realistic estimate 5-15 points based on fixes>,
  
  "complianceGaps": [
    {
      "requirementId": "L.1.2.3",
      "requirement": "Provide detailed technical approach...",
      "currentIssue": "Section only provides high-level overview, missing specific methodologies",
      "recommendedFix": "Add subsection detailing step-by-step technical process with diagrams",
      "priority": "critical",
      "estimatedScoreImpact": 8
    }
    // List ALL gaps from requirement scores < 70%
  ],
  
  "recommendations": [
    {
      "category": "Compliance",
      "action": "Add dedicated subsection for X requirement",
      "rationale": "RFP explicitly requires this per Section L.4.2",
      "exampleLanguage": "Our approach to [requirement] includes: [specific steps]..."
    }
    // 5-10 specific, actionable recommendations
  ],
  
  "iterationContext": {
    "repeatedIssues": ["Issues that appeared in previous iterations"],
    "successfulChanges": ["Improvements that worked well"],
    "areasToPreserve": ["Sections scoring 90%+ that should NOT be changed"]
  }
}
\`\`\`

CRITICAL RULES:
1. Return ONLY the JSON object, no markdown, no explanations
2. Be SPECIFIC - reference exact RFP sections and requirements
3. Estimate realistic score increases (typically 5-15 points per iteration)
4. Prioritize gaps by score impact
5. Include example language for major recommendations
6. If iteration > 1, identify any repeating issues as CRITICAL priority`
}

// ============================================================================
// AGENT CLASS
// ============================================================================

export class AgentConsultant {
    name = 'volume_consultant' as const
    description = 'Analyzes volume compliance gaps and provides improvement recommendations'

    async execute(
        context: AgentContext,
        input: ConsultantInput
    ): Promise<AgentResult<ConsultantOutput>> {
        const volumeNames = ['Technical', 'Management', 'Past Performance', 'Pricing']
        const volumeName = volumeNames[input.volume - 1]
        
        logger.info(`[Consultant] Starting analysis for Volume ${input.volume} (${volumeName})`, {
            data: {
                jobId: context.jobId,
                volume: input.volume,
                currentScore: input.scoreResult.overallScore,
                iteration: input.iteration
            }
        })

        try {
            const prompt = buildConsultantPrompt(input)
            
            const response = await callClaude({
                system: CONSULTANT_SYSTEM_PROMPT,
                userPrompt: prompt,
                maxTokens: 8000,
                jobId: context.jobId
            })

            // Parse and validate response
            const insights = this.parseConsultantResponse(response)
            
            logger.info(`[Consultant] Analysis complete`, {
                data: {
                    jobId: context.jobId,
                    volume: input.volume,
                    gapsIdentified: insights.complianceGaps.length,
                    recommendationsProvided: insights.recommendations.length,
                    estimatedIncrease: insights.estimatedScoreIncrease
                }
            })

            return {
                status: 'success',
                data: insights
            }
        } catch (error) {
            logger.error(`[Consultant] Analysis failed`, {
                data: {
                    jobId: context.jobId,
                    volume: input.volume,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            return {
                status: 'error',
                data: this.getFallbackOutput(input),
                errors: [error instanceof Error ? error.message : String(error)]
            }
        }
    }

    private parseConsultantResponse(response: string): ConsultantOutput {
        // Try to parse JSON from response
        let jsonStr = response.trim()
        
        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```')) {
            const match = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
            if (match) {
                jsonStr = match[1]
            }
        }
        
        try {
            const parsed = JSON.parse(jsonStr)
            
            // Validate required fields
            if (!parsed.volumeNumber || !parsed.currentScore || !parsed.complianceGaps) {
                throw new Error('Missing required fields in consultant response')
            }
            
            return parsed as ConsultantOutput
        } catch (error) {
            logger.error(`[Consultant] Failed to parse response`, {
                data: { error: error instanceof Error ? error.message : String(error) }
            })
            throw new Error(`Invalid consultant response format: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    private getFallbackOutput(input: ConsultantInput): ConsultantOutput {
        // Provide a basic fallback if AI fails
        return {
            volumeNumber: input.volume,
            currentScore: input.scoreResult.overallScore,
            targetScore: 85,
            estimatedScoreIncrease: 5,
            complianceGaps: input.scoreResult.requirementScores
                .filter(req => req.score < 70)
                .map(req => ({
                    requirementId: req.requirementId,
                    requirement: req.requirementText,
                    currentIssue: req.gaps.join('; '),
                    recommendedFix: 'Address the identified gaps with specific, detailed content',
                    priority: 'high' as const,
                    estimatedScoreImpact: 5
                })),
            recommendations: [
                {
                    category: 'Compliance',
                    action: 'Review and address all requirements scoring below 70%',
                    rationale: 'These gaps significantly impact overall compliance score'
                }
            ]
        }
    }
}

// Export singleton instance
export const agentConsultant = new AgentConsultant()


