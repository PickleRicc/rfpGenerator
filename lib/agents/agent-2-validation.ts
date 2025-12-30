/**
 * Agent 2: Data Retrieval & Validation Agent
 * 
 * PRIMARY MISSION: Retrieve client data from Supabase and validate completeness/accuracy
 * to prevent placeholder data and unsubstantiated claims.
 * 
 * RESPONSIBILITIES:
 * 1. Query Supabase for all required client data
 * 2. Validate data completeness against RFP requirements
 * 3. Flag placeholders, expired certs, unverifiable claims
 * 4. Generate validation report with BLOCKERS and WARNINGS
 */

import { supabase } from '../supabase'
import { logger } from '../logger'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent2Output,
    NormalizedCompanyData,
} from './types'
import {
    ValidationReport,
    ValidationReportItem,
    ValidationStatus,
    RfpParsedData,
} from '../database.types'

// Placeholder patterns to detect
const PLACEHOLDER_PATTERNS = [
    /^ABC123/i,
    /^123456789$/,
    /^1A2B3$/,
    /^XXXXX/i,
    /^TBD$/i,
    /^N\/A$/i,
    /^test/i,
    /^sample/i,
    /^example/i,
]

export class Agent2Validation implements Agent<AgentContext, Agent2Output> {
    name = 'agent_2' as const
    description = 'Validates client data completeness and accuracy'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []

        if (!context.jobId) {
            errors.push('Job ID is required')
        }

        if (!context.companyId) {
            errors.push('Company ID is required')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    }

    async execute(context: AgentContext): Promise<AgentResult<Agent2Output>> {
        logger.agentStep('agent_2', context.jobId, 'Starting data validation')

        try {
            // Validate prerequisites
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                logger.error('Prerequisite validation failed', {
                    jobId: context.jobId,
                    agent: 'agent_2',
                    data: { errors: validation.errors }
                })
                return {
                    status: 'error',
                    data: null as unknown as Agent2Output,
                    errors: validation.errors,
                }
            }

            // Update status
            await this.updateAgentStatus(context.jobId, 'running')

            // Fetch company data
            logger.agentStep('agent_2', context.jobId, 'Fetching company data')
            const companyData = await this.fetchCompanyData(context.companyId)
            logger.agentStep('agent_2', context.jobId, 'Company data loaded', {
                company: companyData.company.name,
                pastPerformance: companyData.pastPerformance.length,
                personnel: companyData.personnel.length,
                laborRates: companyData.laborRates.length,
            })

            // Run validation checks
            const blockers: ValidationReportItem[] = []
            const warnings: ValidationReportItem[] = []
            const recommendations: ValidationReportItem[] = []

            // Validate company info
            this.validateCompanyInfo(companyData, blockers, warnings)

            // Validate past performance
            this.validatePastPerformance(companyData, context.rfpParsedData, blockers, warnings, recommendations)

            // Validate personnel
            this.validatePersonnel(companyData, context.rfpParsedData, blockers, warnings, recommendations)

            // Validate labor rates
            this.validateLaborRates(companyData, blockers, warnings)

            // Determine overall status
            let status: ValidationStatus = 'approved'
            if (blockers.length > 0) {
                status = 'blocked'
            } else if (warnings.length > 0) {
                status = 'warnings'
            }

            const validationReport: ValidationReport = {
                status,
                blockers,
                warnings,
                recommendations,
                generated_at: new Date().toISOString(),
            }

            // Calculate data quality score (0-100)
            const dataQualityScore = this.calculateDataQualityScore(companyData, blockers, warnings)

            // Save to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase.from('proposal_jobs') as any)
                .update({
                    validation_status: status,
                    validation_report: validationReport,
                    current_agent: 'agent_2',
                    agent_progress: {
                        agent_0: { status: 'complete' },
                        agent_1: { status: 'complete' },
                        agent_2: {
                            status: status === 'blocked' ? 'blocked' : 'complete',
                            started_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                        },
                    },
                })
                .eq('job_id', context.jobId)

            if (error) {
                throw new Error(`Failed to save validation report: ${error.message}`)
            }

            logger.agentStep('agent_2', context.jobId, 'Validation complete', {
                status,
                blockers: blockers.length,
                warnings: warnings.length,
                dataQualityScore: `${dataQualityScore}%`,
            })

            // Return blocked status if there are blockers
            if (status === 'blocked') {
                return {
                    status: 'blocked',
                    data: {
                        validationReport,
                        dataQualityScore,
                    },
                    blockers: blockers.map(b => b.message),
                    warnings: warnings.map(w => w.message),
                }
            }

            return {
                status: warnings.length > 0 ? 'warning' : 'success',
                data: {
                    validationReport,
                    dataQualityScore,
                },
                warnings: warnings.map(w => w.message),
                nextAgent: 'agent_3',
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error(errorMessage, {
                jobId: context.jobId,
                agent: 'agent_2',
            })
            await this.updateAgentStatus(context.jobId, 'failed', errorMessage)
            
            return {
                status: 'error',
                data: null as unknown as Agent2Output,
                errors: [errorMessage],
            }
        }
    }

    private async fetchCompanyData(companyId: string): Promise<NormalizedCompanyData> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [companyResult, ppResult, personnelResult, ratesResult] = await Promise.all([
            (supabase.from('companies') as any).select('*').eq('id', companyId).single(),
            (supabase.from('past_performance') as any).select('*').eq('company_id', companyId),
            (supabase.from('personnel') as any).select('*').eq('company_id', companyId),
            (supabase.from('labor_rates') as any).select('*').eq('company_id', companyId),
        ])

        if (companyResult.error || !companyResult.data) {
            throw new Error(`Company not found: ${companyResult.error?.message}`)
        }

        return {
            company: companyResult.data,
            pastPerformance: ppResult.data || [],
            personnel: personnelResult.data || [],
            laborRates: ratesResult.data || [],
        }
    }

    private validateCompanyInfo(
        data: NormalizedCompanyData,
        blockers: ValidationReportItem[],
        warnings: ValidationReportItem[]
    ): void {
        const { company } = data

        // Check for placeholder UEI
        if (this.isPlaceholder(company.uei)) {
            blockers.push({
                type: 'blocker',
                field: 'company.uei',
                message: 'UEI appears to be placeholder data',
                fix_path: `/intake/${company.id}#section-1`,
            })
        }

        // Check for placeholder CAGE
        if (this.isPlaceholder(company.cage_code)) {
            blockers.push({
                type: 'blocker',
                field: 'company.cage_code',
                message: 'CAGE code appears to be placeholder data',
                fix_path: `/intake/${company.id}#section-1`,
            })
        }

        // Check company size vs claimed capabilities
        if (company.employee_count < 10 && data.pastPerformance.some(p => p.contract_value > 50000000)) {
            warnings.push({
                type: 'warning',
                field: 'company.employee_count',
                message: 'Company size seems inconsistent with contract values claimed',
            })
        }
    }

    private validatePastPerformance(
        data: NormalizedCompanyData,
        rfpData: RfpParsedData | undefined,
        blockers: ValidationReportItem[],
        warnings: ValidationReportItem[],
        recommendations: ValidationReportItem[]
    ): void {
        const { pastPerformance, company } = data

        // Check minimum past performance
        if (pastPerformance.length < 3) {
            blockers.push({
                type: 'blocker',
                field: 'past_performance',
                message: `Only ${pastPerformance.length} past performance contracts (need minimum 3)`,
                fix_path: `/intake/${company.id}#section-3`,
            })
        }

        // Validate each contract
        pastPerformance.forEach((pp, index) => {
            // Check POC freshness
            if (pp.poc_verified_date) {
                const verifiedDate = new Date(pp.poc_verified_date)
                const sixMonthsAgo = new Date()
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

                if (verifiedDate < sixMonthsAgo) {
                    warnings.push({
                        type: 'warning',
                        field: `past_performance[${index}].poc_verified_date`,
                        message: `POC for "${pp.project_name}" was verified over 6 months ago`,
                        fix_path: `/intake/${company.id}#section-3`,
                    })
                }
            } else {
                warnings.push({
                    type: 'warning',
                    field: `past_performance[${index}].poc_verified_date`,
                    message: `POC for "${pp.project_name}" has never been verified`,
                    fix_path: `/intake/${company.id}#section-3`,
                })
            }

            // Check for placeholder contract numbers
            if (this.isPlaceholder(pp.contract_number)) {
                blockers.push({
                    type: 'blocker',
                    field: `past_performance[${index}].contract_number`,
                    message: `Contract number for "${pp.project_name}" appears to be placeholder`,
                    fix_path: `/intake/${company.id}#section-3`,
                })
            }

            // Check quantified outcomes
            const outcomes = pp.quantified_outcomes || []
            if (outcomes.length < 2) {
                recommendations.push({
                    type: 'recommendation',
                    field: `past_performance[${index}].quantified_outcomes`,
                    message: `Add more quantified outcomes for "${pp.project_name}" (${outcomes.length}/2 minimum)`,
                })
            }
        })

        // Check DoD relevance if RFP is DoD-related
        if (rfpData?.metadata.agency?.toLowerCase().includes('defense') ||
            rfpData?.metadata.agency?.toLowerCase().includes('dod')) {
            const dodContracts = pastPerformance.filter(pp =>
                pp.agency?.toLowerCase().includes('defense') ||
                pp.agency?.toLowerCase().includes('dod') ||
                pp.relevance_tags?.includes('DoD')
            )
            if (dodContracts.length < 2) {
                warnings.push({
                    type: 'warning',
                    field: 'past_performance',
                    message: `Only ${dodContracts.length} DoD contracts (recommend 2+ for DoD RFP)`,
                })
            }
        }
    }

    private validatePersonnel(
        data: NormalizedCompanyData,
        rfpData: RfpParsedData | undefined,
        blockers: ValidationReportItem[],
        warnings: ValidationReportItem[],
        recommendations: ValidationReportItem[]
    ): void {
        const { personnel, company } = data

        // Check minimum personnel
        if (personnel.length < 4) {
            blockers.push({
                type: 'blocker',
                field: 'personnel',
                message: `Only ${personnel.length} key personnel (need minimum 4)`,
                fix_path: `/intake/${company.id}#section-4`,
            })
        }

        // Check for Program Manager
        const pm = personnel.find(p => p.role === 'Program Manager')
        if (!pm) {
            blockers.push({
                type: 'blocker',
                field: 'personnel',
                message: 'No Program Manager identified',
                fix_path: `/intake/${company.id}#section-4`,
            })
        } else {
            // Check PM years of experience (often requires 10+)
            if (pm.years_experience < 10) {
                const requiresPM10 = rfpData?.section_c.requirements.some(r =>
                    r.text.toLowerCase().includes('program manager') &&
                    (r.text.includes('10') || r.text.includes('ten'))
                )
                if (requiresPM10) {
                    blockers.push({
                        type: 'blocker',
                        field: 'personnel.pm.years_experience',
                        message: `PM has ${pm.years_experience} years experience (RFP requires 10+)`,
                        fix_path: `/intake/${company.id}#section-4`,
                    })
                }
            }
        }

        // Validate each person
        personnel.forEach((person, index) => {
            // Check for resume
            if (!person.resume_url && !person.resume_summary) {
                blockers.push({
                    type: 'blocker',
                    field: `personnel[${index}].resume`,
                    message: `Missing resume for ${person.name}`,
                    fix_path: `/intake/${company.id}#section-4`,
                })
            }

            // Note: Personnel certifications are stored as string[] without expiration dates
            // Company-level certifications (set_aside_certifications, security_certifications) 
            // have expiration dates and are validated separately

            // Check clearance status for roles requiring it
            if (person.clearance_status === 'Expired') {
                warnings.push({
                    type: 'warning',
                    field: `personnel[${index}].clearance_status`,
                    message: `${person.name}'s security clearance has expired`,
                })
            }
        })
    }

    private validateLaborRates(
        data: NormalizedCompanyData,
        blockers: ValidationReportItem[],
        warnings: ValidationReportItem[]
    ): void {
        const { laborRates, company } = data

        if (laborRates.length === 0) {
            blockers.push({
                type: 'blocker',
                field: 'labor_rates',
                message: 'No labor rates defined',
                fix_path: `/intake/${company.id}#section-6`,
            })
            return
        }

        // Check for unrealistic rates
        laborRates.forEach((rate, index) => {
            if (rate.hourly_rate < 50) {
                warnings.push({
                    type: 'warning',
                    field: `labor_rates[${index}].hourly_rate`,
                    message: `Rate for ${rate.category} ($${rate.hourly_rate}/hr) seems unusually low`,
                })
            }
            if (rate.hourly_rate > 500) {
                warnings.push({
                    type: 'warning',
                    field: `labor_rates[${index}].hourly_rate`,
                    message: `Rate for ${rate.category} ($${rate.hourly_rate}/hr) seems unusually high`,
                })
            }
        })
    }

    private isPlaceholder(value: string | null | undefined): boolean {
        if (!value) return false
        return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value))
    }

    private calculateDataQualityScore(
        data: NormalizedCompanyData,
        blockers: ValidationReportItem[],
        warnings: ValidationReportItem[]
    ): number {
        let score = 100

        // Deduct for blockers (major issues)
        score -= blockers.length * 15

        // Deduct for warnings (minor issues)
        score -= warnings.length * 5

        // Bonus for completeness
        if (data.pastPerformance.length >= 5) score += 5
        if (data.personnel.length >= 6) score += 5

        return Math.max(0, Math.min(100, score))
    }

    private async updateAgentStatus(
        jobId: string,
        status: 'running' | 'complete' | 'blocked' | 'failed',
        error?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                current_agent: 'agent_2',
                agent_progress: {
                    agent_2: {
                        status,
                        ...(status === 'running' && { started_at: new Date().toISOString() }),
                        ...((status === 'complete' || status === 'blocked' || status === 'failed') && { completed_at: new Date().toISOString() }),
                        ...(error && { error }),
                    },
                },
            })
            .eq('job_id', jobId)
    }
}

// Export singleton instance
export const agent2 = new Agent2Validation()


