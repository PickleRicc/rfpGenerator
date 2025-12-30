/**
 * Preparation Phase Function - Modular Inngest Function
 * 
 * Executes Agents 0-3 to prepare the proposal context:
 * - Agent 0: Volume Structure
 * - Agent 1: RFP Parser
 * - Agent 2: Data Validation
 * - Agent 3: Content Mapper
 * 
 * Triggered by: proposal/preparation.start
 * Emits: proposal/preparation.complete
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import {
    agent0,
    agent1,
    agent2,
    agent3,
    AgentContext,
    NormalizedCompanyData,
} from '../../agents'
import { updateJobStatus } from '../db-helpers'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchCompanyData(companyId: string): Promise<NormalizedCompanyData> {
    logger.info('Fetching company data from database', { data: { companyId } })

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

    // Log warnings for missing data (but don't fail - data might be optional)
    if (ppResult.error) {
        logger.warn(`[fetchCompanyData] Failed to fetch past performance: ${ppResult.error.message}`, { data: { companyId } })
    }
    if (personnelResult.error) {
        logger.warn(`[fetchCompanyData] Failed to fetch personnel: ${personnelResult.error.message}`, { data: { companyId } })
    }
    if (ratesResult.error) {
        logger.warn(`[fetchCompanyData] Failed to fetch labor rates: ${ratesResult.error.message}`, { data: { companyId } })
    }

    const data = {
        company: companyResult.data,
        pastPerformance: ppResult.data || [],
        personnel: personnelResult.data || [],
        laborRates: ratesResult.data || [],
    }

    logger.info('Company data fetched successfully', { 
        data: { 
            companyId, 
            pastPerformanceCount: data.pastPerformance.length,
            personnelCount: data.personnel.length,
            laborRatesCount: data.laborRates.length
        } 
    })

    return data
}

interface AgentProgressUpdate {
    status: 'pending' | 'running' | 'complete' | 'failed' | 'blocked'
    started_at?: string
    completed_at?: string
    error?: string
}

async function updateProgress(
    jobId: string,
    progress: number,
    step: string,
    currentAgent?: string,
    agentProgressUpdate?: { agent: string; progress: AgentProgressUpdate }
): Promise<void> {
    try {
        const updateData: {
            progress_percent: number
            current_step: string
            current_agent?: string
            agent_progress?: Record<string, AgentProgressUpdate>
            updated_at: string
        } = {
            progress_percent: Math.round(progress),
            current_step: step,
            updated_at: new Date().toISOString(),
        }

        if (currentAgent) {
            updateData.current_agent = currentAgent
        }

        // Atomic merge with retry logic
        if (agentProgressUpdate) {
            let retries = 3
            let success = false

            while (retries > 0 && !success) {
                try {
                    // Fetch current agent_progress
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
                        .select('agent_progress')
                        .eq('job_id', jobId)
                        .single()

                    const agentProgress = currentJob?.agent_progress || {}
                    
                    // Atomic merge: preserve existing data, only update specified agent
                    agentProgress[agentProgressUpdate.agent] = {
                        ...agentProgress[agentProgressUpdate.agent],
                        ...agentProgressUpdate.progress
                    }

                    updateData.agent_progress = agentProgress
                    success = true
                } catch (fetchError) {
                    retries--
                    if (retries === 0) {
                        logger.warn(`[updateProgress] Failed to fetch agent_progress after retries, continuing without agent update`, { 
                            data: { jobId, error: fetchError instanceof Error ? fetchError.message : String(fetchError) }
                        })
                        delete updateData.agent_progress
                        success = true
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 100))
                    }
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('proposal_jobs') as any)
            .update(updateData)
            .eq('job_id', jobId)

        if (updateError) {
            logger.error(`[updateProgress] Database update failed: ${updateError.message}`, { 
                jobId, 
                data: { progress, step, hasAgentProgress: !!updateData.agent_progress }
            })
        } else {
            logger.info(`[updateProgress] Database update successful`, { 
                data: { jobId, progress, step, hasAgentProgress: !!updateData.agent_progress }
            })
        }
    } catch (error) {
        logger.error(`[updateProgress] Unexpected error: ${error instanceof Error ? error.message : String(error)}`, { jobId })
    }
}

// ============================================================================
// PREPARATION PHASE FUNCTION
// ============================================================================

export const preparationPhaseFunction = inngest.createFunction(
    {
        id: 'preparation-phase',
        name: 'Preparation Phase (Agents 0-3)',
        retries: 2,
    },
    { event: 'proposal/preparation.start' },
    async ({ event, step }) => {
        const { jobId, rfpText, companyId } = event.data

        logger.info('[Prep Phase] Starting preparation phase', { data: { jobId } })

        try {
            // Update job status
            await updateJobStatus(jobId, 'processing', {
                current_step: 'Preparation Phase - Analyzing RFP and Company Data',
                preparation_phase_status: 'running'
            })

            // Initialize context
            const context: AgentContext = {
                jobId,
                companyId,
                rfpText,
            }

            // ================================================================
            // AGENT 0: Volume Structure
            // ================================================================

            const agent0Result = await step.run('agent-0-volume-structure', async () => {
                logger.agentStart('agent_0', jobId, 'Creating 4 volume containers')
                await updateProgress(jobId, 0, 'Starting volume structure creation', 'agent_0', {
                    agent: 'agent_0',
                    progress: { status: 'running', started_at: new Date().toISOString() }
                })

                const result = await agent0.execute(context)

                if (result.status === 'error') {
                    throw new Error(`Agent 0 failed: ${result.errors?.join(', ')}`)
                }

                await updateProgress(jobId, 5, 'Volume structure created', 'agent_0', {
                    agent: 'agent_0',
                    progress: { status: 'complete', completed_at: new Date().toISOString() }
                })

                // Store volume structure in database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        volume_page_limits: result.data.volumePageLimits,
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)

                return result.data
            })

            context.volumePageLimits = agent0Result.volumePageLimits

            // ================================================================
            // Load Company Data
            // ================================================================

            const companyData = await step.run('load-company-data', async () => {
                logger.info('[Prep Phase] Loading company data', { data: { jobId } })
                const data = await fetchCompanyData(companyId)
                
                // Store company data in database for volume generation functions
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        company_data: data,
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)
                
                logger.info('[Prep Phase] Company data stored in database', { 
                    data: { 
                        jobId, 
                        pastPerformanceCount: data.pastPerformance.length,
                        personnelCount: data.personnel.length 
                    } 
                })
                
                return data
            })
            context.companyData = companyData

            // ================================================================
            // AGENT 1: RFP Parser
            // ================================================================

            const agent1Result = await step.run('agent-1-rfp-parser', async () => {
                logger.agentStart('agent_1', jobId, 'Parsing RFP requirements')
                await updateProgress(jobId, 5, 'Starting RFP analysis', 'agent_1', {
                    agent: 'agent_1',
                    progress: { status: 'running', started_at: new Date().toISOString() }
                })

                const result = await agent1.execute(context)

                if (result.status === 'error') {
                    throw new Error(`Agent 1 failed: ${result.errors?.join(', ')}`)
                }

                await updateProgress(jobId, 15, 'RFP parsed', 'agent_1', {
                    agent: 'agent_1',
                    progress: { status: 'complete', completed_at: new Date().toISOString() }
                })

                // Store RFP parsed data in database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        rfp_parsed_data: result.data.rfpParsedData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)

                return result.data
            })

            context.rfpParsedData = agent1Result.rfpParsedData

            // ================================================================
            // AGENT 2: Data Validation
            // ================================================================

            const agent2Result = await step.run('agent-2-validation', async () => {
                logger.agentStart('agent_2', jobId, 'Validating company data')
                await updateProgress(jobId, 15, 'Starting data validation', 'agent_2', {
                    agent: 'agent_2',
                    progress: { status: 'running', started_at: new Date().toISOString() }
                })

                const result = await agent2.execute(context)

                if (result.status === 'blocked') {
                    await updateProgress(jobId, 20, 'Data validation blocked - user action required', 'agent_2', {
                        agent: 'agent_2',
                        progress: { status: 'blocked', completed_at: new Date().toISOString() }
                    })
                    return { status: 'blocked', blockers: result.blockers, data: result.data }
                }

                await updateProgress(jobId, 20, 'Data validation complete', 'agent_2', {
                    agent: 'agent_2',
                    progress: { status: 'complete', completed_at: new Date().toISOString() }
                })

                return result.data
            })

            // WAIT FOR USER if validation blocked
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((agent2Result as any).status === 'blocked') {
                await updateJobStatus(jobId, 'blocked', {
                    current_step: 'Data validation - user action required',
                    preparation_phase_status: 'blocked'
                })

                logger.warn('[Prep Phase] Blocked - waiting for data approval', { data: { jobId } })

                await step.waitForEvent('wait-for-data-approval', {
                    event: 'proposal/volume.approved',
                    timeout: '7d',
                    match: 'data.jobId',
                })

                logger.info('[Prep Phase] Data approved by user', { data: { jobId } })
                await updateJobStatus(jobId, 'processing', {
                    preparation_phase_status: 'running'
                })
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            context.validationReport = (agent2Result as any).validationReport || agent2Result

            // ================================================================
            // AGENT 3: Content Mapper
            // ================================================================

            const agent3Result = await step.run('agent-3-content-mapper', async () => {
                logger.agentStart('agent_3', jobId, 'Creating content outline')
                await updateProgress(jobId, 20, 'Starting content outline creation', 'agent_3', {
                    agent: 'agent_3',
                    progress: { status: 'running', started_at: new Date().toISOString() }
                })

                const result = await agent3.execute(context)

                if (result.status === 'error') {
                    throw new Error(`Agent 3 failed: ${result.errors?.join(', ')}`)
                }

                await updateProgress(jobId, 25, 'Content outline created', 'agent_3', {
                    agent: 'agent_3',
                    progress: { status: 'complete', completed_at: new Date().toISOString() }
                })

                // Store content outlines in database
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('proposal_jobs') as any)
                    .update({
                        content_outlines: result.data.contentOutlines,
                        updated_at: new Date().toISOString()
                    })
                    .eq('job_id', jobId)

                return result.data
            })

            context.contentOutlines = agent3Result.contentOutlines

            // ================================================================
            // Mark preparation phase as complete
            // ================================================================

            await updateJobStatus(jobId, 'processing', {
                current_step: 'Preparation complete - ready for volume generation',
                preparation_phase_status: 'complete'
            })

            logger.info('[Prep Phase] Preparation phase complete', { data: { jobId } })

            // Emit completion event with success flag
            await step.sendEvent('emit-preparation-complete', {
                name: 'proposal/preparation.complete',
                data: {
                    jobId,
                    companyId,
                    rfpText,
                    success: true, // ✅ Explicitly mark as successful
                    volumePageLimits: agent0Result.volumePageLimits,
                    rfpParsedData: agent1Result.rfpParsedData,
                    validationReport: context.validationReport,
                    contentOutlines: agent3Result.contentOutlines,
                }
            })

            return {
                success: true,
                message: 'Preparation phase complete'
            }

        } catch (error) {
            logger.error('[Prep Phase] Preparation phase failed', {
                data: {
                    jobId,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            await updateJobStatus(jobId, 'failed', {
                current_step: 'Preparation phase failed',
                preparation_phase_status: 'failed',
                error_message: error instanceof Error ? error.message : String(error)
            })

            // ✅ CRITICAL: Emit event even on failure so orchestrator knows
            await step.sendEvent('emit-preparation-failed', {
                name: 'proposal/preparation.complete',
                data: {
                    jobId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            })

            throw error
        }
    }
)

