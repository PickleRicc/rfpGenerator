/**
 * Agent 3: Content Architect & Mapper
 * 
 * PRIMARY MISSION: Generate compliance matrix and detailed outlines for all 4 
 * volumes, mapping every requirement to a proposal location.
 * 
 * STRATEGY: Multi-pass approach to avoid truncation:
 * Pass 1: Volume outlines (structure without full compliance matrix)
 * Pass 2: Compliance matrix mapping (chunked for many requirements)
 */

import { supabase } from '../supabase'
import { logger } from '../logger'
import { callClaude } from '../claude-client'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent3Output,
} from './types'
import { ContentOutlines, VolumeOutline, SectionOutline, RfpRequirement } from '../database.types'

// =============================================================================
// PROMPTS
// =============================================================================

const VOLUME_OUTLINE_PROMPT = `You are an expert federal proposal architect. Create volume outlines for a government proposal.

PAGE LIMITS:
- Volume I (Technical): {vol1_limit} pages
- Volume II (Management): {vol2_limit} pages  
- Volume III (Past Performance): {vol3_limit} pages
- Volume IV (Price): No limit

EVALUATION FACTORS:
{eval_factors}

Return ONLY valid JSON:
{
  "volume_1": {
    "volume_number": 1,
    "volume_name": "Technical Approach",
    "page_limit": {vol1_limit},
    "page_allocated": 45,
    "sections": [
      {"title": "Executive Summary", "page_allocation": 2, "requirements_addressed": []},
      {"title": "Technical Approach", "page_allocation": 25, "requirements_addressed": [], "subsections": [
        {"title": "System Architecture", "page_allocation": 8, "requirements_addressed": []},
        {"title": "Implementation Plan", "page_allocation": 10, "requirements_addressed": []}
      ]}
    ]
  },
  "volume_2": {
    "volume_number": 2,
    "volume_name": "Management Approach",
    "page_limit": {vol2_limit},
    "page_allocated": 28,
    "sections": [...]
  },
  "volume_3": {
    "volume_number": 3,
    "volume_name": "Past Performance",
    "page_limit": {vol3_limit},
    "page_allocated": 23,
    "sections": [...]
  },
  "volume_4": {
    "volume_number": 4,
    "volume_name": "Price Proposal",
    "page_limit": 0,
    "page_allocated": 15,
    "sections": [...]
  }
}`

const COMPLIANCE_MAPPING_PROMPT = `Map these requirements to proposal sections. For each requirement, identify which volume and section will address it.

VOLUME STRUCTURE:
{volume_structure}

REQUIREMENTS TO MAP:
{requirements}

Return ONLY a JSON array:
[
  {
    "req_id": "REQ-001",
    "requirement": "Brief text",
    "mandatory": true,
    "eval_factor": "Technical",
    "volume": 1,
    "section": "2.1 Technical Approach",
    "page_range": "12-18",
    "status": "pending",
    "evidence": "How we'll address this"
  }
]`

// =============================================================================
// AGENT IMPLEMENTATION
// =============================================================================

export class Agent3ContentMapper implements Agent<AgentContext, Agent3Output> {
    name = 'agent_3' as const
    description = 'Creates content outlines and compliance matrix'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []
        if (!context.jobId) errors.push('Job ID is required')
        if (!context.rfpParsedData) errors.push('RFP parsed data is required (run Agent 1 first)')
        return { valid: errors.length === 0, errors }
    }

    async execute(context: AgentContext): Promise<AgentResult<Agent3Output>> {
        logger.agentStep('agent_3', context.jobId, 'Starting content mapping')

        try {
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                return { status: 'error', data: null as unknown as Agent3Output, errors: validation.errors }
            }

            await this.updateAgentStatus(context.jobId, 'running')

            const rfpData = context.rfpParsedData!
            const pageLimits = context.volumePageLimits || rfpData.section_l.page_limits
            const requirements = rfpData.section_c.requirements

            logger.agentStep('agent_3', context.jobId, 'RFP data received', {
                requirements: requirements.length,
                factors: rfpData.section_m.factors.length,
            })

            // ================================================================
            // PASS 1: Generate volume outlines
            // ================================================================
            logger.agentStep('agent_3', context.jobId, 'Pass 1: Generating volume outlines')
            
            const volumeOutlines = await this.generateVolumeOutlines(rfpData, pageLimits, context.jobId)
            
            logger.agentStep('agent_3', context.jobId, 'Volume outlines created', {
                vol1Sections: volumeOutlines.volume_1.sections.length,
                vol2Sections: volumeOutlines.volume_2.sections.length,
                vol3Sections: volumeOutlines.volume_3.sections.length,
                vol4Sections: volumeOutlines.volume_4.sections.length,
            })

            // ================================================================
            // PASS 2: Map requirements to compliance matrix (chunked)
            // ================================================================
            logger.agentStep('agent_3', context.jobId, 'Pass 2: Creating compliance matrix')
            
            const complianceMatrix = await this.generateComplianceMatrix(
                requirements, 
                volumeOutlines, 
                context.jobId
            )
            
            logger.agentStep('agent_3', context.jobId, 'Compliance matrix complete', {
                mapped: complianceMatrix.length,
                total: requirements.length,
            })

            // Combine into final structure
            const contentOutlines: ContentOutlines = {
                ...volumeOutlines,
                compliance_matrix: complianceMatrix,
            }

            // Calculate page allocations
            const pageAllocations = this.calculatePageAllocations(contentOutlines, pageLimits)

            // Find unmapped requirements
            const mappedIds = new Set(complianceMatrix.map(item => item.req_id))
            const unmapped = requirements.filter(r => !mappedIds.has(r.id))
            
            if (unmapped.length > 0) {
                logger.warn(`${unmapped.length} requirements not mapped`, {
                    jobId: context.jobId,
                    agent: 'agent_3',
                    data: { unmappedIds: unmapped.slice(0, 10).map(r => r.id) }
                })
            }

            // Save to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('proposal_jobs') as any)
                .update({
                    content_outlines: contentOutlines,
                    current_agent: 'agent_3',
                    agent_progress: {
                        agent_0: { status: 'complete' },
                        agent_1: { status: 'complete' },
                        agent_2: { status: 'complete' },
                        agent_3: {
                            status: 'complete',
                            started_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                        },
                    },
                })
                .eq('job_id', context.jobId)

            if (error) throw new Error(`Failed to save content outlines: ${error.message}`)

            logger.agentStep('agent_3', context.jobId, 'Content mapping complete', {
                vol1Pages: `${pageAllocations.volume1}/${pageLimits.volume_1_technical}`,
                vol2Pages: `${pageAllocations.volume2}/${pageLimits.volume_2_management}`,
                vol3Pages: `${pageAllocations.volume3}/${pageLimits.volume_3_past_performance}`,
                vol4Pages: pageAllocations.volume4,
                matrixItems: complianceMatrix.length,
            })

            return {
                status: 'success',
                data: { contentOutlines, pageAllocations },
                nextAgent: 'agent_4',
                metadata: { unmappedRequirements: unmapped.length },
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error(errorMessage, { jobId: context.jobId, agent: 'agent_3' })
            await this.updateAgentStatus(context.jobId, 'failed', errorMessage)
            return { status: 'error', data: null as unknown as Agent3Output, errors: [errorMessage] }
        }
    }

    // =========================================================================
    // PASS 1: Volume Outlines
    // =========================================================================

    private async generateVolumeOutlines(
        rfpData: import('../database.types').RfpParsedData,
        pageLimits: import('../database.types').VolumePageLimits,
        jobId: string
    ): Promise<Omit<ContentOutlines, 'compliance_matrix'>> {
        const evalFactors = rfpData.section_m.factors
            .map(f => `- ${f.name}: ${f.weight}`)
            .join('\n')

        const prompt = VOLUME_OUTLINE_PROMPT
            .replace(/{vol1_limit}/g, String(pageLimits.volume_1_technical))
            .replace(/{vol2_limit}/g, String(pageLimits.volume_2_management))
            .replace(/{vol3_limit}/g, String(pageLimits.volume_3_past_performance))
            .replace('{eval_factors}', evalFactors)

        const response = await callClaude({
            system: 'Return ONLY valid JSON. No markdown, no explanation.',
            userPrompt: prompt,
            maxTokens: 8000,
            temperature: 0.2,
            jobId,
        })

        const parsed = this.parseJson(response)
        
        return {
            volume_1: this.normalizeVolumeOutline(parsed.volume_1, 1, 'Technical Approach', pageLimits.volume_1_technical),
            volume_2: this.normalizeVolumeOutline(parsed.volume_2, 2, 'Management Approach', pageLimits.volume_2_management),
            volume_3: this.normalizeVolumeOutline(parsed.volume_3, 3, 'Past Performance', pageLimits.volume_3_past_performance),
            volume_4: this.normalizeVolumeOutline(parsed.volume_4, 4, 'Price Proposal', 0),
        }
    }

    // =========================================================================
    // PASS 2: Compliance Matrix (chunked)
    // =========================================================================

    private async generateComplianceMatrix(
        requirements: RfpRequirement[],
        volumeOutlines: Omit<ContentOutlines, 'compliance_matrix'>,
        jobId: string
    ): Promise<ContentOutlines['compliance_matrix']> {
        const allMappings: ContentOutlines['compliance_matrix'] = []
        const chunkSize = 30 // Requirements per chunk
        
        // Summarize volume structure for context
        const volumeStructure = this.summarizeVolumeStructure(volumeOutlines)
        
        // Process in chunks
        for (let i = 0; i < requirements.length; i += chunkSize) {
            const chunk = requirements.slice(i, i + chunkSize)
            const chunkNum = Math.floor(i / chunkSize) + 1
            const totalChunks = Math.ceil(requirements.length / chunkSize)
            
            logger.agentStep('agent_3', jobId, `Mapping requirements chunk ${chunkNum}/${totalChunks}`)
            
            const reqList = chunk
                .map(r => `- ${r.id} (${r.mandatory ? 'MANDATORY' : 'Optional'}): ${r.text.substring(0, 150)}${r.eval_factor ? ` [${r.eval_factor}]` : ''}`)
                .join('\n')

            const prompt = COMPLIANCE_MAPPING_PROMPT
                .replace('{volume_structure}', volumeStructure)
                .replace('{requirements}', reqList)

            const response = await callClaude({
                system: 'Return ONLY a valid JSON array. No markdown.',
                userPrompt: prompt,
                maxTokens: 8000,
                temperature: 0.2,
                jobId,
            })

            const chunkMappings = this.parseComplianceArray(response, chunk)
            allMappings.push(...chunkMappings)
        }

        return allMappings
    }

    // =========================================================================
    // PARSING HELPERS
    // =========================================================================

    private parseJson(response: string): Record<string, unknown> {
        let cleaned = response.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        try {
            return JSON.parse(cleaned)
        } catch {
            const repaired = this.repairJson(cleaned)
            try {
                return JSON.parse(repaired)
            } catch {
                logger.warn('Failed to parse volume outlines, using defaults')
                return {}
            }
        }
    }

    private parseComplianceArray(
        response: string, 
        sourceRequirements: RfpRequirement[]
    ): ContentOutlines['compliance_matrix'] {
        let cleaned = response.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }
        
        // Ensure starts with [
        if (!cleaned.startsWith('[')) {
            const idx = cleaned.indexOf('[')
            if (idx !== -1) cleaned = cleaned.substring(idx)
        }

        try {
            const parsed = JSON.parse(cleaned)
            if (!Array.isArray(parsed)) throw new Error('Not an array')
            return this.normalizeComplianceItems(parsed)
        } catch {
            // Try repair
            const repaired = this.repairJson(cleaned)
            try {
                const parsed = JSON.parse(repaired)
                if (!Array.isArray(parsed)) throw new Error('Not an array')
                return this.normalizeComplianceItems(parsed)
            } catch {
                // Fall back: create basic mappings from source requirements
                logger.warn('Compliance parsing failed, creating basic mappings')
                return sourceRequirements.map(r => ({
                    req_id: r.id,
                    requirement: r.text.substring(0, 200),
                    mandatory: r.mandatory,
                    eval_factor: r.eval_factor || 'Technical',
                    volume: this.guessVolume(r),
                    section: 'TBD',
                    page_range: 'TBD',
                    status: 'pending' as const,
                    evidence: '',
                }))
            }
        }
    }

    private normalizeComplianceItems(items: unknown[]): ContentOutlines['compliance_matrix'] {
        return items.map((item: unknown) => {
            const i = item as Record<string, unknown>
            return {
                req_id: String(i.req_id || 'UNKNOWN'),
                requirement: String(i.requirement || ''),
                mandatory: Boolean(i.mandatory),
                eval_factor: String(i.eval_factor || ''),
                volume: Number(i.volume) || 1,
                section: String(i.section || 'TBD'),
                page_range: String(i.page_range || 'TBD'),
                status: 'pending' as const,
                evidence: String(i.evidence || ''),
            }
        })
    }

    private repairJson(json: string): string {
        let repaired = json.trim()
        repaired = repaired.replace(/,\s*$/, '')
        repaired = repaired.replace(/,?\s*"[^"]*":\s*"?[^"}\]]*$/, '')
        
        let openBraces = 0, openBrackets = 0
        let inString = false, escapeNext = false
        
        for (const char of repaired) {
            if (escapeNext) { escapeNext = false; continue }
            if (char === '\\') { escapeNext = true; continue }
            if (char === '"') { inString = !inString; continue }
            if (inString) continue
            if (char === '{') openBraces++
            if (char === '}') openBraces--
            if (char === '[') openBrackets++
            if (char === ']') openBrackets--
        }
        
        while (openBrackets > 0) { repaired += ']'; openBrackets-- }
        while (openBraces > 0) { repaired += '}'; openBraces-- }
        
        return repaired
    }

    private normalizeVolumeOutline(
        data: unknown,
        volumeNumber: number,
        defaultName: string,
        pageLimit: number
    ): VolumeOutline {
        const d = data as Record<string, unknown> | undefined
        return {
            volume_number: volumeNumber,
            volume_name: String(d?.volume_name || defaultName),
            page_limit: Number(d?.page_limit) || pageLimit,
            page_allocated: Number(d?.page_allocated) || 0,
            sections: this.normalizeSections(d?.sections),
        }
    }

    private normalizeSections(sections: unknown): SectionOutline[] {
        if (!Array.isArray(sections)) return this.getDefaultSections()
        return sections.map((s: unknown) => {
            const sec = s as Record<string, unknown>
            return {
                title: String(sec.title || 'Section'),
                page_allocation: Number(sec.page_allocation) || 5,
                requirements_addressed: Array.isArray(sec.requirements_addressed) 
                    ? sec.requirements_addressed.map(String) 
                    : [],
                subsections: sec.subsections ? this.normalizeSections(sec.subsections) : undefined,
            }
        })
    }

    private getDefaultSections(): SectionOutline[] {
        return [
            { title: 'Executive Summary', page_allocation: 2, requirements_addressed: [] },
            { title: 'Technical Approach', page_allocation: 20, requirements_addressed: [] },
            { title: 'Conclusion', page_allocation: 1, requirements_addressed: [] },
        ]
    }

    private summarizeVolumeStructure(outlines: Omit<ContentOutlines, 'compliance_matrix'>): string {
        const summarize = (vol: VolumeOutline): string => {
            const sections = vol.sections.map(s => `  - ${s.title} (${s.page_allocation} pages)`).join('\n')
            return `Volume ${vol.volume_number}: ${vol.volume_name}\n${sections}`
        }
        return [outlines.volume_1, outlines.volume_2, outlines.volume_3, outlines.volume_4]
            .map(summarize)
            .join('\n\n')
    }

    private guessVolume(req: RfpRequirement): number {
        const text = (req.text + ' ' + (req.eval_factor || '')).toLowerCase()
        if (text.includes('past performance') || text.includes('reference')) return 3
        if (text.includes('price') || text.includes('cost') || text.includes('rate')) return 4
        if (text.includes('management') || text.includes('staffing') || text.includes('organization')) return 2
        return 1 // Default to technical
    }

    private calculatePageAllocations(
        outlines: ContentOutlines,
        limits: import('../database.types').VolumePageLimits
    ): { volume1: number; volume2: number; volume3: number; volume4: number } {
        const calc = (sections: SectionOutline[]): number => {
            return sections.reduce((sum, s) => {
                const sub = s.subsections ? calc(s.subsections) : 0
                return sum + (s.page_allocation || 0) + sub
            }, 0)
        }

        const volume1 = calc(outlines.volume_1.sections)
        const volume2 = calc(outlines.volume_2.sections)
        const volume3 = calc(outlines.volume_3.sections)
        const volume4 = calc(outlines.volume_4.sections)

        // Log warnings for over-limit
        if (limits.volume_1_technical && volume1 > limits.volume_1_technical) {
            logger.warn(`Volume I exceeds limit: ${volume1}/${limits.volume_1_technical}`)
        }
        if (limits.volume_2_management && volume2 > limits.volume_2_management) {
            logger.warn(`Volume II exceeds limit: ${volume2}/${limits.volume_2_management}`)
        }
        if (limits.volume_3_past_performance && volume3 > limits.volume_3_past_performance) {
            logger.warn(`Volume III exceeds limit: ${volume3}/${limits.volume_3_past_performance}`)
        }

        return { volume1, volume2, volume3, volume4 }
    }

    private async updateAgentStatus(
        jobId: string,
        status: 'running' | 'complete' | 'failed',
        error?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                current_agent: 'agent_3',
                agent_progress: {
                    agent_3: {
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

// Export singleton instance
export const agent3 = new Agent3ContentMapper()
