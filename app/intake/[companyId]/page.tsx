'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    ValidatedInput,
    FormSection,
    FileUpload,
    RepeatableSection,
    IntakeProgress,
    SelectInput,
    CheckboxGroup,
    VALIDATION_PATTERNS,
} from '@/components/intake'

// Types
interface PastPerformanceEntry {
    contract_number: string
    contract_title: string
    customer_agency: string
    customer_office: string
    contract_type: string
    contract_value: string
    start_date: string
    end_date: string
    poc_name: string
    poc_title: string
    poc_phone: string
    poc_email: string
    poc_verified_date: string
    scope: string
    relevance_tags: string[]
    cpars_rating: string
    outcome_1_metric: string
    outcome_1_value: string
    outcome_2_metric: string
    outcome_2_value: string
}

interface PersonnelEntry {
    full_name: string
    role: string
    years_experience: string
    availability: string
    commitment_letter: boolean
    clearance_level: string
    clearance_status: string
    clearance_investigation_date: string
    cert_1_name: string
    cert_1_number: string
    cert_1_expiration: string
    cert_2_name: string
    cert_2_number: string
    cert_2_expiration: string
    resume_file: { name: string; size: number; type: string } | null
}

interface LaborRateEntry {
    category: string
    year_1_rate: string
    escalation_rate: string
}

interface SubcontractorEntry {
    name: string
    cage_code: string
    uei: string
    small_business_status: string
    scope_of_work: string
    percentage_of_value: string
}

interface IntakeFormData {
    // Section 1: Company Identifiers
    legal_name: string
    dba_name: string
    uei: string
    cage_code: string
    duns: string
    ein: string
    business_structure: string
    years_in_business: string
    employee_count: string
    annual_revenue: string
    primary_naics: string
    secondary_naics: string[]
    small_business: boolean
    eight_a: boolean
    eight_a_expiration: string
    sdvosb: boolean
    sdvosb_expiration: string
    wosb: boolean
    wosb_expiration: string
    hubzone: boolean
    hubzone_expiration: string

    // Section 2: Security Certifications
    cmmc_level: string
    cmmc_cert_number: string
    cmmc_expiration: string
    iso_9001: boolean
    iso_9001_expiration: string
    iso_27001: boolean
    iso_27001_expiration: string
    iso_20000: boolean
    iso_20000_expiration: string
    fedramp_level: string

    // Section 3: Past Performance
    past_performance: PastPerformanceEntry[]

    // Section 4: Key Personnel
    personnel: PersonnelEntry[]

    // Section 5: Technical Capabilities
    cloud_aws: boolean
    cloud_aws_level: string
    cloud_azure: boolean
    cloud_azure_level: string
    cloud_gcp: boolean
    cloud_gcp_level: string
    iac_tools: string[]
    container_tools: string[]
    cicd_tools: string[]
    siem_tools: string
    vulnerability_scanners: string
    methodologies: string[]

    // Section 6: Labor Rates
    labor_rates: LaborRateEntry[]
    escalation_rate: string
    overhead_rate: string
    ga_rate: string
    fee_margin: string
    fringe_rate: string
    rate_source: string
    gsa_schedule_number: string
    rate_justification: string
    travel_budget: string
    license_costs: string
    cloud_costs: string

    // Section 7: Facilities & Subcontractors
    primary_office_street: string
    primary_office_city: string
    primary_office_state: string
    primary_office_zip: string
    facility_clearance: string
    existing_infrastructure: string
    subcontractors: SubcontractorEntry[]
}

const emptyPastPerformance: PastPerformanceEntry = {
    contract_number: '',
    contract_title: '',
    customer_agency: '',
    customer_office: '',
    contract_type: '',
    contract_value: '',
    start_date: '',
    end_date: '',
    poc_name: '',
    poc_title: '',
    poc_phone: '',
    poc_email: '',
    poc_verified_date: '',
    scope: '',
    relevance_tags: [],
    cpars_rating: '',
    outcome_1_metric: '',
    outcome_1_value: '',
    outcome_2_metric: '',
    outcome_2_value: '',
}

const emptyPersonnel: PersonnelEntry = {
    full_name: '',
    role: '',
    years_experience: '',
    availability: '',
    commitment_letter: false,
    clearance_level: '',
    clearance_status: '',
    clearance_investigation_date: '',
    cert_1_name: '',
    cert_1_number: '',
    cert_1_expiration: '',
    cert_2_name: '',
    cert_2_number: '',
    cert_2_expiration: '',
    resume_file: null,
}

const emptyLaborRate: LaborRateEntry = {
    category: '',
    year_1_rate: '',
    escalation_rate: '3',
}

const emptySubcontractor: SubcontractorEntry = {
    name: '',
    cage_code: '',
    uei: '',
    small_business_status: '',
    scope_of_work: '',
    percentage_of_value: '',
}

const initialFormData: IntakeFormData = {
    // Section 1
    legal_name: '',
    dba_name: '',
    uei: '',
    cage_code: '',
    duns: '',
    ein: '',
    business_structure: '',
    years_in_business: '',
    employee_count: '',
    annual_revenue: '',
    primary_naics: '',
    secondary_naics: [],
    small_business: false,
    eight_a: false,
    eight_a_expiration: '',
    sdvosb: false,
    sdvosb_expiration: '',
    wosb: false,
    wosb_expiration: '',
    hubzone: false,
    hubzone_expiration: '',

    // Section 2
    cmmc_level: '',
    cmmc_cert_number: '',
    cmmc_expiration: '',
    iso_9001: false,
    iso_9001_expiration: '',
    iso_27001: false,
    iso_27001_expiration: '',
    iso_20000: false,
    iso_20000_expiration: '',
    fedramp_level: '',

    // Section 3
    past_performance: [],

    // Section 4
    personnel: [],

    // Section 5
    cloud_aws: false,
    cloud_aws_level: '',
    cloud_azure: false,
    cloud_azure_level: '',
    cloud_gcp: false,
    cloud_gcp_level: '',
    iac_tools: [],
    container_tools: [],
    cicd_tools: [],
    siem_tools: '',
    vulnerability_scanners: '',
    methodologies: [],

    // Section 6
    labor_rates: [],
    escalation_rate: '3',
    overhead_rate: '',
    ga_rate: '',
    fee_margin: '',
    fringe_rate: '',
    rate_source: '',
    gsa_schedule_number: '',
    rate_justification: '',
    travel_budget: '',
    license_costs: '',
    cloud_costs: '',

    // Section 7
    primary_office_street: '',
    primary_office_city: '',
    primary_office_state: '',
    primary_office_zip: '',
    facility_clearance: '',
    existing_infrastructure: '',
    subcontractors: [],
}

// Options
const businessStructureOptions = [
    { value: 'LLC', label: 'LLC' },
    { value: 'S-Corp', label: 'S-Corp' },
    { value: 'C-Corp', label: 'C-Corp' },
    { value: 'Partnership', label: 'Partnership' },
    { value: 'Sole Proprietor', label: 'Sole Proprietor' },
]

const cmmcLevelOptions = [
    { value: 'None', label: 'None' },
    { value: 'Level 1', label: 'Level 1' },
    { value: 'Level 2', label: 'Level 2' },
    { value: 'Level 3', label: 'Level 3' },
]

const fedRampOptions = [
    { value: 'None', label: 'None' },
    { value: 'Low', label: 'Low' },
    { value: 'Moderate', label: 'Moderate' },
    { value: 'High', label: 'High' },
]

const contractTypeOptions = [
    { value: 'FFP', label: 'Firm Fixed Price (FFP)' },
    { value: 'T&M', label: 'Time & Materials (T&M)' },
    { value: 'Cost-Plus', label: 'Cost-Plus' },
    { value: 'IDIQ', label: 'IDIQ' },
    { value: 'BPA', label: 'BPA' },
]

const cparsOptions = [
    { value: 'Exceptional', label: 'Exceptional' },
    { value: 'Very Good', label: 'Very Good' },
    { value: 'Satisfactory', label: 'Satisfactory' },
    { value: 'Marginal', label: 'Marginal' },
    { value: 'Unsatisfactory', label: 'Unsatisfactory' },
    { value: 'N/A', label: 'N/A (No CPARS)' },
]

const relevanceTagOptions = [
    { value: 'Cloud', label: 'Cloud' },
    { value: 'DoD', label: 'DoD' },
    { value: 'IL5', label: 'IL5' },
    { value: 'DevSecOps', label: 'DevSecOps' },
    { value: 'Migration', label: 'Migration' },
    { value: 'Security', label: 'Security' },
    { value: 'AI/ML', label: 'AI/ML' },
    { value: 'Data Analytics', label: 'Data Analytics' },
    { value: 'Cybersecurity', label: 'Cybersecurity' },
    { value: 'Infrastructure', label: 'Infrastructure' },
]

const roleOptions = [
    { value: 'Program Manager', label: 'Program Manager' },
    { value: 'Technical Lead', label: 'Technical Lead' },
    { value: 'Security Lead', label: 'Security Lead' },
    { value: 'DevSecOps Lead', label: 'DevSecOps Lead' },
    { value: 'Cloud Architect', label: 'Cloud Architect' },
    { value: 'QA Lead', label: 'QA Lead' },
    { value: 'Other', label: 'Other' },
]

const clearanceLevelOptions = [
    { value: 'None', label: 'None' },
    { value: 'Secret', label: 'Secret' },
    { value: 'Top Secret', label: 'Top Secret' },
    { value: 'TS/SCI', label: 'TS/SCI' },
]

const clearanceStatusOptions = [
    { value: 'Active', label: 'Active' },
    { value: 'Current', label: 'Current' },
    { value: 'Expired', label: 'Expired' },
    { value: 'In Progress', label: 'In Progress' },
]

const availabilityOptions = [
    { value: 'Full-time', label: 'Full-time' },
    { value: 'Part-time 50%', label: 'Part-time 50%' },
    { value: 'Part-time 25%', label: 'Part-time 25%' },
    { value: 'As-needed', label: 'As-needed' },
]

const cloudCertOptions = [
    { value: 'None', label: 'None' },
    { value: 'Associate', label: 'Associate' },
    { value: 'Professional', label: 'Professional' },
    { value: 'Specialty', label: 'Specialty' },
]

const iacToolOptions = [
    { value: 'Terraform', label: 'Terraform' },
    { value: 'CloudFormation', label: 'CloudFormation' },
    { value: 'ARM Templates', label: 'ARM Templates' },
    { value: 'Pulumi', label: 'Pulumi' },
]

const containerToolOptions = [
    { value: 'Docker', label: 'Docker' },
    { value: 'Kubernetes', label: 'Kubernetes' },
    { value: 'OpenShift', label: 'OpenShift' },
    { value: 'ECS/EKS', label: 'ECS/EKS' },
]

const cicdToolOptions = [
    { value: 'GitLab', label: 'GitLab CI/CD' },
    { value: 'Jenkins', label: 'Jenkins' },
    { value: 'GitHub Actions', label: 'GitHub Actions' },
    { value: 'Azure DevOps', label: 'Azure DevOps' },
    { value: 'CircleCI', label: 'CircleCI' },
]

const methodologyOptions = [
    { value: 'Agile', label: 'Agile' },
    { value: 'SAFe', label: 'SAFe' },
    { value: 'DevSecOps', label: 'DevSecOps' },
    { value: 'ITIL', label: 'ITIL' },
]

const rateSourceOptions = [
    { value: 'GSA Schedule 70', label: 'GSA Schedule 70' },
    { value: 'Market Research', label: 'Market Research' },
    { value: 'Historical Rates', label: 'Historical Rates' },
    { value: 'Competitive Analysis', label: 'Competitive Analysis' },
]

const facilityClearanceOptions = [
    { value: 'None', label: 'None' },
    { value: 'FCL Confidential', label: 'FCL Confidential' },
    { value: 'FCL Secret', label: 'FCL Secret' },
    { value: 'FCL Top Secret', label: 'FCL Top Secret' },
]

const smallBusinessOptions = [
    { value: 'Large', label: 'Large Business' },
    { value: 'Small', label: 'Small Business' },
    { value: '8(a)', label: '8(a)' },
    { value: 'SDVOSB', label: 'SDVOSB' },
    { value: 'WOSB', label: 'WOSB' },
    { value: 'HUBZone', label: 'HUBZone' },
]

export default function IntakePage() {
    const params = useParams()
    const router = useRouter()
    const companyId = params.companyId as string

    const [formData, setFormData] = useState<IntakeFormData>(initialFormData)
    const [currentSection, setCurrentSection] = useState('section-1')
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null)

    // Section completion checks
    const isSection1Complete = Boolean(
        formData.legal_name &&
        formData.uei &&
        formData.cage_code &&
        formData.business_structure &&
        formData.primary_naics
    )

    const isSection2Complete = Boolean(formData.cmmc_level)

    const isSection3Complete = formData.past_performance.length >= 3

    const isSection4Complete = formData.personnel.length >= 4

    const isSection5Complete = Boolean(
        (formData.cloud_aws || formData.cloud_azure || formData.cloud_gcp) &&
        formData.methodologies.length > 0
    )

    const isSection6Complete = Boolean(
        formData.labor_rates.length > 0 &&
        formData.overhead_rate &&
        formData.ga_rate
    )

    const isSection7Complete = Boolean(
        formData.primary_office_street &&
        formData.primary_office_city &&
        formData.primary_office_state
    )

    const sections = [
        { id: 'section-1', title: 'Company Identifiers', isComplete: isSection1Complete },
        { id: 'section-2', title: 'Security Certifications', isComplete: isSection2Complete },
        { id: 'section-3', title: 'Past Performance', isComplete: isSection3Complete },
        { id: 'section-4', title: 'Key Personnel', isComplete: isSection4Complete },
        { id: 'section-5', title: 'Technical Capabilities', isComplete: isSection5Complete },
        { id: 'section-6', title: 'Labor Rates & Pricing', isComplete: isSection6Complete },
        { id: 'section-7', title: 'Facilities & Subcontractors', isComplete: isSection7Complete },
    ]

    // Load existing data
    useEffect(() => {
        const loadData = async () => {
            try {
                // In a real app, fetch from API
                // const response = await fetch(`/api/intake/${companyId}`)
                // const data = await response.json()
                // setFormData(data)
                setIsLoading(false)
            } catch (error) {
                console.error('Failed to load intake data:', error)
                setIsLoading(false)
            }
        }
        loadData()
    }, [companyId])

    // Auto-save every 30 seconds
    useEffect(() => {
        if (autoSaveTimer.current) {
            clearInterval(autoSaveTimer.current)
        }

        autoSaveTimer.current = setInterval(() => {
            handleSave()
        }, 30000)

        return () => {
            if (autoSaveTimer.current) {
                clearInterval(autoSaveTimer.current)
            }
        }
    }, [formData])

    const handleSave = useCallback(async () => {
        setIsSaving(true)
        try {
            // In a real app, save to API
            // await fetch(`/api/intake/${companyId}`, {
            //     method: 'PUT',
            //     body: JSON.stringify(formData),
            // })
            await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API call
            setLastSaved(new Date())
        } catch (error) {
            console.error('Failed to save:', error)
        } finally {
            setIsSaving(false)
        }
    }, [formData, companyId])

    const handleFieldChange = useCallback((name: string, value: string | string[] | boolean) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }, [])

    const handlePastPerformanceChange = useCallback((index: number, field: string, value: string | string[]) => {
        setFormData(prev => {
            const updated = [...prev.past_performance]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, past_performance: updated }
        })
    }, [])

    const handlePersonnelChange = useCallback((index: number, field: string, value: string | boolean | { name: string; size: number; type: string } | null) => {
        setFormData(prev => {
            const updated = [...prev.personnel]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, personnel: updated }
        })
    }, [])

    const handleLaborRateChange = useCallback((index: number, field: string, value: string) => {
        setFormData(prev => {
            const updated = [...prev.labor_rates]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, labor_rates: updated }
        })
    }, [])

    const handleSubcontractorChange = useCallback((index: number, field: string, value: string) => {
        setFormData(prev => {
            const updated = [...prev.subcontractors]
            updated[index] = { ...updated[index], [field]: value }
            return { ...prev, subcontractors: updated }
        })
    }, [])

    const handleSubmit = async () => {
        await handleSave()
        // Navigate to validation or proposal creation
        router.push(`/proposals/create?company=${companyId}`)
    }

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ color: '#9ca3af' }}>Loading...</div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0a0a0a',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* Header */}
            <div style={{
                borderBottom: '1px solid #1a1a1a',
                padding: '20px 32px',
            }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => router.back()}
                            style={{
                                padding: '8px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#6b7280',
                            }}
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: '#e5e5e5' }}>
                                Client Intake Form
                            </h1>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
                                Complete all sections to enable proposal generation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!sections.every(s => s.isComplete)}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: sections.every(s => s.isComplete) ? '#ea580c' : '#1a1a1a',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: sections.every(s => s.isComplete) ? 'white' : '#4b5563',
                            cursor: sections.every(s => s.isComplete) ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Submit & Continue
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px', display: 'flex', gap: '32px' }}>
                {/* Form sections */}
                <div style={{ flex: 1 }}>
                    {/* Section 1: Company Identifiers */}
                    <FormSection
                        title="Company Identifiers"
                        description="Required for compliance verification"
                        sectionNumber={1}
                        isComplete={isSection1Complete}
                        isExpanded={currentSection === 'section-1'}
                        onToggle={() => setCurrentSection('section-1')}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                            <ValidatedInput
                                label="Legal Business Name"
                                name="legal_name"
                                value={formData.legal_name}
                                onChange={handleFieldChange}
                                required
                                placeholder="Acme Corporation, Inc."
                            />
                            <ValidatedInput
                                label="DBA / Trading Name"
                                name="dba_name"
                                value={formData.dba_name}
                                onChange={handleFieldChange}
                                placeholder="Acme Corp"
                            />
                            <ValidatedInput
                                label="SAM.gov UEI Number"
                                name="uei"
                                value={formData.uei}
                                onChange={handleFieldChange}
                                required
                                pattern={VALIDATION_PATTERNS.UEI}
                                patternMessage="UEI must be 12 alphanumeric characters"
                                placeholder="AB1C2D3EF4GH"
                                helpText="12-character unique entity identifier"
                            />
                            <ValidatedInput
                                label="CAGE Code"
                                name="cage_code"
                                value={formData.cage_code}
                                onChange={handleFieldChange}
                                required
                                pattern={VALIDATION_PATTERNS.CAGE}
                                patternMessage="CAGE must be 5 alphanumeric characters"
                                placeholder="1ABC2"
                            />
                            <ValidatedInput
                                label="DUNS Number (Legacy)"
                                name="duns"
                                value={formData.duns}
                                onChange={handleFieldChange}
                                pattern={VALIDATION_PATTERNS.DUNS}
                                patternMessage="DUNS must be 9 digits"
                                placeholder="123456789"
                            />
                            <ValidatedInput
                                label="Tax ID / EIN"
                                name="ein"
                                value={formData.ein}
                                onChange={handleFieldChange}
                                pattern={VALIDATION_PATTERNS.EIN}
                                patternMessage="EIN format: XX-XXXXXXX"
                                placeholder="12-3456789"
                            />
                            <SelectInput
                                label="Business Structure"
                                name="business_structure"
                                value={formData.business_structure}
                                onChange={handleFieldChange}
                                options={businessStructureOptions}
                                required
                            />
                            <ValidatedInput
                                label="Years in Business"
                                name="years_in_business"
                                value={formData.years_in_business}
                                onChange={handleFieldChange}
                                type="number"
                                placeholder="15"
                            />
                            <ValidatedInput
                                label="Number of Employees"
                                name="employee_count"
                                value={formData.employee_count}
                                onChange={handleFieldChange}
                                type="number"
                                placeholder="150"
                            />
                            <ValidatedInput
                                label="Annual Revenue"
                                name="annual_revenue"
                                value={formData.annual_revenue}
                                onChange={handleFieldChange}
                                placeholder="25000000"
                                helpText="In dollars (no commas)"
                            />
                            <ValidatedInput
                                label="Primary NAICS Code"
                                name="primary_naics"
                                value={formData.primary_naics}
                                onChange={handleFieldChange}
                                required
                                pattern={VALIDATION_PATTERNS.NAICS}
                                patternMessage="NAICS must be 6 digits"
                                placeholder="541512"
                            />
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1a1a1a' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: '16px' }}>
                                Set-Aside Certifications
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.small_business}
                                        onChange={(e) => handleFieldChange('small_business', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>Small Business</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.eight_a}
                                        onChange={(e) => handleFieldChange('eight_a', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>8(a) Business Development</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.sdvosb}
                                        onChange={(e) => handleFieldChange('sdvosb', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>SDVOSB</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.wosb}
                                        onChange={(e) => handleFieldChange('wosb', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>WOSB</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.hubzone}
                                        onChange={(e) => handleFieldChange('hubzone', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>HUBZone</span>
                                </label>
                            </div>
                        </div>
                    </FormSection>

                    {/* Section 2: Security Certifications */}
                    <FormSection
                        title="Security & Compliance Certifications"
                        description="CMMC, ISO, FedRAMP certifications"
                        sectionNumber={2}
                        isComplete={isSection2Complete}
                        isExpanded={currentSection === 'section-2'}
                        onToggle={() => setCurrentSection('section-2')}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                            <SelectInput
                                label="CMMC Level"
                                name="cmmc_level"
                                value={formData.cmmc_level}
                                onChange={handleFieldChange}
                                options={cmmcLevelOptions}
                                required
                            />
                            <ValidatedInput
                                label="CMMC Certificate Number"
                                name="cmmc_cert_number"
                                value={formData.cmmc_cert_number}
                                onChange={handleFieldChange}
                                placeholder="If applicable"
                            />
                            <ValidatedInput
                                label="CMMC Expiration Date"
                                name="cmmc_expiration"
                                value={formData.cmmc_expiration}
                                onChange={handleFieldChange}
                                type="date"
                            />
                            <SelectInput
                                label="FedRAMP Authorization"
                                name="fedramp_level"
                                value={formData.fedramp_level}
                                onChange={handleFieldChange}
                                options={fedRampOptions}
                            />
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1a1a1a' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: '16px' }}>
                                ISO Certifications
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.iso_9001}
                                        onChange={(e) => handleFieldChange('iso_9001', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>ISO 9001 (Quality)</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.iso_27001}
                                        onChange={(e) => handleFieldChange('iso_27001', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>ISO 27001 (Security)</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.iso_20000}
                                        onChange={(e) => handleFieldChange('iso_20000', e.target.checked)}
                                    />
                                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>ISO 20000 (IT Service)</span>
                                </label>
                            </div>
                        </div>
                    </FormSection>

                    {/* Section 3: Past Performance */}
                    <FormSection
                        title="Past Performance"
                        description="Minimum 3 contracts required"
                        sectionNumber={3}
                        isComplete={isSection3Complete}
                        isExpanded={currentSection === 'section-3'}
                        onToggle={() => setCurrentSection('section-3')}
                    >
                        <RepeatableSection
                            title="Contracts"
                            items={formData.past_performance}
                            onAdd={() => setFormData(prev => ({
                                ...prev,
                                past_performance: [...prev.past_performance, { ...emptyPastPerformance }]
                            }))}
                            onRemove={(index) => setFormData(prev => ({
                                ...prev,
                                past_performance: prev.past_performance.filter((_, i) => i !== index)
                            }))}
                            minItems={3}
                            maxItems={5}
                            addButtonText="Add Contract"
                            emptyMessage="Add at least 3 past performance contracts"
                            renderItem={(item, index) => (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                    <ValidatedInput
                                        label="Contract Number"
                                        name="contract_number"
                                        value={item.contract_number}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        required
                                    />
                                    <ValidatedInput
                                        label="Contract Title"
                                        name="contract_title"
                                        value={item.contract_title}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        required
                                    />
                                    <ValidatedInput
                                        label="Customer Agency"
                                        name="customer_agency"
                                        value={item.customer_agency}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        required
                                        placeholder="Department of Defense"
                                    />
                                    <SelectInput
                                        label="Contract Type"
                                        name="contract_type"
                                        value={item.contract_type}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        options={contractTypeOptions}
                                    />
                                    <ValidatedInput
                                        label="Contract Value"
                                        name="contract_value"
                                        value={item.contract_value}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        placeholder="5000000"
                                        helpText="In dollars"
                                    />
                                    <ValidatedInput
                                        label="Start Date"
                                        name="start_date"
                                        value={item.start_date}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        type="date"
                                    />
                                    <ValidatedInput
                                        label="End Date"
                                        name="end_date"
                                        value={item.end_date}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        type="date"
                                    />
                                    <SelectInput
                                        label="CPARS Rating"
                                        name="cpars_rating"
                                        value={item.cpars_rating}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        options={cparsOptions}
                                    />
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', margin: '16px 0 12px' }}>
                                            Point of Contact
                                        </h5>
                                    </div>
                                    <ValidatedInput
                                        label="POC Name"
                                        name="poc_name"
                                        value={item.poc_name}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        required
                                    />
                                    <ValidatedInput
                                        label="POC Title"
                                        name="poc_title"
                                        value={item.poc_title}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                    />
                                    <ValidatedInput
                                        label="POC Phone"
                                        name="poc_phone"
                                        value={item.poc_phone}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        required
                                        pattern={VALIDATION_PATTERNS.PHONE}
                                        patternMessage="Format: XXX-XXX-XXXX"
                                        placeholder="123-456-7890"
                                    />
                                    <ValidatedInput
                                        label="POC Email"
                                        name="poc_email"
                                        value={item.poc_email}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        required
                                        type="email"
                                    />
                                    <ValidatedInput
                                        label="POC Last Verified"
                                        name="poc_verified_date"
                                        value={item.poc_verified_date}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        type="date"
                                        helpText="Must be within 6 months"
                                    />
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <ValidatedInput
                                            label="Scope Description"
                                            name="scope"
                                            value={item.scope}
                                            onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                            type="textarea"
                                            maxLength={500}
                                            required
                                        />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <CheckboxGroup
                                            label="Relevance Tags"
                                            name="relevance_tags"
                                            value={item.relevance_tags}
                                            onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                            options={relevanceTagOptions}
                                            columns={5}
                                        />
                                    </div>
                                    <ValidatedInput
                                        label="Outcome 1 Metric"
                                        name="outcome_1_metric"
                                        value={item.outcome_1_metric}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        placeholder="e.g., Uptime percentage"
                                        required
                                    />
                                    <ValidatedInput
                                        label="Outcome 1 Value"
                                        name="outcome_1_value"
                                        value={item.outcome_1_value}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        placeholder="e.g., 99.95%"
                                        required
                                    />
                                    <ValidatedInput
                                        label="Outcome 2 Metric"
                                        name="outcome_2_metric"
                                        value={item.outcome_2_metric}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        placeholder="e.g., Budget performance"
                                        required
                                    />
                                    <ValidatedInput
                                        label="Outcome 2 Value"
                                        name="outcome_2_value"
                                        value={item.outcome_2_value}
                                        onChange={(name, value) => handlePastPerformanceChange(index, name, value)}
                                        placeholder="e.g., 5% under budget"
                                        required
                                    />
                                </div>
                            )}
                        />
                    </FormSection>

                    {/* Section 4: Key Personnel */}
                    <FormSection
                        title="Key Personnel"
                        description="Minimum 4 personnel required"
                        sectionNumber={4}
                        isComplete={isSection4Complete}
                        isExpanded={currentSection === 'section-4'}
                        onToggle={() => setCurrentSection('section-4')}
                    >
                        <RepeatableSection
                            title="Personnel"
                            items={formData.personnel}
                            onAdd={() => setFormData(prev => ({
                                ...prev,
                                personnel: [...prev.personnel, { ...emptyPersonnel }]
                            }))}
                            onRemove={(index) => setFormData(prev => ({
                                ...prev,
                                personnel: prev.personnel.filter((_, i) => i !== index)
                            }))}
                            minItems={4}
                            maxItems={10}
                            addButtonText="Add Personnel"
                            emptyMessage="Add at least 4 key personnel"
                            renderItem={(item, index) => (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                    <ValidatedInput
                                        label="Full Name"
                                        name="full_name"
                                        value={item.full_name}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        required
                                    />
                                    <SelectInput
                                        label="Proposed Role"
                                        name="role"
                                        value={item.role}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        options={roleOptions}
                                        required
                                    />
                                    <ValidatedInput
                                        label="Years of Experience"
                                        name="years_experience"
                                        value={item.years_experience}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        type="number"
                                        required
                                    />
                                    <SelectInput
                                        label="Availability"
                                        name="availability"
                                        value={item.availability}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        options={availabilityOptions}
                                    />
                                    <SelectInput
                                        label="Clearance Level"
                                        name="clearance_level"
                                        value={item.clearance_level}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        options={clearanceLevelOptions}
                                    />
                                    <SelectInput
                                        label="Clearance Status"
                                        name="clearance_status"
                                        value={item.clearance_status}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        options={clearanceStatusOptions}
                                    />
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <h5 style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', margin: '16px 0 12px' }}>
                                            Certifications
                                        </h5>
                                    </div>
                                    <ValidatedInput
                                        label="Certification 1 Name"
                                        name="cert_1_name"
                                        value={item.cert_1_name}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        placeholder="e.g., PMP"
                                    />
                                    <ValidatedInput
                                        label="Certification 1 Expiration"
                                        name="cert_1_expiration"
                                        value={item.cert_1_expiration}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        type="date"
                                    />
                                    <ValidatedInput
                                        label="Certification 2 Name"
                                        name="cert_2_name"
                                        value={item.cert_2_name}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        placeholder="e.g., CISSP"
                                    />
                                    <ValidatedInput
                                        label="Certification 2 Expiration"
                                        name="cert_2_expiration"
                                        value={item.cert_2_expiration}
                                        onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                        type="date"
                                    />
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <FileUpload
                                            label="Resume"
                                            name="resume_file"
                                            value={item.resume_file}
                                            onChange={(name, value) => handlePersonnelChange(index, name, value)}
                                            accept=".pdf,.doc,.docx"
                                            maxSize={2}
                                            required
                                        />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={item.commitment_letter}
                                                onChange={(e) => handlePersonnelChange(index, 'commitment_letter', e.target.checked)}
                                            />
                                            <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                                                Willing to work on this contract if awarded
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        />
                    </FormSection>

                    {/* Section 5: Technical Capabilities */}
                    <FormSection
                        title="Technical Capabilities"
                        description="Cloud platforms, tools, and methodologies"
                        sectionNumber={5}
                        isComplete={isSection5Complete}
                        isExpanded={currentSection === 'section-5'}
                        onToggle={() => setCurrentSection('section-5')}
                    >
                        <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: '16px' }}>
                                Cloud Platforms
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ padding: '16px', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #262626' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.cloud_aws}
                                            onChange={(e) => handleFieldChange('cloud_aws', e.target.checked)}
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#e5e5e5' }}>AWS</span>
                                    </label>
                                    {formData.cloud_aws && (
                                        <SelectInput
                                            label="Certification Level"
                                            name="cloud_aws_level"
                                            value={formData.cloud_aws_level}
                                            onChange={handleFieldChange}
                                            options={cloudCertOptions}
                                        />
                                    )}
                                </div>
                                <div style={{ padding: '16px', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #262626' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.cloud_azure}
                                            onChange={(e) => handleFieldChange('cloud_azure', e.target.checked)}
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#e5e5e5' }}>Azure</span>
                                    </label>
                                    {formData.cloud_azure && (
                                        <SelectInput
                                            label="Certification Level"
                                            name="cloud_azure_level"
                                            value={formData.cloud_azure_level}
                                            onChange={handleFieldChange}
                                            options={cloudCertOptions}
                                        />
                                    )}
                                </div>
                                <div style={{ padding: '16px', backgroundColor: '#141414', borderRadius: '8px', border: '1px solid #262626' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.cloud_gcp}
                                            onChange={(e) => handleFieldChange('cloud_gcp', e.target.checked)}
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: '#e5e5e5' }}>Google Cloud</span>
                                    </label>
                                    {formData.cloud_gcp && (
                                        <SelectInput
                                            label="Certification Level"
                                            name="cloud_gcp_level"
                                            value={formData.cloud_gcp_level}
                                            onChange={handleFieldChange}
                                            options={cloudCertOptions}
                                        />
                                    )}
                                </div>
                            </div>

                            <CheckboxGroup
                                label="Infrastructure as Code"
                                name="iac_tools"
                                value={formData.iac_tools}
                                onChange={handleFieldChange}
                                options={iacToolOptions}
                                columns={4}
                            />

                            <CheckboxGroup
                                label="Container / Orchestration"
                                name="container_tools"
                                value={formData.container_tools}
                                onChange={handleFieldChange}
                                options={containerToolOptions}
                                columns={4}
                            />

                            <CheckboxGroup
                                label="CI/CD Tools"
                                name="cicd_tools"
                                value={formData.cicd_tools}
                                onChange={handleFieldChange}
                                options={cicdToolOptions}
                                columns={5}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                <ValidatedInput
                                    label="SIEM Tools"
                                    name="siem_tools"
                                    value={formData.siem_tools}
                                    onChange={handleFieldChange}
                                    placeholder="e.g., Splunk, QRadar, Sentinel"
                                />
                                <ValidatedInput
                                    label="Vulnerability Scanners"
                                    name="vulnerability_scanners"
                                    value={formData.vulnerability_scanners}
                                    onChange={handleFieldChange}
                                    placeholder="e.g., Nessus, Qualys, Rapid7"
                                />
                            </div>

                            <CheckboxGroup
                                label="Methodologies"
                                name="methodologies"
                                value={formData.methodologies}
                                onChange={handleFieldChange}
                                options={methodologyOptions}
                                columns={4}
                                required
                            />
                        </div>
                    </FormSection>

                    {/* Section 6: Labor Rates & Pricing */}
                    <FormSection
                        title="Labor Rates & Pricing"
                        description="Rates, overhead, and cost assumptions"
                        sectionNumber={6}
                        isComplete={isSection6Complete}
                        isExpanded={currentSection === 'section-6'}
                        onToggle={() => setCurrentSection('section-6')}
                    >
                        <RepeatableSection
                            title="Labor Categories"
                            items={formData.labor_rates}
                            onAdd={() => setFormData(prev => ({
                                ...prev,
                                labor_rates: [...prev.labor_rates, { ...emptyLaborRate }]
                            }))}
                            onRemove={(index) => setFormData(prev => ({
                                ...prev,
                                labor_rates: prev.labor_rates.filter((_, i) => i !== index)
                            }))}
                            minItems={1}
                            maxItems={20}
                            addButtonText="Add Labor Category"
                            emptyMessage="Add at least one labor category"
                            renderItem={(item, index) => (
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                                    <ValidatedInput
                                        label="Category Name"
                                        name="category"
                                        value={item.category}
                                        onChange={(name, value) => handleLaborRateChange(index, name, value)}
                                        required
                                        placeholder="e.g., Program Manager"
                                    />
                                    <ValidatedInput
                                        label="Year 1 Rate ($/hr)"
                                        name="year_1_rate"
                                        value={item.year_1_rate}
                                        onChange={(name, value) => handleLaborRateChange(index, name, value)}
                                        required
                                        placeholder="175"
                                    />
                                    <ValidatedInput
                                        label="Escalation %"
                                        name="escalation_rate"
                                        value={item.escalation_rate}
                                        onChange={(name, value) => handleLaborRateChange(index, name, value)}
                                        placeholder="3"
                                    />
                                </div>
                            )}
                        />

                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1a1a1a' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: '16px' }}>
                                Pricing Assumptions
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px' }}>
                                <ValidatedInput
                                    label="Overhead Rate (%)"
                                    name="overhead_rate"
                                    value={formData.overhead_rate}
                                    onChange={handleFieldChange}
                                    required
                                    placeholder="45"
                                />
                                <ValidatedInput
                                    label="G&A Rate (%)"
                                    name="ga_rate"
                                    value={formData.ga_rate}
                                    onChange={handleFieldChange}
                                    required
                                    placeholder="12"
                                />
                                <ValidatedInput
                                    label="Fee/Profit Margin (%)"
                                    name="fee_margin"
                                    value={formData.fee_margin}
                                    onChange={handleFieldChange}
                                    placeholder="10"
                                />
                                <ValidatedInput
                                    label="Fringe Benefits Rate (%)"
                                    name="fringe_rate"
                                    value={formData.fringe_rate}
                                    onChange={handleFieldChange}
                                    placeholder="35"
                                />
                                <SelectInput
                                    label="Rate Source"
                                    name="rate_source"
                                    value={formData.rate_source}
                                    onChange={handleFieldChange}
                                    options={rateSourceOptions}
                                />
                                <ValidatedInput
                                    label="GSA Schedule Number"
                                    name="gsa_schedule_number"
                                    value={formData.gsa_schedule_number}
                                    onChange={handleFieldChange}
                                    placeholder="If applicable"
                                />
                            </div>
                            <ValidatedInput
                                label="Rate Justification"
                                name="rate_justification"
                                value={formData.rate_justification}
                                onChange={handleFieldChange}
                                type="textarea"
                                maxLength={500}
                                helpText="Explain how rates were determined"
                            />
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1a1a1a' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: '16px' }}>
                                ODC Estimates
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px' }}>
                                <ValidatedInput
                                    label="Travel Budget ($)"
                                    name="travel_budget"
                                    value={formData.travel_budget}
                                    onChange={handleFieldChange}
                                    placeholder="50000"
                                />
                                <ValidatedInput
                                    label="License Costs ($)"
                                    name="license_costs"
                                    value={formData.license_costs}
                                    onChange={handleFieldChange}
                                    placeholder="25000"
                                />
                                <ValidatedInput
                                    label="Cloud Costs ($)"
                                    name="cloud_costs"
                                    value={formData.cloud_costs}
                                    onChange={handleFieldChange}
                                    placeholder="100000"
                                />
                            </div>
                        </div>
                    </FormSection>

                    {/* Section 7: Facilities & Subcontractors */}
                    <FormSection
                        title="Facilities & Subcontractors"
                        description="Office locations and teaming arrangements"
                        sectionNumber={7}
                        isComplete={isSection7Complete}
                        isExpanded={currentSection === 'section-7'}
                        onToggle={() => setCurrentSection('section-7')}
                    >
                        <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', marginBottom: '16px' }}>
                                Primary Office Location
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <ValidatedInput
                                        label="Street Address"
                                        name="primary_office_street"
                                        value={formData.primary_office_street}
                                        onChange={handleFieldChange}
                                        required
                                    />
                                </div>
                                <ValidatedInput
                                    label="City"
                                    name="primary_office_city"
                                    value={formData.primary_office_city}
                                    onChange={handleFieldChange}
                                    required
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <ValidatedInput
                                        label="State"
                                        name="primary_office_state"
                                        value={formData.primary_office_state}
                                        onChange={handleFieldChange}
                                        required
                                        placeholder="VA"
                                    />
                                    <ValidatedInput
                                        label="ZIP"
                                        name="primary_office_zip"
                                        value={formData.primary_office_zip}
                                        onChange={handleFieldChange}
                                        placeholder="22102"
                                    />
                                </div>
                                <SelectInput
                                    label="Facility Clearance"
                                    name="facility_clearance"
                                    value={formData.facility_clearance}
                                    onChange={handleFieldChange}
                                    options={facilityClearanceOptions}
                                />
                            </div>
                            <ValidatedInput
                                label="Existing Infrastructure"
                                name="existing_infrastructure"
                                value={formData.existing_infrastructure}
                                onChange={handleFieldChange}
                                type="textarea"
                                placeholder="Describe existing cloud accounts, tools, licenses..."
                                maxLength={500}
                            />
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1a1a1a' }}>
                            <RepeatableSection
                                title="Subcontractors"
                                items={formData.subcontractors}
                                onAdd={() => setFormData(prev => ({
                                    ...prev,
                                    subcontractors: [...prev.subcontractors, { ...emptySubcontractor }]
                                }))}
                                onRemove={(index) => setFormData(prev => ({
                                    ...prev,
                                    subcontractors: prev.subcontractors.filter((_, i) => i !== index)
                                }))}
                                minItems={0}
                                maxItems={5}
                                addButtonText="Add Subcontractor"
                                emptyMessage="No subcontractors (optional)"
                                renderItem={(item, index) => (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                        <ValidatedInput
                                            label="Subcontractor Name"
                                            name="name"
                                            value={item.name}
                                            onChange={(name, value) => handleSubcontractorChange(index, name, value)}
                                            required
                                        />
                                        <SelectInput
                                            label="Small Business Status"
                                            name="small_business_status"
                                            value={item.small_business_status}
                                            onChange={(name, value) => handleSubcontractorChange(index, name, value)}
                                            options={smallBusinessOptions}
                                        />
                                        <ValidatedInput
                                            label="CAGE Code"
                                            name="cage_code"
                                            value={item.cage_code}
                                            onChange={(name, value) => handleSubcontractorChange(index, name, value)}
                                            pattern={VALIDATION_PATTERNS.CAGE}
                                            patternMessage="CAGE must be 5 characters"
                                        />
                                        <ValidatedInput
                                            label="UEI"
                                            name="uei"
                                            value={item.uei}
                                            onChange={(name, value) => handleSubcontractorChange(index, name, value)}
                                            pattern={VALIDATION_PATTERNS.UEI}
                                            patternMessage="UEI must be 12 characters"
                                        />
                                        <ValidatedInput
                                            label="% of Contract Value"
                                            name="percentage_of_value"
                                            value={item.percentage_of_value}
                                            onChange={(name, value) => handleSubcontractorChange(index, name, value)}
                                            placeholder="15"
                                        />
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <ValidatedInput
                                                label="Scope of Work"
                                                name="scope_of_work"
                                                value={item.scope_of_work}
                                                onChange={(name, value) => handleSubcontractorChange(index, name, value)}
                                                type="textarea"
                                                maxLength={500}
                                            />
                                        </div>
                                    </div>
                                )}
                            />
                        </div>
                    </FormSection>
                </div>

                {/* Sidebar */}
                <div style={{ width: '280px', flexShrink: 0 }}>
                    <IntakeProgress
                        sections={sections}
                        currentSection={currentSection}
                        onSectionClick={setCurrentSection}
                        onSave={handleSave}
                        isSaving={isSaving}
                        lastSaved={lastSaved}
                    />
                </div>
            </div>
        </div>
    )
}













