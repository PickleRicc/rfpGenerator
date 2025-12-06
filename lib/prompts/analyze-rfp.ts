/**
 * Prompt 1: RFP Analysis
 * Extracts key information from RFP and creates proposal outline
 * Target: ~30 seconds
 */

export interface RfpAnalysis {
    metadata: {
        agency: string
        solicitationNum: string
        deadline: string
        title: string
    }
    requirements: string[]
    evaluationFactors: Array<{ name: string; weight: string }>
    keyThemes: string[]
    proposalOutline: string[]
}

export function createAnalyzeRfpPrompt(rfpText: string): { system: string; userPrompt: string } {
    return {
        system: `You are an expert government RFP analyst. Extract key information and return ONLY valid JSON with no markdown formatting.`,
        
        userPrompt: `Analyze this RFP and extract the following information. Return ONLY valid JSON:

{
  "metadata": {
    "agency": "full agency name",
    "solicitationNum": "solicitation/RFP number",
    "deadline": "submission deadline with time and timezone",
    "title": "RFP title or subject"
  },
  "requirements": [
    "requirement 1 - brief description",
    "requirement 2 - brief description"
  ],
  "evaluationFactors": [
    {"name": "Technical Approach", "weight": "40%"},
    {"name": "Past Performance", "weight": "30%"}
  ],
  "keyThemes": [
    "theme 1 (e.g., cloud migration)",
    "theme 2 (e.g., security compliance)"
  ],
  "proposalOutline": [
    "Executive Summary",
    "Technical Approach",
    "Management Approach",
    "Past Performance",
    "Pricing"
  ]
}

RFP TEXT:
${rfpText.substring(0, 100000)}`
    }
}

/**
 * Parse the RFP analysis response
 */
export function parseRfpAnalysis(response: string): RfpAnalysis {
    let cleaned = response.trim()
    
    // Remove markdown code blocks if present
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    
    try {
        const parsed = JSON.parse(cleaned)
        
        // Provide defaults for missing fields
        return {
            metadata: {
                agency: parsed.metadata?.agency || 'Unknown Agency',
                solicitationNum: parsed.metadata?.solicitationNum || 'Unknown',
                deadline: parsed.metadata?.deadline || 'Not specified',
                title: parsed.metadata?.title || 'Government RFP',
            },
            requirements: parsed.requirements || [],
            evaluationFactors: parsed.evaluationFactors || [],
            keyThemes: parsed.keyThemes || [],
            proposalOutline: parsed.proposalOutline || [
                'Executive Summary',
                'Technical Approach', 
                'Management Approach',
                'Past Performance',
                'Pricing'
            ],
        }
    } catch (error) {
        console.error('Failed to parse RFP analysis:', cleaned.substring(0, 500))
        throw new Error(`Failed to parse RFP analysis: ${error}`)
    }
}

