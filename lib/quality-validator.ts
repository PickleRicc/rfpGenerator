/**
 * Quality validation utilities to ensure generated content meets standards
 * 
 * Focus: Consistency, Compliance, Quality over Speed
 */

export interface QualityCheckResult {
    passed: boolean
    score: number
    issues: string[]
    warnings: string[]
}

/**
 * Validate generated section content for quality issues
 */
export function validateSectionQuality(
    content: string,
    requirements: {
        minLength?: number
        maxLength?: number
        requiredKeywords?: string[]
        forbiddenPhrases?: string[]
    }
): QualityCheckResult {
    const issues: string[] = []
    const warnings: string[] = []
    let score = 100

    // Length validation
    if (requirements.minLength && content.length < requirements.minLength) {
        issues.push(`Content too short: ${content.length} < ${requirements.minLength} chars`)
        score -= 30
    }
    if (requirements.maxLength && content.length > requirements.maxLength) {
        warnings.push(`Content may be too long: ${content.length} > ${requirements.maxLength} chars`)
        score -= 10
    }

    // Required keywords check
    if (requirements.requiredKeywords) {
        const missingKeywords = requirements.requiredKeywords.filter(
            keyword => !content.toLowerCase().includes(keyword.toLowerCase())
        )
        if (missingKeywords.length > 0) {
            issues.push(`Missing required keywords: ${missingKeywords.join(', ')}`)
            score -= 20 * missingKeywords.length
        }
    }

    // Forbidden phrases check (generic AI content)
    const genericPhrases = [
        'proven track record',
        'cutting-edge',
        'state-of-the-art',
        'world-class',
        'best-in-class',
        'seamless integration',
        'robust solution',
        'comprehensive approach',
        'innovative solution',
        'synergy',
        ...(requirements.forbiddenPhrases || [])
    ]

    const foundGeneric = genericPhrases.filter(phrase => 
        content.toLowerCase().includes(phrase.toLowerCase())
    )
    
    if (foundGeneric.length > 0) {
        warnings.push(`Generic AI phrases detected: ${foundGeneric.join(', ')}`)
        score -= 5 * foundGeneric.length
    }

    // Check for incomplete content markers
    const incompleteMarkers = ['...', '[INSERT', 'TODO', 'TBD', 'PLACEHOLDER']
    const foundIncomplete = incompleteMarkers.filter(marker =>
        content.toUpperCase().includes(marker)
    )
    
    if (foundIncomplete.length > 0) {
        issues.push(`Incomplete content detected: ${foundIncomplete.join(', ')}`)
        score -= 40
    }

    // Check for reasonable structure (has paragraphs, not just one blob)
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50)
    if (paragraphs.length < 2 && content.length > 1000) {
        warnings.push('Content lacks paragraph structure')
        score -= 10
    }

    return {
        passed: issues.length === 0 && score >= 70,
        score: Math.max(0, score),
        issues,
        warnings,
    }
}

/**
 * Validate volume consistency - ensure volumes work together
 */
export function validateVolumeConsistency(volumes: {
    volume1: string
    volume2: string
    volume3: string
    volume4: string
}): QualityCheckResult {
    const issues: string[] = []
    const warnings: string[] = []
    let score = 100

    // Check for personnel name consistency across volumes
    const vol1Personnel = extractPersonnelNames(volumes.volume1)
    const vol2Personnel = extractPersonnelNames(volumes.volume2)
    const vol3Personnel = extractPersonnelNames(volumes.volume3)

    // If same person appears with different names/titles, flag it
    const allNames = [...vol1Personnel, ...vol2Personnel, ...vol3Personnel]
    const uniqueNames = new Set(allNames.map(n => n.toLowerCase()))
    
    if (uniqueNames.size < allNames.length * 0.8) {
        warnings.push('Potential personnel name inconsistencies detected')
        score -= 10
    }

    // Check for page count reasonableness
    const vol1Pages = estimatePageCount(volumes.volume1)
    const vol2Pages = estimatePageCount(volumes.volume2)
    const vol3Pages = estimatePageCount(volumes.volume3)
    const vol4Pages = estimatePageCount(volumes.volume4)

    if (vol1Pages < 5 || vol2Pages < 5 || vol3Pages < 5 || vol4Pages < 5) {
        issues.push('One or more volumes appears too short')
        score -= 20
    }

    // Check for company name consistency
    const companyNames = [
        ...extractCompanyReferences(volumes.volume1),
        ...extractCompanyReferences(volumes.volume2),
        ...extractCompanyReferences(volumes.volume3),
        ...extractCompanyReferences(volumes.volume4),
    ]
    
    const uniqueCompanyRefs = new Set(companyNames)
    if (uniqueCompanyRefs.size > 3) {
        warnings.push('Multiple company name variations found - check consistency')
        score -= 15
    }

    return {
        passed: issues.length === 0 && score >= 70,
        score: Math.max(0, score),
        issues,
        warnings,
    }
}

function extractPersonnelNames(content: string): string[] {
    // Simple extraction - look for capitalized names near role keywords
    const roleKeywords = ['Manager', 'Lead', 'Director', 'Engineer', 'Architect', 'Specialist']
    const names: string[] = []
    
    roleKeywords.forEach(role => {
        const regex = new RegExp(`([A-Z][a-z]+ [A-Z][a-z]+).*?${role}`, 'g')
        const matches = content.match(regex)
        if (matches) {
            matches.forEach(match => {
                const name = match.match(/([A-Z][a-z]+ [A-Z][a-z]+)/)
                if (name) names.push(name[0])
            })
        }
    })
    
    return names
}

function extractCompanyReferences(content: string): string[] {
    // Look for proper nouns that might be company names
    // This is a simplified heuristic
    const matches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g) || []
    return matches.filter(m => 
        m.length > 5 && 
        !['The', 'And', 'For', 'With'].some(word => m.startsWith(word))
    )
}

function estimatePageCount(content: string): number {
    // Rough estimate: 3000 chars per page
    return Math.ceil(content.length / 3000)
}









