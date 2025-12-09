/**
 * Data normalization utilities to handle inconsistent database types
 * Ensures all data is in the expected format before use in prompts
 */

export interface NormalizedCompany {
    id: string
    name: string
    business_type: string
    certifications: string[]
    duns: string
    cage_code: string
    uei: string
    founded_year: number
    employee_count: number
    annual_revenue: number
    capabilities_statement: string
    address: {
        street: string
        city: string
        state: string
        zip: string
    }
    naics_codes: Array<{
        code: string
        description: string
        is_primary: boolean
    }>
}

export interface NormalizedPastPerformance {
    id: string
    company_id: string
    project_name: string
    agency: string
    contract_number: string
    contract_value: number
    start_date: string
    end_date: string
    scope: string
    performance_summary: string
    poc_name: string
    poc_email: string
    poc_phone: string
}

export interface NormalizedPersonnel {
    id: string
    company_id: string
    name: string
    title: string
    role: string
    years_experience: number
    clearance_level: string
    expertise: string
    certifications: string[]
    resume_summary: string
}

export interface NormalizedLaborRate {
    id: string
    company_id: string
    category: string
    hourly_rate: number
}

export interface NormalizedCompanyData {
    company: NormalizedCompany
    pastPerformance: NormalizedPastPerformance[]
    personnel: NormalizedPersonnel[]
    laborRates: NormalizedLaborRate[]
}

/**
 * Safely convert any value to a string
 */
function toString(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

/**
 * Safely convert any value to a number
 */
function toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0
    if (typeof value === 'number') return value
    const parsed = parseFloat(String(value))
    return isNaN(parsed) ? 0 : parsed
}

/**
 * Safely convert any value to a string array
 */
function toStringArray(value: unknown): string[] {
    if (value === null || value === undefined) return []
    if (Array.isArray(value)) return value.map(toString)
    if (typeof value === 'string') return [value]
    return []
}

/**
 * Safely parse address object
 */
function normalizeAddress(value: unknown): NormalizedCompany['address'] {
    const defaultAddress = { street: '', city: '', state: '', zip: '' }
    
    if (!value || typeof value !== 'object') return defaultAddress
    
    const addr = value as Record<string, unknown>
    return {
        street: toString(addr.street),
        city: toString(addr.city),
        state: toString(addr.state),
        zip: toString(addr.zip),
    }
}

/**
 * Safely parse NAICS codes
 */
function normalizeNaicsCodes(value: unknown): NormalizedCompany['naics_codes'] {
    if (!value || !Array.isArray(value)) return []
    
    return value.map((item) => {
        if (typeof item !== 'object' || !item) {
            return { code: '', description: '', is_primary: false }
        }
        const obj = item as Record<string, unknown>
        return {
            code: toString(obj.code),
            description: toString(obj.description),
            is_primary: Boolean(obj.is_primary),
        }
    })
}

/**
 * Normalize company data from database
 */
export function normalizeCompany(data: unknown): NormalizedCompany {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid company data')
    }
    
    const company = data as Record<string, unknown>
    
    return {
        id: toString(company.id),
        name: toString(company.name) || 'Unknown Company',
        business_type: toString(company.business_type),
        certifications: toStringArray(company.certifications),
        duns: toString(company.duns),
        cage_code: toString(company.cage_code),
        uei: toString(company.uei),
        founded_year: toNumber(company.founded_year),
        employee_count: toNumber(company.employee_count),
        annual_revenue: toNumber(company.annual_revenue),
        capabilities_statement: toString(company.capabilities_statement),
        address: normalizeAddress(company.address),
        naics_codes: normalizeNaicsCodes(company.naics_codes),
    }
}

/**
 * Normalize past performance record
 */
export function normalizePastPerformance(data: unknown): NormalizedPastPerformance {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid past performance data')
    }
    
    const pp = data as Record<string, unknown>
    
    return {
        id: toString(pp.id),
        company_id: toString(pp.company_id),
        project_name: toString(pp.project_name) || 'Unnamed Project',
        agency: toString(pp.agency),
        contract_number: toString(pp.contract_number),
        contract_value: toNumber(pp.contract_value),
        start_date: toString(pp.start_date),
        end_date: toString(pp.end_date),
        scope: toString(pp.scope),
        performance_summary: toString(pp.performance_summary),
        poc_name: toString(pp.poc_name),
        poc_email: toString(pp.poc_email),
        poc_phone: toString(pp.poc_phone),
    }
}

/**
 * Normalize personnel record
 */
export function normalizePersonnel(data: unknown): NormalizedPersonnel {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid personnel data')
    }
    
    const person = data as Record<string, unknown>
    
    return {
        id: toString(person.id),
        company_id: toString(person.company_id),
        name: toString(person.name) || 'Unknown',
        title: toString(person.title),
        role: toString(person.role),
        years_experience: toNumber(person.years_experience),
        clearance_level: toString(person.clearance_level),
        expertise: toString(person.expertise),
        certifications: toStringArray(person.certifications),
        resume_summary: toString(person.resume_summary),
    }
}

/**
 * Normalize labor rate record
 */
export function normalizeLaborRate(data: unknown): NormalizedLaborRate {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid labor rate data')
    }
    
    const rate = data as Record<string, unknown>
    
    return {
        id: toString(rate.id),
        company_id: toString(rate.company_id),
        category: toString(rate.category),
        hourly_rate: toNumber(rate.hourly_rate),
    }
}

/**
 * Normalize all company data at once
 */
export function normalizeCompanyData(
    company: unknown,
    pastPerformance: unknown[],
    personnel: unknown[],
    laborRates: unknown[]
): NormalizedCompanyData {
    return {
        company: normalizeCompany(company),
        pastPerformance: (pastPerformance || []).map(normalizePastPerformance),
        personnel: (personnel || []).map(normalizePersonnel),
        laborRates: (laborRates || []).map(normalizeLaborRate),
    }
}



