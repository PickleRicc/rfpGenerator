export interface Database {
    public: {
        Tables: {
            companies: {
                Row: {
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
                    created_at: string
                }
                Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['companies']['Insert']>
            }
            past_performance: {
                Row: {
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
                    created_at: string
                }
                Insert: Omit<Database['public']['Tables']['past_performance']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['past_performance']['Insert']>
            }
            personnel: {
                Row: {
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
                    created_at: string
                }
                Insert: Omit<Database['public']['Tables']['personnel']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['personnel']['Insert']>
            }
            labor_rates: {
                Row: {
                    id: string
                    company_id: string
                    category: string
                    hourly_rate: number
                    created_at: string
                }
                Insert: Omit<Database['public']['Tables']['labor_rates']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['labor_rates']['Insert']>
            }
            proposal_jobs: {
                Row: {
                    job_id: string
                    company_id: string
                    status: 'processing' | 'completed' | 'failed'
                    progress_percent: number
                    current_step: string
                    sections_completed: string[]
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
                    created_at: string
                    completed_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['proposal_jobs']['Row'], 'created_at'>
                Update: Partial<Database['public']['Tables']['proposal_jobs']['Insert']>
            }
        }
    }
}

export type Company = Database['public']['Tables']['companies']['Row']
export type PastPerformance = Database['public']['Tables']['past_performance']['Row']
export type Personnel = Database['public']['Tables']['personnel']['Row']
export type LaborRate = Database['public']['Tables']['labor_rates']['Row']
export type ProposalJob = Database['public']['Tables']['proposal_jobs']['Row']

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
