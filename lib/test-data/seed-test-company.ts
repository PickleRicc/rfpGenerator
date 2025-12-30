/**
 * Test Company Seed Data
 * 
 * Creates a realistic federal contractor company with complete
 * intake data for testing the full proposal generation pipeline.
 * 
 * NOTE: This uses only columns that exist in the actual database schema.
 */

import { supabase } from '../supabase'

// =============================================================================
// TEST COMPANY DATA
// =============================================================================

// Companies table - original columns + migration 001 additions
export const TEST_COMPANY_DATA = {
    name: 'CloudSecure Federal Solutions',
    business_type: ['Small Business', 'IT Services', 'Cybersecurity'],
    certifications: ['8(a)', 'SDVOSB', 'ISO 27001', 'CMMC Level 2'],
    duns: '078945612',
    cage_code: 'CS7F2',
    uei: 'CSFS12345678',
    founded_year: 2015,
    employee_count: 85,
    annual_revenue: 18500000,
    capabilities_statement: 'CloudSecure Federal Solutions is a Service-Disabled Veteran-Owned Small Business specializing in cloud migration, DevSecOps implementation, and cybersecurity services for federal agencies. We hold CMMC Level 2 certification and have successfully delivered over $75M in federal contracts.',
    address: {
        street: '1850 Centennial Park Drive, Suite 400',
        city: 'Reston',
        state: 'VA',
        zip: '20191',
    },
    naics_codes: [
        { code: '541512', description: 'Computer Systems Design Services', is_primary: true },
        { code: '541519', description: 'Other Computer Related Services', is_primary: false },
        { code: '541611', description: 'Administrative Management Consulting', is_primary: false },
    ],
    // Added by migration 001:
    business_structure: 'LLC',
    ein: '52-1234567',
    intake_complete: false,
}

// =============================================================================
// PAST PERFORMANCE - Original columns + migration 001 additions
// Original: project_name, agency, contract_number, contract_value, start_date, 
//           end_date, scope, performance_summary, poc_name, poc_email, poc_phone
// Added by 001: customer_office, contract_type, poc_title, poc_verified_date, 
//               relevance_tags, cpars_rating, quantified_outcomes
// =============================================================================

export const TEST_PAST_PERFORMANCE = [
    {
        project_name: 'DoD Cloud Migration Program',
        agency: 'Department of Defense',
        contract_number: 'HC1028-20-F-0147',
        contract_value: 12500000,
        start_date: '2020-10-01',
        end_date: '2024-09-30',
        scope: 'Led comprehensive migration of 47 legacy applications to AWS GovCloud (IL5), implementing Zero Trust Architecture and automated CI/CD pipelines. Achieved FedRAMP High authorization for all migrated systems.',
        performance_summary: 'Delivered all migration milestones ahead of schedule with 99.97% uptime. Reduced operational costs by 34% and deployment time by 78% through automation.',
        poc_name: 'Col. James Mitchell',
        poc_email: 'james.mitchell@disa.mil',
        poc_phone: '703-555-0147',
        // Added columns from migration 001:
        customer_office: 'Defense Information Systems Agency (DISA)',
        contract_type: 'FFP',
        poc_title: 'Program Manager',
        poc_verified_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        relevance_tags: ['Cloud', 'DoD', 'IL5', 'DevSecOps', 'Migration'],
        cpars_rating: 'Exceptional',
        quantified_outcomes: [
            { metric: 'System Uptime', value: '99.97%' },
            { metric: 'Cost Reduction', value: '34%' },
        ],
    },
    {
        project_name: 'VA Enterprise Security Operations Center',
        agency: 'Department of Veterans Affairs',
        contract_number: 'VA118-21-D-0089',
        contract_value: 8750000,
        start_date: '2021-03-15',
        end_date: '2025-03-14',
        scope: 'Designed and implemented enterprise Security Operations Center (SOC) with 24/7 monitoring capabilities. Deployed SIEM solution with custom threat detection rules.',
        performance_summary: 'Reduced mean time to detect (MTTD) from 72 hours to 4 hours. Blocked over 2.3 million attempted intrusions in first year.',
        poc_name: 'Sarah Chen',
        poc_email: 'sarah.chen@va.gov',
        poc_phone: '202-555-0234',
        customer_office: 'Office of Information Technology',
        contract_type: 'T&M',
        poc_title: 'Deputy CISO',
        poc_verified_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        relevance_tags: ['Security', 'Cybersecurity'],
        cpars_rating: 'Very Good',
        quantified_outcomes: [
            { metric: 'MTTD Reduction', value: '94%' },
            { metric: 'Intrusions Blocked', value: '2.3M+' },
        ],
    },
    {
        project_name: 'DHS Container Platform Modernization',
        agency: 'Department of Homeland Security',
        contract_number: 'HSHQDC-22-C-0056',
        contract_value: 6200000,
        start_date: '2022-01-01',
        end_date: '2024-12-31',
        scope: 'Architected and deployed enterprise Kubernetes platform on AWS GovCloud with automated security scanning.',
        performance_summary: 'Achieved 85% reduction in infrastructure costs through containerization. Platform handles 50,000+ daily transactions.',
        poc_name: 'Michael Rodriguez',
        poc_email: 'michael.rodriguez@cisa.dhs.gov',
        poc_phone: '202-555-0891',
        customer_office: 'CISA',
        contract_type: 'Cost-Plus',
        poc_title: 'Technical Director',
        poc_verified_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        relevance_tags: ['Cloud', 'DevSecOps', 'Infrastructure'],
        cpars_rating: 'Exceptional',
        quantified_outcomes: [
            { metric: 'Cost Reduction', value: '85%' },
        ],
    },
    {
        project_name: 'Army Network Infrastructure Assessment',
        agency: 'Department of the Army',
        contract_number: 'W52P1J-19-D-0023',
        contract_value: 4800000,
        start_date: '2019-06-01',
        end_date: '2023-05-31',
        scope: 'Conducted comprehensive security assessments of 12 Army installations, identified 847 vulnerabilities.',
        performance_summary: 'Zero security incidents at assessed installations post-remediation. Developed reusable assessment framework adopted Army-wide.',
        poc_name: 'Lt. Col. Patricia Williams',
        poc_email: 'patricia.williams@army.mil',
        poc_phone: '703-555-0567',
        customer_office: 'NETCOM',
        contract_type: 'IDIQ',
        poc_title: 'Cybersecurity Division Chief',
        poc_verified_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        relevance_tags: ['Security', 'DoD', 'Cybersecurity'],
        cpars_rating: 'Very Good',
        quantified_outcomes: [
            { metric: 'Vulnerabilities Identified', value: '847' },
        ],
    },
]

// =============================================================================
// PERSONNEL - Original columns + migration 001 additions
// Original: name, title, years_experience, clearance_level, expertise, 
//           certifications, resume_summary
// Added by 001: clearance_status, resume_url, commitment_letter, 
//               resume_updated_date, availability
// NOTE: 'role' column does NOT exist!
// =============================================================================

// NOTE: In the original DB schema, 'expertise' is a text[] array, not a string!
export const TEST_PERSONNEL = [
    {
        name: 'Robert Martinez',
        title: 'Chief Executive Officer',
        role: 'Program Manager',
        years_experience: 22,
        clearance_level: 'Top Secret',
        expertise: ['Program Management', 'Federal Acquisition', 'Strategic Planning', 'IT Leadership'],
        certifications: ['PMP', 'CISSP'],
        resume_summary: 'Rob Martinez brings 22 years of experience leading complex federal IT programs.',
        clearance_status: 'Active',
        commitment_letter: true,
        resume_updated_date: '2024-01-15',
        availability: 'Full-time',
    },
    {
        name: 'Dr. Emily Nakamura',
        title: 'Chief Technology Officer',
        role: 'Technical Lead',
        years_experience: 18,
        clearance_level: 'TS/SCI',
        expertise: ['Cloud Architecture', 'DevSecOps', 'Zero Trust Security', 'Distributed Systems'],
        certifications: ['AWS Solutions Architect Professional', 'CISSP', 'CCSP'],
        resume_summary: 'Dr. Nakamura is a recognized expert in federal cloud architecture with 18 years of experience.',
        clearance_status: 'Active',
        commitment_letter: true,
        resume_updated_date: '2024-02-01',
        availability: 'Full-time',
    },
    {
        name: 'Marcus Thompson',
        title: 'Director of Cybersecurity',
        role: 'Security Lead',
        years_experience: 15,
        clearance_level: 'Top Secret',
        expertise: ['Cybersecurity Operations', 'NIST Frameworks', 'Vulnerability Management', 'Incident Response'],
        certifications: ['CISSP', 'CISM', 'CEH'],
        resume_summary: 'Marcus Thompson has 15 years of federal cybersecurity experience.',
        clearance_status: 'Active',
        commitment_letter: true,
        resume_updated_date: '2024-01-20',
        availability: 'Full-time',
    },
    {
        name: 'Jennifer Park',
        title: 'DevSecOps Practice Lead',
        role: 'DevSecOps Lead',
        years_experience: 12,
        clearance_level: 'Secret',
        expertise: ['CI/CD Pipelines', 'Infrastructure as Code', 'Container Orchestration', 'Kubernetes'],
        certifications: ['AWS DevOps Engineer Professional', 'CKA', 'Terraform Associate'],
        resume_summary: 'Jennifer Park is a DevSecOps expert with 12 years of experience.',
        clearance_status: 'Active',
        commitment_letter: true,
        resume_updated_date: '2024-02-10',
        availability: 'Full-time',
    },
    {
        name: 'David Chen',
        title: 'Principal Cloud Architect',
        role: 'Cloud Architect',
        years_experience: 14,
        clearance_level: 'Top Secret',
        expertise: ['Multi-Cloud Architecture', 'AWS GovCloud', 'Azure Government', 'FedRAMP'],
        certifications: ['AWS Solutions Architect Professional', 'Azure Solutions Architect Expert'],
        resume_summary: 'David Chen has designed cloud solutions for 20+ federal agencies.',
        clearance_status: 'Active',
        commitment_letter: true,
        resume_updated_date: '2024-01-25',
        availability: 'Full-time',
    },
    {
        name: 'Amanda Foster',
        title: 'Quality Assurance Director',
        role: 'QA Lead',
        years_experience: 10,
        clearance_level: 'Secret',
        expertise: ['Test Automation', 'Quality Management Systems', 'Agile Testing', 'CMMI'],
        certifications: ['ISTQB Advanced Test Manager', 'SAFe Agilist'],
        resume_summary: 'Amanda Foster has 10 years of experience in federal QA.',
        clearance_status: 'Active',
        commitment_letter: true,
        resume_updated_date: '2024-02-05',
        availability: 'Full-time',
    },
]

// =============================================================================
// LABOR RATES - From migration 003 (fresh table)
// =============================================================================

export const TEST_LABOR_RATES = [
    { category: 'Program Manager', hourly_rate: 185, year_1_rate: 185, escalation_rate: 3 },
    { category: 'Technical Lead/Architect', hourly_rate: 175, year_1_rate: 175, escalation_rate: 3 },
    { category: 'Security Engineer III', hourly_rate: 165, year_1_rate: 165, escalation_rate: 3 },
    { category: 'DevSecOps Engineer III', hourly_rate: 160, year_1_rate: 160, escalation_rate: 3 },
    { category: 'Cloud Engineer III', hourly_rate: 155, year_1_rate: 155, escalation_rate: 3 },
    { category: 'Cloud Engineer II', hourly_rate: 135, year_1_rate: 135, escalation_rate: 3 },
    { category: 'Systems Administrator III', hourly_rate: 125, year_1_rate: 125, escalation_rate: 3 },
    { category: 'Systems Administrator II', hourly_rate: 105, year_1_rate: 105, escalation_rate: 3 },
    { category: 'Quality Assurance Engineer', hourly_rate: 115, year_1_rate: 115, escalation_rate: 3 },
    { category: 'Technical Writer', hourly_rate: 95, year_1_rate: 95, escalation_rate: 3 },
]

// =============================================================================
// CLIENT INTAKE - From migration 005 (fresh table)
// =============================================================================

export const TEST_CLIENT_INTAKE = {
    status: 'draft',
    
    // Section 1: Company Identifiers
    legal_name: 'CloudSecure Federal Solutions, LLC',
    dba_name: 'CloudSecure',
    uei: 'CSFS12345678',
    cage_code: 'CS7F2',
    duns: '078945612',
    ein: '52-1234567',
    business_structure: 'LLC',
    years_in_business: 9,
    employee_count: 85,
    annual_revenue: 18500000,
    primary_naics: '541512',
    secondary_naics: ['541519', '541611', '518210'],
    set_aside_certifications: [
        { type: '8(a)', cert_number: 'SBA-8A-2019-0456', expiration_date: '2028-03-15' },
        { type: 'SDVOSB', cert_number: 'VA-SDVOSB-2018-1234', expiration_date: null },
    ],
    
    // Section 2: Security Certifications
    cmmc_level: 'Level 2',
    cmmc_cert_number: 'CMMC-2023-04521',
    cmmc_expiration: '2026-09-30',
    fedramp_level: 'Moderate',
    security_certifications: [
        { type: 'ISO 27001', cert_number: 'ISO27001-2022-8923', expiration_date: '2025-12-15' },
    ],
    
    // Section 5: Technical Capabilities
    cloud_platforms: [
        { platform: 'AWS', certification_level: 'Professional' },
        { platform: 'Azure', certification_level: 'Professional' },
    ],
    iac_tools: ['Terraform', 'CloudFormation'],
    container_tools: ['Docker', 'Kubernetes', 'ECS/EKS'],
    cicd_tools: ['GitLab', 'Jenkins', 'GitHub Actions'],
    security_tools: {
        siem: ['Splunk', 'Azure Sentinel'],
        vulnerability_scanners: ['Nessus', 'Qualys'],
        cmmc_controls: ['Microsoft 365 GCC High', 'CrowdStrike'],
    },
    methodologies: ['Agile', 'SAFe', 'DevSecOps', 'ITIL'],
    proprietary_tools: [
        { 
            name: 'CloudSecure Compliance Engine', 
            description: 'Automated compliance monitoring', 
            benefits: 'Reduces audit prep time by 70%' 
        },
    ],
    
    // Section 6: Pricing Assumptions
    escalation_rate: 3,
    overhead_rate: 45,
    ga_rate: 12,
    fee_margin: 10,
    fringe_rate: 35,
    travel_budget: 75000,
    license_costs: 50000,
    cloud_costs: 150000,
    
    // Section 7: Facilities
    primary_office: {
        street: '1850 Centennial Park Drive, Suite 400',
        city: 'Reston',
        state: 'VA',
        zip: '20191',
    },
    additional_locations: [],
    facility_clearance: 'FCL Secret',
    existing_infrastructure: 'AWS GovCloud (IL4/IL5), Azure Government, dedicated SCIF.',
    
    // Subcontractors
    subcontractors: [
        {
            name: 'CyberShield Partners',
            cage_code: 'CSP45',
            uei: 'CSPX87654321',
            small_business_status: 'SDVOSB',
            scope_of_work: 'Penetration testing and security assessments',
            percentage_of_value: 15,
        },
    ],
}

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

export async function seedTestCompany(): Promise<{
    companyId: string
    intakeId: string
    success: boolean
    error?: string
}> {
    console.log('[Seed] Starting test company creation...')
    
    try {
        // 1. Create the company
        console.log('[Seed] Creating company...')
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: company, error: companyError } = await (supabase
            .from('companies') as any)
            .insert(TEST_COMPANY_DATA)
            .select()
            .single()

        if (companyError) {
            console.error('[Seed] Company error:', companyError)
            throw new Error(`Failed to create company: ${companyError.message}`)
        }
        console.log(`[Seed] ✓ Company created: ${company.id}`)

        const companyId = company.id

        // 2. Create past performance records
        console.log('[Seed] Creating past performance records...')
        const ppWithCompanyId = TEST_PAST_PERFORMANCE.map(pp => ({
            ...pp,
            company_id: companyId,
        }))
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: ppError } = await (supabase
            .from('past_performance') as any)
            .insert(ppWithCompanyId)

        if (ppError) {
            console.error('[Seed] Past performance error:', ppError)
            throw new Error(`Failed to create past performance: ${ppError.message}`)
        }
        console.log(`[Seed] ✓ Created ${TEST_PAST_PERFORMANCE.length} past performance records`)

        // 3. Create personnel records
        console.log('[Seed] Creating personnel records...')
        const personnelWithCompanyId = TEST_PERSONNEL.map(p => ({
            ...p,
            company_id: companyId,
        }))
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: personnelError } = await (supabase
            .from('personnel') as any)
            .insert(personnelWithCompanyId)

        if (personnelError) {
            console.error('[Seed] Personnel error:', personnelError)
            throw new Error(`Failed to create personnel: ${personnelError.message}`)
        }
        console.log(`[Seed] ✓ Created ${TEST_PERSONNEL.length} personnel records`)

        // 4. Create labor rates
        console.log('[Seed] Creating labor rates...')
        const ratesWithCompanyId = TEST_LABOR_RATES.map(r => ({
            ...r,
            company_id: companyId,
        }))
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: ratesError } = await (supabase
            .from('labor_rates') as any)
            .insert(ratesWithCompanyId)

        if (ratesError) {
            console.error('[Seed] Labor rates error:', ratesError)
            throw new Error(`Failed to create labor rates: ${ratesError.message}`)
        }
        console.log(`[Seed] ✓ Created ${TEST_LABOR_RATES.length} labor rate categories`)

        // 5. Create client intake record
        console.log('[Seed] Creating client intake record...')
        const intakeWithCompanyId = {
            ...TEST_CLIENT_INTAKE,
            company_id: companyId,
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: intake, error: intakeError } = await (supabase
            .from('client_intake') as any)
            .insert(intakeWithCompanyId)
            .select()
            .single()

        if (intakeError) {
            console.error('[Seed] Intake error:', intakeError)
            throw new Error(`Failed to create intake: ${intakeError.message}`)
        }
        console.log(`[Seed] ✓ Client intake created: ${intake.id}`)

        console.log('[Seed] =====================================')
        console.log('[Seed] ✅ Test company created successfully!')
        console.log(`[Seed] Company ID: ${companyId}`)
        console.log(`[Seed] Intake ID: ${intake.id}`)
        console.log(`[Seed] Name: ${TEST_COMPANY_DATA.name}`)
        console.log('[Seed] =====================================')

        return {
            companyId,
            intakeId: intake.id,
            success: true,
        }
    } catch (error) {
        console.error('[Seed] ❌ Error:', error)
        return {
            companyId: '',
            intakeId: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}

export async function deleteTestCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[Seed] Deleting test company ${companyId}...`)
    
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('client_intake') as any).delete().eq('company_id', companyId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('labor_rates') as any).delete().eq('company_id', companyId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('personnel') as any).delete().eq('company_id', companyId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('past_performance') as any).delete().eq('company_id', companyId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('companies') as any).delete().eq('id', companyId)

        console.log('[Seed] ✓ Test company deleted')
        return { success: true }
    } catch (error) {
        console.error('[Seed] ❌ Delete error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}
