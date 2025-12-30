// ============================================================================
// DATABASE TYPES - Multi-Agent RFP System
// ============================================================================

// ----------------------------------------------------------------------------
// Enums
// ----------------------------------------------------------------------------

export type ProposalStatus = 'draft' | 'intake' | 'validating' | 'blocked' | 'processing' | 'review' | 'completed' | 'failed' | 'cancelled'
export type IntakeStatus = 'draft' | 'complete' | 'validated' | 'approved'
export type ValidationStatus = 'pending' | 'blocked' | 'warnings' | 'approved'
export type AgentName = 'agent_0' | 'agent_1' | 'agent_2' | 'agent_3' | 'agent_4' | 'agent_5' | 'agent_6' | 'agent_7' | 'agent_8'
export type AgentStatus = 'pending' | 'running' | 'complete' | 'failed' | 'blocked'
export type ClearanceLevel = 'None' | 'Secret' | 'Top Secret' | 'TS/SCI'
export type ClearanceStatus = 'Active' | 'Current' | 'Expired' | 'In Progress'
export type CMMCLevel = 'None' | 'Level 1' | 'Level 2' | 'Level 3'
export type FedRAMPLevel = 'None' | 'Low' | 'Moderate' | 'High'
export type ContractType = 'FFP' | 'T&M' | 'Cost-Plus' | 'IDIQ' | 'BPA'
export type BusinessStructure = 'LLC' | 'S-Corp' | 'C-Corp' | 'Partnership' | 'Sole Proprietor'
export type PersonnelRole = 'Program Manager' | 'Technical Lead' | 'Security Lead' | 'DevSecOps Lead' | 'Cloud Architect' | 'QA Lead' | 'Other'
export type Availability = 'Full-time' | 'Part-time 50%' | 'Part-time 25%' | 'As-needed'

// ----------------------------------------------------------------------------
// Shared Types
// ----------------------------------------------------------------------------

export interface Certification {
    type: string
    cert_number: string
    expiration_date: string
    file_url?: string
}

export interface QuantifiedOutcome {
    metric: string
    value: string
}

export interface Address {
    street: string
    city: string
    state: string
    zip: string
}

export interface NAICSCode {
    code: string
    description: string
    is_primary: boolean
}

// ----------------------------------------------------------------------------
// Volume Types
// ----------------------------------------------------------------------------

export interface VolumePageLimits {
    volume_1_technical: number
    volume_2_management: number
    volume_3_past_performance: number
    volume_4_price: number | null
}

export interface VolumeProgress {
    volume_1: { pages: number; status: AgentStatus; content_url?: string }
    volume_2: { pages: number; status: AgentStatus; content_url?: string }
    volume_3: { pages: number; status: AgentStatus; content_url?: string }
    volume_4: { pages: number; status: AgentStatus; content_url?: string }
}

// ----------------------------------------------------------------------------
// Agent Types
// ----------------------------------------------------------------------------

export interface AgentProgress {
    [key: string]: {
        status: AgentStatus
        started_at?: string
        completed_at?: string
        error?: string
    }
}

export interface AgentError {
    agent: AgentName
    error: string
    timestamp: string
    recoverable: boolean
}

export interface ValidationReportItem {
    type: 'blocker' | 'warning' | 'recommendation'
    field: string
    message: string
    fix_path?: string
}

export interface ValidationReport {
    status: ValidationStatus
    blockers: ValidationReportItem[]
    warnings: ValidationReportItem[]
    recommendations: ValidationReportItem[]
    generated_at: string
}

// ----------------------------------------------------------------------------
// RFP Parsed Data Types
// ----------------------------------------------------------------------------

export interface RfpRequirement {
    id: string
    section: string
    text: string
    mandatory: boolean
    eval_factor?: string
    volume?: string
    proposal_section?: string
    page_range?: string
    status?: 'pending' | 'addressed' | 'verified'
}

export interface RfpEvaluationFactor {
    name: string
    weight: string | number
    description?: string
}

export interface RfpParsedData {
    metadata: {
        agency: string
        solicitation_num: string
        title: string
        deadline: string
        contract_type?: string
        set_aside?: string
    }
    section_l: {
        volumes_required: number
        page_limits: VolumePageLimits
        format: {
            font: string
            font_size: string
            margins: string
            spacing: string
        }
    }
    section_m: {
        factors: RfpEvaluationFactor[]
        total_points?: number
    }
    section_c: {
        requirements: RfpRequirement[]
    }
    section_b?: {
        clins: Array<{
            clin: string
            description: string
            quantity: string
            unit: string
        }>
    }
    disqualifying_requirements: string[]
}

// ----------------------------------------------------------------------------
// Content Outlines Types
// ----------------------------------------------------------------------------

export interface SectionOutline {
    title: string
    page_allocation: number
    requirements_addressed: string[]
    subsections?: SectionOutline[]
}

export interface VolumeOutline {
    volume_number: number
    volume_name: string
    page_limit: number
    page_allocated: number
    sections: SectionOutline[]
}

export interface ContentOutlines {
    volume_1: VolumeOutline
    volume_2: VolumeOutline
    volume_3: VolumeOutline
    volume_4: VolumeOutline
    compliance_matrix: Array<{
        req_id: string
        requirement: string
        mandatory: boolean
        eval_factor: string
        volume: number
        section: string
        page_range: string
        status: string
        evidence: string
    }>
}

// ----------------------------------------------------------------------------
// Database Schema Types
// ----------------------------------------------------------------------------

export interface Database {
    public: {
        Tables: {
            companies: {
                Row: {
                    id: string
                    name: string
                    business_type: string[]
                    business_structure: BusinessStructure | null
                    certifications: string[]
                    duns: string
                    cage_code: string
                    uei: string
                    ein: string | null
                    founded_year: number
                    employee_count: number
                    annual_revenue: number
                    capabilities_statement: string
                    address: Address
                    naics_codes: NAICSCode[]
                    // New fields for intake tracking
                    intake_complete: boolean
                    last_intake_date: string | null
                    created_at: string
                    updated_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['companies']['Insert']>
            }
            
            past_performance: {
                Row: {
                    id: string
                    company_id: string
                    project_name: string
                    agency: string
                    customer_office: string | null
                    contract_number: string
                    contract_type: ContractType | null
                    contract_value: number
                    start_date: string
                    end_date: string
                    scope: string
                    performance_summary: string
                    poc_name: string
                    poc_title: string | null
                    poc_email: string
                    poc_phone: string
                    // New fields
                    poc_verified_date: string | null
                    relevance_tags: string[]
                    cpars_rating: string | null
                    cpars_document_url: string | null
                    customer_testimonial: string | null
                    quantified_outcomes: QuantifiedOutcome[]
                    created_at: string
                    updated_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['past_performance']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['past_performance']['Insert']>
            }
            
            personnel: {
                Row: {
                    id: string
                    company_id: string
                    name: string
                    title: string
                    role: string | null  // Added by migration 006
                    years_experience: number
                    clearance_level: string
                    clearance_status: string | null
                    clearance_investigation_date: string | null
                    expertise: string[]  // This is an array in the original schema!
                    certifications: string[]  // This is a string array in the original schema
                    resume_summary: string
                    resume_url: string | null
                    // New fields
                    commitment_letter: boolean
                    resume_updated_date: string | null
                    availability: Availability | null
                    created_at: string
                    updated_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['personnel']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['personnel']['Insert']>
            }
            
            labor_rates: {
                Row: {
                    id: string
                    company_id: string
                    category: string
                    hourly_rate: number
                    year_1_rate: number | null
                    year_2_rate: number | null
                    year_3_rate: number | null
                    year_4_rate: number | null
                    year_5_rate: number | null
                    // New fields
                    escalation_rate: number | null
                    basis_of_rates: string | null
                    rate_justification: string | null
                    gsa_schedule_number: string | null
                    created_at: string
                    updated_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['labor_rates']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['labor_rates']['Insert']>
            }
            
            // New table: client_intake
            client_intake: {
                Row: {
                    id: string
                    company_id: string
                    status: IntakeStatus
                    submitted_at: string | null
                    validated_at: string | null
                    validated_by_agent: boolean
                    validation_report: ValidationReport | null
                    
                    // Section 1: Company Identifiers
                    legal_name: string | null
                    dba_name: string | null
                    uei: string | null
                    cage_code: string | null
                    duns: string | null
                    ein: string | null
                    business_structure: BusinessStructure | null
                    years_in_business: number | null
                    employee_count: number | null
                    annual_revenue: number | null
                    primary_naics: string | null
                    secondary_naics: string[]
                    set_aside_certifications: Certification[]
                    
                    // Section 2: Security Certifications
                    cmmc_level: CMMCLevel | null
                    cmmc_cert_number: string | null
                    cmmc_expiration: string | null
                    cmmc_cert_url: string | null
                    fedramp_level: FedRAMPLevel | null
                    security_certifications: Certification[]
                    
                    // Section 5: Technical Capabilities
                    cloud_platforms: Array<{ platform: string; certification_level: string }>
                    iac_tools: string[]
                    container_tools: string[]
                    cicd_tools: string[]
                    security_tools: { siem: string[]; vulnerability_scanners: string[]; cmmc_controls: string[] }
                    methodologies: string[]
                    proprietary_tools: Array<{ name: string; description: string; benefits: string }>
                    
                    // Section 6: Pricing Assumptions
                    escalation_rate: number | null
                    overhead_rate: number | null
                    ga_rate: number | null
                    fee_margin: number | null
                    fringe_rate: number | null
                    travel_budget: number | null
                    license_costs: number | null
                    hardware_costs: number | null
                    cloud_costs: number | null
                    
                    // Section 7: Facilities
                    primary_office: Address | null
                    additional_locations: Address[]
                    facility_clearance: string | null
                    existing_infrastructure: string | null
                    
                    // Subcontractors
                    subcontractors: Array<{
                        name: string
                        cage_code: string
                        uei: string
                        small_business_status: string
                        scope_of_work: string
                        percentage_of_value: number
                        teaming_agreement_url?: string
                    }>
                    
                    created_at: string
                    updated_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['client_intake']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['client_intake']['Insert']>
            }
            
            proposal_jobs: {
                Row: {
                    job_id: string
                    company_id: string
                    intake_id: string | null
                    status: ProposalStatus
                    progress_percent: number
                    current_step: string
                    sections_completed: string[]
                    
                    // Agent orchestration fields
                    current_agent: AgentName | null
                    agent_progress: AgentProgress | null
                    error_log: AgentError[]
                    
                    // RFP data
                    rfp_file_url: string | null
                    rfp_text: string | null
                    rfp_parsed_data: RfpParsedData | null
                    
                    // Validation
                    validation_status: ValidationStatus | null
                    validation_report: ValidationReport | null
                    
                    // Content planning
                    content_outlines: ContentOutlines | null
                    volume_page_limits: VolumePageLimits | null
                    volume_progress: VolumeProgress | null
                    
                    // Generated content - now stored as volume URLs
                    volume_1_url: string | null
                    volume_2_url: string | null
                    volume_3_url: string | null
                    volume_4_url: string | null
                    
                    // Legacy fields for backward compatibility
                    rfp_metadata: {
                        agency?: string
                        solicitationNum?: string
                        deadline?: string
                        contractValue?: string
                        totalPages?: number
                    } | null
                    executive_summary: string | null
                    technical_approach: string | null
                    management_approach: string | null
                    past_performance_volume: string | null
                    compliance_matrix: string | null
                    pricing: string | null
                    cover_and_toc: string | null
                    appendices: string | null
                    final_html: string | null
                    
                    // Compliance
                    compliance_score: number | null
                    compliance_report: object | null
                    humanization_report: object | null
                    
                    // Final deliverables
                    final_pdf_urls: {
                        volume_1?: string
                        volume_2?: string
                        volume_3?: string
                        volume_4?: string
                        compliance_matrix?: string
                        cover_letter?: string
                    } | null
                    final_docx_urls: {
                        volume_1?: string
                        volume_2?: string
                        volume_3?: string
                        volume_4?: string
                    } | null
                    
                    // Timestamps
                    created_at: string
                    completed_at: string | null
                    updated_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['proposal_jobs']['Row'], 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['proposal_jobs']['Insert']>
            }
            
            // New table: proposal_feedback
            proposal_feedback: {
                Row: {
                    id: string
                    job_id: string
                    volume_number: number
                    section: string
                    page_number: number | null
                    comment: string
                    resolved: boolean
                    resolution_note: string | null
                    created_at: string
                    resolved_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['proposal_feedback']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['proposal_feedback']['Insert']>
            }
        }
    }
}

// ----------------------------------------------------------------------------
// Export Type Aliases
// ----------------------------------------------------------------------------

export type Company = Database['public']['Tables']['companies']['Row']
export type PastPerformance = Database['public']['Tables']['past_performance']['Row']
export type Personnel = Database['public']['Tables']['personnel']['Row']
export type LaborRate = Database['public']['Tables']['labor_rates']['Row']
export type ClientIntake = Database['public']['Tables']['client_intake']['Row']
export type ProposalJob = Database['public']['Tables']['proposal_jobs']['Row']
export type ProposalFeedback = Database['public']['Tables']['proposal_feedback']['Row']

// ----------------------------------------------------------------------------
// Legacy RfpMetadata (for backward compatibility)
// ----------------------------------------------------------------------------

export interface RfpMetadata {
    agency: string
    solicitationNum: string
    deadline: string
    metadata?: {
        agency: string
        solicitationNum: string
        deadline: string
    }
    sectionL?: {
        volumes: Array<{ name: string; pageLimit: number }>
        formatting: { font: string; margins: string }
    }
    sectionM?: {
        factors: Array<{ name: string; weight: number }>
    }
    sectionC?: {
        requirements: string[]
    }
    sectionB?: {
        clins: Array<{ clin: string; description: string; quantity: string }>
    }
}
