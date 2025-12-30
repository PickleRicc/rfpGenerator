/**
 * Agent 1: RFP Intelligence Extractor
 * 
 * PRIMARY MISSION: Extract ALL requirements from RFP and create the master 
 * compliance checklist that governs the entire proposal.
 * 
 * CRITICAL: We must capture EVERY requirement - missing one could disqualify.
 * 
 * STRATEGY: Multi-pass extraction to handle large RFPs without truncation:
 * Pass 1: Metadata + Section L (format) + Section M (evaluation)
 * Pass 2: Section C requirements (chunked if needed)
 * Pass 3: CLINs + Disqualifying requirements
 */

import { supabase } from '../supabase'
import { logger } from '../logger'
import { callClaude } from '../claude-client'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent1Output,
} from './types'
import { RfpParsedData, RfpRequirement, RfpEvaluationFactor } from '../database.types'

// =============================================================================
// PROMPTS - Focused prompts for each extraction pass
// =============================================================================

const METADATA_PROMPT = `You are a federal RFP analyst. Extract ONLY the following from this RFP.
Return ONLY valid JSON, no markdown:

{
  "metadata": {
    "agency": "Full agency name",
    "solicitation_num": "Solicitation number",
    "title": "RFP title",
    "deadline": "Submission deadline with timezone",
    "contract_type": "FFP/T&M/Cost-Plus/IDIQ etc",
    "set_aside": "Small business set-aside type or null"
  },
  "section_l": {
    "volumes_required": 4,
    "page_limits": {
      "volume_1_technical": 50,
      "volume_2_management": 30,
      "volume_3_past_performance": 25,
      "volume_4_price": null
    },
    "format": {
      "font": "Font name",
      "font_size": "Size",
      "margins": "Margin size",
      "spacing": "Line spacing"
    }
  },
  "section_m": {
    "factors": [
      {"name": "Factor name", "weight": "Percentage or points", "description": "Brief description"}
    ],
    "total_points": 100
  }
}

RFP TEXT:`

const REQUIREMENTS_PROMPT = `You are a federal RFP analyst. Extract ALL requirements from this RFP section.
CRITICAL: Extract EVERY "shall", "must", "will", "required" statement. Missing one could disqualify the proposal.

Return ONLY a JSON array, no markdown:
[
  {
    "id": "REQ-001",
    "section": "C.2.1",
    "text": "Full requirement text - do NOT truncate",
    "mandatory": true,
    "eval_factor": "Technical Approach"
  }
]

RFP TEXT:`

const DISQUALIFIERS_PROMPT = `You are a federal RFP analyst. Extract:
1. ALL Contract Line Items (CLINs) from Section B
2. ALL disqualifying requirements (things that will auto-reject if missing/wrong)

Look for: page limits, volume requirements, formatting rules, certifications required, 
set-aside requirements, mandatory experience, security clearances, etc.

Return ONLY valid JSON, no markdown:
{
  "section_b": {
    "clins": [
      {"clin": "0001", "description": "Description", "quantity": "1", "unit": "LOT"}
    ]
  },
  "disqualifying_requirements": [
    "Must submit exactly 4 separate volumes",
    "Must be certified small business",
    "Page limit for Technical Volume is 50 pages"
  ]
}

RFP TEXT:`

// =============================================================================
// AGENT IMPLEMENTATION
// =============================================================================

export class Agent1RfpParser implements Agent<AgentContext, Agent1Output> {
    name = 'agent_1' as const
    description = 'Parses RFP and extracts ALL structured requirements'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []

        if (!context.jobId) {
            errors.push('Job ID is required')
        }

        if (!context.rfpText && !context.rfpFileUrl) {
            errors.push('RFP text or file URL is required')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }

    async execute(context: AgentContext): Promise<AgentResult<Agent1Output>> {
        logger.agentStep('agent_1', context.jobId, 'Starting multi-pass RFP extraction')

        try {
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                return {
                    status: 'error',
                    data: null as unknown as Agent1Output,
                    errors: validation.errors,
                }
            }

            await this.updateAgentStatus(context.jobId, 'running')

            const rfpText = context.rfpText || ''
            logger.agentStep('agent_1', context.jobId, 'RFP received', {
                totalLength: rfpText.length,
                estimatedPages: Math.ceil(rfpText.length / 3000),
            })

            // ================================================================
            // PASS 1: Extract metadata, format rules, evaluation criteria
            // ================================================================
            logger.agentStep('agent_1', context.jobId, 'Pass 1: Extracting metadata and evaluation criteria')
            
            const metadataResult = await this.extractMetadata(rfpText, context.jobId)
            
            logger.agentStep('agent_1', context.jobId, 'Pass 1 complete', {
                agency: metadataResult.metadata.agency,
                solicitation: metadataResult.metadata.solicitation_num,
                factors: metadataResult.section_m.factors.length,
            })

            // ================================================================
            // PASS 2: Extract ALL requirements (chunked for large RFPs)
            // ================================================================
            logger.agentStep('agent_1', context.jobId, 'Pass 2: Extracting ALL requirements')
            
            const requirements = await this.extractAllRequirements(rfpText, context.jobId)
            
            logger.agentStep('agent_1', context.jobId, 'Pass 2 complete', {
                totalRequirements: requirements.length,
                mandatory: requirements.filter(r => r.mandatory).length,
            })

            // ================================================================
            // PASS 3: Extract CLINs and disqualifying requirements
            // ================================================================
            logger.agentStep('agent_1', context.jobId, 'Pass 3: Extracting CLINs and disqualifiers')
            
            const disqualifiersResult = await this.extractDisqualifiers(rfpText, context.jobId)
            
            logger.agentStep('agent_1', context.jobId, 'Pass 3 complete', {
                clins: disqualifiersResult.section_b?.clins?.length || 0,
                disqualifiers: disqualifiersResult.disqualifying_requirements.length,
            })

            // ================================================================
            // MERGE ALL RESULTS
            // ================================================================
            const rfpParsedData: RfpParsedData = {
                metadata: metadataResult.metadata,
                section_l: metadataResult.section_l,
                section_m: metadataResult.section_m,
                section_c: { requirements },
                section_b: disqualifiersResult.section_b,
                disqualifying_requirements: disqualifiersResult.disqualifying_requirements,
            }

            // Build compliance matrix
            const complianceMatrixSkeleton = requirements.map(req => ({
                reqId: req.id,
                requirement: req.text,
                mandatory: req.mandatory,
                evalFactor: req.eval_factor,
            }))

            // Save to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('proposal_jobs') as any)
                .update({
                    rfp_parsed_data: rfpParsedData,
                    rfp_metadata: rfpParsedData.metadata,
                    current_agent: 'agent_1',
                    agent_progress: {
                        agent_0: { status: 'complete' },
                        agent_1: {
                            status: 'complete',
                            started_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                        },
                    },
                })
                .eq('job_id', context.jobId)

            if (error) {
                throw new Error(`Failed to save RFP data: ${error.message}`)
            }

            logger.agentStep('agent_1', context.jobId, 'RFP parsing complete', {
                totalRequirements: requirements.length,
                mandatoryRequirements: requirements.filter(r => r.mandatory).length,
                evaluationFactors: rfpParsedData.section_m.factors.length,
                disqualifyingRequirements: rfpParsedData.disqualifying_requirements.length,
            })

            return {
                status: 'success',
                data: {
                    rfpParsedData,
                    complianceMatrixSkeleton,
                },
                nextAgent: 'agent_2',
                metadata: {
                    requirementCount: requirements.length,
                    mandatoryCount: requirements.filter(r => r.mandatory).length,
                    factorCount: rfpParsedData.section_m.factors.length,
                },
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error(errorMessage, { jobId: context.jobId, agent: 'agent_1' })
            await this.updateAgentStatus(context.jobId, 'failed', errorMessage)
            
            return {
                status: 'error',
                data: null as unknown as Agent1Output,
                errors: [errorMessage],
            }
        }
    }

    // =========================================================================
    // PASS 1: Metadata Extraction
    // =========================================================================
    
    private async extractMetadata(rfpText: string, jobId: string): Promise<{
        metadata: RfpParsedData['metadata']
        section_l: RfpParsedData['section_l']
        section_m: RfpParsedData['section_m']
    }> {
        // Use first portion for metadata (usually in beginning)
        const textForMetadata = rfpText.substring(0, 100000)
        
        const response = await callClaude({
            system: 'Return ONLY valid JSON. No markdown, no explanation.',
            userPrompt: METADATA_PROMPT + textForMetadata,
            maxTokens: 4000,
            temperature: 0.1,
            jobId,
        })

        const parsed = this.parseJson(response, 'metadata') as {
            metadata?: {
                agency?: string
                solicitation_num?: string
                title?: string
                deadline?: string
                contract_type?: string
                set_aside?: string
            }
            section_l?: {
                volumes_required?: number
                page_limits?: {
                    volume_1_technical?: number
                    volume_2_management?: number
                    volume_3_past_performance?: number
                    volume_4_price?: number | null
                }
                format?: {
                    font?: string
                    font_size?: string
                    margins?: string
                    spacing?: string
                }
            }
            section_m?: {
                factors?: unknown[]
                total_points?: number
            }
        }
        
        return {
            metadata: {
                agency: parsed.metadata?.agency || 'Unknown Agency',
                solicitation_num: parsed.metadata?.solicitation_num || 'Unknown',
                title: parsed.metadata?.title || 'Government RFP',
                deadline: parsed.metadata?.deadline || 'Not specified',
                contract_type: parsed.metadata?.contract_type,
                set_aside: parsed.metadata?.set_aside,
            },
            section_l: {
                volumes_required: parsed.section_l?.volumes_required || 4,
                page_limits: {
                    volume_1_technical: parsed.section_l?.page_limits?.volume_1_technical || 50,
                    volume_2_management: parsed.section_l?.page_limits?.volume_2_management || 30,
                    volume_3_past_performance: parsed.section_l?.page_limits?.volume_3_past_performance || 25,
                    volume_4_price: parsed.section_l?.page_limits?.volume_4_price ?? null as unknown as number,
                },
                format: {
                    font: parsed.section_l?.format?.font || 'Times New Roman',
                    font_size: parsed.section_l?.format?.font_size || '12pt',
                    margins: parsed.section_l?.format?.margins || '1 inch',
                    spacing: parsed.section_l?.format?.spacing || 'Single',
                },
            },
            section_m: {
                factors: this.parseFactors(parsed.section_m?.factors),
                total_points: parsed.section_m?.total_points,
            },
        }
    }

    // =========================================================================
    // PASS 2: Requirements Extraction (with chunking for large RFPs)
    // =========================================================================
    
    private async extractAllRequirements(rfpText: string, jobId: string): Promise<RfpRequirement[]> {
        const allRequirements: RfpRequirement[] = []
        const chunkSize = 80000 // Characters per chunk
        const chunks: string[] = []
        
        // Split RFP into overlapping chunks to avoid missing requirements at boundaries
        for (let i = 0; i < rfpText.length; i += chunkSize - 5000) {
            chunks.push(rfpText.substring(i, i + chunkSize))
        }

        logger.agentStep('agent_1', jobId, `Processing ${chunks.length} chunk(s) for requirements`)

        for (let i = 0; i < chunks.length; i++) {
            logger.agentStep('agent_1', jobId, `Extracting requirements from chunk ${i + 1}/${chunks.length}`)
            
            const response = await callClaude({
                system: 'Return ONLY a valid JSON array of requirements. No markdown, no explanation.',
                userPrompt: REQUIREMENTS_PROMPT + chunks[i],
                maxTokens: 16000, // Allow large output for many requirements
                temperature: 0.1,
                jobId,
            })

            const chunkRequirements = this.parseRequirementsArray(response, i)
            
            // Add with chunk offset for unique IDs
            chunkRequirements.forEach((req, idx) => {
                // Avoid duplicates by checking text similarity
                const isDuplicate = allRequirements.some(existing => 
                    this.textSimilarity(existing.text, req.text) > 0.9
                )
                
                if (!isDuplicate) {
                    allRequirements.push({
                        ...req,
                        id: `REQ-${String(allRequirements.length + 1).padStart(3, '0')}`,
                    })
                }
            })

            logger.agentStep('agent_1', jobId, `Chunk ${i + 1} complete`, {
                chunkRequirements: chunkRequirements.length,
                totalSoFar: allRequirements.length,
            })
        }

        return allRequirements
    }

    // =========================================================================
    // PASS 3: Disqualifiers Extraction
    // =========================================================================
    
    private async extractDisqualifiers(rfpText: string, jobId: string): Promise<{
        section_b?: { clins: Array<{ clin: string; description: string; quantity: string; unit: string }> }
        disqualifying_requirements: string[]
    }> {
        // Disqualifiers can be throughout the document
        const response = await callClaude({
            system: 'Return ONLY valid JSON. No markdown, no explanation.',
            userPrompt: DISQUALIFIERS_PROMPT + rfpText.substring(0, 120000),
            maxTokens: 4000,
            temperature: 0.1,
            jobId,
        })

        const parsed = this.parseJson(response, 'disqualifiers') as {
            section_b?: {
                clins?: Array<{ clin?: string; description?: string; quantity?: string; unit?: string }>
            }
            disqualifying_requirements?: string[]
        }
        
        // Normalize section_b clins
        const normalizedClins = parsed.section_b?.clins?.map(c => ({
            clin: String(c.clin || ''),
            description: String(c.description || ''),
            quantity: String(c.quantity || ''),
            unit: String(c.unit || ''),
        }))
        
        return {
            section_b: normalizedClins ? { clins: normalizedClins } : undefined,
            disqualifying_requirements: Array.isArray(parsed.disqualifying_requirements) 
                ? parsed.disqualifying_requirements 
                : [],
        }
    }

    // =========================================================================
    // PARSING HELPERS
    // =========================================================================

    private parseJson(response: string, context: string): Record<string, unknown> {
        let cleaned = response.trim()
        
        // Remove markdown
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        try {
            return JSON.parse(cleaned)
        } catch (error) {
            // Try to repair
            const repaired = this.repairJson(cleaned)
            try {
                return JSON.parse(repaired)
            } catch {
                logger.warn(`Failed to parse ${context} JSON, using defaults`, { 
                    data: { sample: cleaned.substring(0, 200) } 
                })
                return {}
            }
        }
    }

    private parseRequirementsArray(response: string, chunkIndex: number): RfpRequirement[] {
        let cleaned = response.trim()
        
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
        }

        // Ensure it starts with [ for array
        if (!cleaned.startsWith('[')) {
            const arrayStart = cleaned.indexOf('[')
            if (arrayStart !== -1) {
                cleaned = cleaned.substring(arrayStart)
            }
        }

        try {
            const parsed = JSON.parse(cleaned)
            if (!Array.isArray(parsed)) return []
            
            return parsed.map((r: Record<string, unknown>, i: number) => ({
                id: String(r.id || `CHUNK${chunkIndex}-REQ-${i + 1}`),
                section: String(r.section || 'Unknown'),
                text: String(r.text || ''),
                mandatory: r.mandatory !== false,
                eval_factor: r.eval_factor ? String(r.eval_factor) : undefined,
            }))
        } catch {
            // Try repair
            const repaired = this.repairJson(cleaned)
            try {
                const parsed = JSON.parse(repaired)
                if (!Array.isArray(parsed)) return []
                
                return parsed.map((r: Record<string, unknown>, i: number) => ({
                    id: String(r.id || `CHUNK${chunkIndex}-REQ-${i + 1}`),
                    section: String(r.section || 'Unknown'),
                    text: String(r.text || ''),
                    mandatory: r.mandatory !== false,
                    eval_factor: r.eval_factor ? String(r.eval_factor) : undefined,
                }))
            } catch {
                logger.warn(`Failed to parse requirements chunk ${chunkIndex}`)
                return []
            }
        }
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

    private parseFactors(factors: unknown): RfpEvaluationFactor[] {
        if (!Array.isArray(factors) || factors.length === 0) {
            return [
                { name: 'Technical Approach', weight: '40%' },
                { name: 'Past Performance', weight: '30%' },
                { name: 'Price', weight: '30%' },
            ]
        }

        return factors.map((f: Record<string, unknown>, i: number) => ({
            name: String(f.name || `Factor ${i + 1}`),
            weight: String(f.weight || 'Unknown'),
            description: f.description ? String(f.description) : undefined,
        }))
    }

    /**
     * Simple text similarity check (Jaccard similarity on words)
     */
    private textSimilarity(text1: string, text2: string): number {
        const words1 = new Set(text1.toLowerCase().split(/\s+/))
        const words2 = new Set(text2.toLowerCase().split(/\s+/))
        
        const intersection = new Set([...words1].filter(w => words2.has(w)))
        const union = new Set([...words1, ...words2])
        
        return intersection.size / union.size
    }

    private async updateAgentStatus(
        jobId: string,
        status: 'running' | 'complete' | 'failed',
        error?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                agent_progress: {
                    agent_1: {
                        status,
                        ...(status === 'running' && { started_at: new Date().toISOString() }),
                        ...(status === 'complete' && { completed_at: new Date().toISOString() }),
                        ...(error && { error }),
                    },
                },
            })
            .eq('job_id', jobId)
    }
}

// Export singleton instance
export const agent1 = new Agent1RfpParser()
