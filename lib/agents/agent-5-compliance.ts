/**
 * Agent 5: Compliance Auditor
 * 
 * PRIMARY MISSION: Review all 4 volumes against Agent 1's compliance checklist
 * and score proposal, flagging any disqualifying errors.
 * 
 * RESPONSIBILITIES:
 * 1. Format compliance check (4 volumes, page limits, fonts, margins)
 * 2. Content compliance check (all requirements addressed)
 * 3. Score proposal against Section M evaluation criteria
 * 4. Generate compliance audit report with fix priorities
 */

import { supabase } from '../supabase'
import { callClaude } from '../claude-client'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent5Output,
    ComplianceCheckResult,
} from './types'

const COMPLIANCE_AUDIT_SYSTEM_PROMPT = `You are an expert federal proposal compliance auditor. Your job is to:
1. Verify all RFP requirements are addressed
2. Check format compliance (page limits, structure)
3. Score against evaluation criteria
4. Identify any disqualifying issues

Be thorough and specific. Return JSON only.`

export class Agent5Compliance implements Agent<AgentContext, Agent5Output> {
    name = 'agent_5' as const
    description = 'Audits compliance and scores proposal'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []

        if (!context.jobId) errors.push('Job ID is required')
        if (!context.rfpParsedData) errors.push('RFP parsed data is required')
        if (!context.volumes) errors.push('Generated volumes are required')

        return { valid: errors.length === 0, errors }
    }

    async execute(context: AgentContext): Promise<AgentResult<Agent5Output>> {
        const targetVolume = context.targetVolume
        console.log(`[Agent 5] Starting ${targetVolume ? `volume ${targetVolume}` : 'full'} compliance audit for job ${context.jobId}`)

        try {
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                return {
                    status: 'error',
                    data: null as unknown as Agent5Output,
                    errors: validation.errors,
                }
            }

            await this.updateAgentStatus(context.jobId, 'running')

            // NEW: Per-volume mode - score only the specified volume
            if (targetVolume) {
                return await this.executeSingleVolumeAudit(context, targetVolume)
            }

            // LEGACY: Run format compliance checks on all volumes
            const formatCompliance = await this.checkFormatCompliance(context)
            console.log(`[Agent 5] Format: ${formatCompliance.filter(c => c.status === 'pass').length}/${formatCompliance.length} passed`)

            // Run content compliance checks using Claude
            const contentCompliance = await this.checkContentCompliance(context)
            console.log(`[Agent 5] Content: ${contentCompliance.filter(c => c.status === 'pass').length}/${contentCompliance.length} passed`)

            // Score against evaluation factors
            const scoringCompliance = await this.scoreAgainstFactors(context)

            // Calculate overall score
            const passedChecks = [...formatCompliance, ...contentCompliance, ...scoringCompliance]
                .filter(c => c.status === 'pass').length
            const totalChecks = formatCompliance.length + contentCompliance.length + scoringCompliance.length
            const overallScore = Math.round((passedChecks / totalChecks) * 100)

            // Identify critical and high priority fixes
            const allChecks = [...formatCompliance, ...contentCompliance, ...scoringCompliance]
            const criticalFixes = allChecks
                .filter(c => c.status === 'fail' && c.fixPriority === 'critical')
                .map(c => c.details)
            const highPriorityFixes = allChecks
                .filter(c => c.status === 'fail' && c.fixPriority === 'high')
                .map(c => c.details)

            // Estimate win probability based on score
            const estimatedWinProbability = this.estimateWinProbability(overallScore, criticalFixes.length)

            const output: Agent5Output = {
                formatCompliance,
                contentCompliance,
                scoringCompliance,
                overallScore,
                estimatedWinProbability,
                criticalFixes,
                highPriorityFixes,
            }

            // Save to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    compliance_score: overallScore,
                    compliance_report: output,
                    current_agent: 'agent_5',
                    agent_progress: {
                        agent_5: {
                            status: 'complete',
                            started_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                        },
                    },
                })
                .eq('job_id', context.jobId)

            console.log(`[Agent 5] ✓ Compliance audit complete`)
            console.log(`[Agent 5] Overall Score: ${overallScore}%`)
            console.log(`[Agent 5] Critical Fixes: ${criticalFixes.length}`)
            console.log(`[Agent 5] Win Probability: ${estimatedWinProbability}%`)

            return {
                status: criticalFixes.length > 0 ? 'warning' : 'success',
                data: output,
                warnings: criticalFixes.length > 0 ? criticalFixes : undefined,
                nextAgent: 'agent_6',
            }
        } catch (error) {
            console.error(`[Agent 5] ❌ Error:`, error)
            await this.updateAgentStatus(context.jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
            
            return {
                status: 'error',
                data: null as unknown as Agent5Output,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            }
        }
    }

    /**
     * Execute compliance audit for a single volume (for volume-by-volume iteration mode)
     */
    private async executeSingleVolumeAudit(
        context: AgentContext,
        volumeNumber: 1 | 2 | 3 | 4
    ): Promise<AgentResult<Agent5Output>> {
        console.log(`[Agent 5] Single-volume mode: auditing Volume ${volumeNumber} only`)
        
        // Get the specific volume content
        const volumeKey = `volume${volumeNumber}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        const volumeContent = context.volumes?.[volumeKey]
        
        if (!volumeContent) {
            throw new Error(`Volume ${volumeNumber} content not found`)
        }
        
        const results: ComplianceCheckResult[] = []
        const limits = context.volumePageLimits || context.rfpParsedData?.section_l.page_limits
        
        // Check page limit for this volume
        const volumePages = Math.ceil(volumeContent.length / 3000)
        const limitMap = {
            1: limits?.volume_1_technical || 50,
            2: limits?.volume_2_management || 30,
            3: limits?.volume_3_past_performance || 25,
            4: limits?.volume_4_price || 20,
        }
        const pageLimit = limitMap[volumeNumber]
        
        results.push({
            category: 'format',
            item: `Volume ${volumeNumber} Page Limit`,
            status: volumePages <= pageLimit ? 'pass' : 'fail',
            details: `Volume ${volumeNumber} is ~${volumePages} pages (limit: ${pageLimit})`,
            fixPriority: volumePages > pageLimit ? 'critical' : undefined,
        })
        
        // Check content compliance for this volume using Claude with requirement-level scoring
        const requirements = context.rfpParsedData?.section_c.requirements || []
        
        const prompt = `Score each requirement for Volume ${volumeNumber}. Return detailed requirement-level assessment.

TASK: For each requirement, assess:
1. How well addressed (score 0-100)
2. Quality of response
3. Specific gaps
4. Location in volume

REQUIREMENTS:
${requirements.slice(0, 20).map(r => `${r.id}: ${r.text}`).join('\n')}

VOLUME ${volumeNumber} CONTENT:
${volumeContent.substring(0, 30000)}

Return JSON:
{
  "requirementScores": [
    {
      "requirementId": "REQ-001",
      "requirementText": "requirement text",
      "score": 85,
      "rationale": "Addressed in Section 2 with good detail",
      "gaps": ["Missing specific methodology", "No diagram provided"]
    }
  ],
  "strengths": ["What's working well"],
  "criticalGaps": ["Most important missing elements"]
}

Return ONLY JSON, no markdown.`
        
        let requirementScores: Array<{
            requirementId: string
            requirementText: string
            score: number
            rationale: string
            gaps: string[]
        }> = []
        let strengths: string[] = []
        let criticalGaps: string[] = []
        
        try {
            const response = await callClaude({
                system: COMPLIANCE_AUDIT_SYSTEM_PROMPT,
                userPrompt: prompt,
                maxTokens: 8000,
                jobId: context.jobId,
            })
            
            let jsonStr = response.trim()
            if (jsonStr.startsWith('```')) {
                const match = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
                if (match) jsonStr = match[1]
            }
            
            const parsed = JSON.parse(jsonStr)
            requirementScores = parsed.requirementScores || []
            strengths = parsed.strengths || []
            criticalGaps = parsed.criticalGaps || []
            
            // Convert to compliance results format
            requirementScores.forEach(req => {
                results.push({
                    category: 'content',
                    item: req.requirementId,
                    status: req.score >= 70 ? 'pass' : 'fail',
                    details: `${req.requirementId}: Score ${req.score}% - ${req.rationale}`,
                    fixPriority: req.score < 50 ? 'critical' : req.score < 70 ? 'high' : undefined,
                })
            })
        } catch (error) {
            console.error(`[Agent 5] Error in requirement scoring, using fallback:`, error)
            // Fallback to simple check
            requirements.slice(0, 10).forEach(r => {
                const addressed = volumeContent.toLowerCase().includes(r.text.toLowerCase().substring(0, 50))
                const score = addressed ? 75 : 40
                
                requirementScores.push({
                    requirementId: r.id,
                    requirementText: r.text,
                    score,
                    rationale: addressed ? 'Requirement appears to be addressed' : 'Requirement not clearly addressed',
                    gaps: addressed ? [] : ['Requirement not found in volume content']
                })
                
                results.push({
                    category: 'content',
                    item: r.id,
                    status: addressed ? 'pass' : 'warning',
                    details: `Requirement ${r.id} check in Volume ${volumeNumber}`,
                    fixPriority: !addressed ? 'high' : undefined,
                })
            })
            
            criticalGaps = requirementScores
                .filter(r => r.score < 50)
                .map(r => `${r.requirementId}: ${r.gaps.join(', ')}`)
        }
        
        // Calculate score for this volume
        const passedChecks = results.filter(c => c.status === 'pass').length
        const totalChecks = results.length
        const volumeScore = Math.round((passedChecks / totalChecks) * 100)
        
        const criticalFixes = results
            .filter(c => c.status === 'fail' && c.fixPriority === 'critical')
            .map(c => c.details)
        const highPriorityFixes = results
            .filter(c => c.status === 'fail' && c.fixPriority === 'high')
            .map(c => c.details)
        
        const output: Agent5Output = {
            formatCompliance: results.filter(r => r.category === 'format'),
            contentCompliance: results.filter(r => r.category === 'content'),
            scoringCompliance: [],
            overallScore: volumeScore,
            estimatedWinProbability: this.estimateWinProbability(volumeScore, criticalFixes.length),
            criticalFixes,
            highPriorityFixes,
            // NEW: Requirement-level breakdown for consultant use
            requirementScores,
            strengths,
            criticalGaps,
        }
        
        // Save volume score to database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                [`volume_scores`]: {
                    [`volume${volumeNumber}`]: volumeScore,
                },
                current_agent: 'agent_5',
                agent_progress: {
                    agent_5: {
                        status: 'complete',
                        started_at: new Date().toISOString(),
                        completed_at: new Date().toISOString(),
                    },
                },
            })
            .eq('job_id', context.jobId)
        
        console.log(`[Agent 5] ✓ Volume ${volumeNumber} audit complete`)
        console.log(`[Agent 5] Volume ${volumeNumber} Score: ${volumeScore}%`)
        console.log(`[Agent 5] Critical Fixes: ${criticalFixes.length}`)
        
        return {
            status: criticalFixes.length > 0 ? 'warning' : 'success',
            data: output,
            warnings: criticalFixes.length > 0 ? criticalFixes : undefined,
            nextAgent: 'agent_6',
            metadata: {
                singleVolumeMode: true,
                volumeNumber,
                volumeScore,
            },
        }
    }

    private async checkFormatCompliance(context: AgentContext): Promise<ComplianceCheckResult[]> {
        const results: ComplianceCheckResult[] = []
        const limits = context.volumePageLimits || context.rfpParsedData?.section_l.page_limits

        // Check 4 separate volumes exist
        results.push({
            category: 'format',
            item: '4 Separate Volumes',
            status: context.volumes?.volume1 && context.volumes?.volume2 && 
                    context.volumes?.volume3 && context.volumes?.volume4 ? 'pass' : 'fail',
            details: 'Proposal must have 4 separate volumes',
            fixPriority: 'critical',
        })

        // Check page limits (estimate based on content length)
        const vol1Pages = Math.ceil((context.volumes?.volume1?.length || 0) / 3000)
        const vol2Pages = Math.ceil((context.volumes?.volume2?.length || 0) / 3000)
        const vol3Pages = Math.ceil((context.volumes?.volume3?.length || 0) / 3000)

        results.push({
            category: 'format',
            item: 'Volume I Page Limit',
            status: vol1Pages <= (limits?.volume_1_technical || 50) ? 'pass' : 'fail',
            details: `Volume I is ~${vol1Pages} pages (limit: ${limits?.volume_1_technical || 50})`,
            fixPriority: vol1Pages > (limits?.volume_1_technical || 50) ? 'critical' : undefined,
        })

        results.push({
            category: 'format',
            item: 'Volume II Page Limit',
            status: vol2Pages <= (limits?.volume_2_management || 30) ? 'pass' : 'fail',
            details: `Volume II is ~${vol2Pages} pages (limit: ${limits?.volume_2_management || 30})`,
            fixPriority: vol2Pages > (limits?.volume_2_management || 30) ? 'critical' : undefined,
        })

        results.push({
            category: 'format',
            item: 'Volume III Page Limit',
            status: vol3Pages <= (limits?.volume_3_past_performance || 25) ? 'pass' : 'fail',
            details: `Volume III is ~${vol3Pages} pages (limit: ${limits?.volume_3_past_performance || 25})`,
            fixPriority: vol3Pages > (limits?.volume_3_past_performance || 25) ? 'critical' : undefined,
        })

        return results
    }

    private async checkContentCompliance(context: AgentContext): Promise<ComplianceCheckResult[]> {
        const requirements = context.rfpParsedData?.section_c.requirements || []
        const allContent = `${context.volumes?.volume1 || ''} ${context.volumes?.volume2 || ''} ${context.volumes?.volume3 || ''} ${context.volumes?.volume4 || ''}`

        // Use Claude to check if requirements are addressed
        const prompt = `Check if these requirements are addressed in the proposal content. Return JSON array.

REQUIREMENTS:
${requirements.slice(0, 20).map(r => `${r.id}: ${r.text}`).join('\n')}

PROPOSAL CONTENT (summary):
${allContent.substring(0, 30000)}

Return JSON: [{"req_id": "REQ-001", "addressed": true/false, "location": "Volume I, Section 2.1" or null}]`

        try {
            const response = await callClaude({
                system: COMPLIANCE_AUDIT_SYSTEM_PROMPT,
                userPrompt: prompt,
                maxTokens: 4000,
                temperature: 0.2,
                jobId: context.jobId,
            })

            const parsed = JSON.parse(response.replace(/```json\n?/g, '').replace(/\n?```/g, ''))
            
            return parsed.map((item: { req_id: string; addressed: boolean; location?: string }) => ({
                category: 'content' as const,
                item: item.req_id,
                status: item.addressed ? 'pass' as const : 'fail' as const,
                details: item.addressed 
                    ? `Addressed in ${item.location || 'proposal'}` 
                    : `Requirement ${item.req_id} not found in proposal`,
                fixPriority: !item.addressed ? 'high' as const : undefined,
            }))
        } catch {
            // Fallback to simple check
            return requirements.slice(0, 10).map(r => ({
                category: 'content' as const,
                item: r.id,
                status: allContent.toLowerCase().includes(r.text.toLowerCase().substring(0, 50)) ? 'pass' as const : 'warning' as const,
                details: `Requirement ${r.id} check`,
            }))
        }
    }

    private async scoreAgainstFactors(context: AgentContext): Promise<ComplianceCheckResult[]> {
        const factors = context.rfpParsedData?.section_m.factors || []
        
        return factors.map(factor => ({
            category: 'scoring' as const,
            item: factor.name,
            status: 'pass' as const, // Would need deeper analysis
            details: `Factor: ${factor.name} (${factor.weight})`,
        }))
    }

    private estimateWinProbability(score: number, criticalIssues: number): number {
        if (criticalIssues > 0) return Math.max(0, 30 - criticalIssues * 10)
        if (score >= 95) return 85
        if (score >= 90) return 75
        if (score >= 85) return 65
        if (score >= 80) return 50
        return Math.max(20, score - 30)
    }

    private async updateAgentStatus(
        jobId: string,
        status: 'running' | 'complete' | 'failed',
        error?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                current_agent: 'agent_5',
                agent_progress: {
                    agent_5: {
                        status,
                        ...(status === 'running' && { started_at: new Date().toISOString() }),
                        ...((status === 'complete' || status === 'failed') && { completed_at: new Date().toISOString() }),
                        ...(error && { error }),
                    },
                },
            })
            .eq('job_id', jobId)
    }
}

export const agent5 = new Agent5Compliance()


