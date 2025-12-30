import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * POST /api/proposals/:jobId/retry
 * 
 * Retries a failed job from the last checkpoint.
 * Unlike resume (for blocked jobs), retry is for failed jobs that may have
 * completed some work we can salvage.
 * 
 * Body:
 * - fromAgent?: string - specific agent to resume from (optional, auto-detected if not provided)
 * - restartFresh?: boolean - if true, starts completely over (default: false)
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json().catch(() => ({}))
        const { fromAgent, restartFresh = false } = body

        // Verify job exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: fetchError } = await (supabase.from('proposal_jobs') as any)
            .select('*')
            .eq('job_id', jobId)
            .single()

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        // Allow retry for failed or cancelled jobs
        if (!['failed', 'cancelled'].includes(job.status)) {
            return NextResponse.json(
                { error: `Job is not in a retryable state (current status: ${job.status})` },
                { status: 400 }
            )
        }

        // Analyze what work was completed
        const checkpoint = analyzeCheckpoint(job)
        
        logger.info('Retry requested for job', {
            jobId,
            data: {
                originalStatus: job.status,
                failedAgent: job.current_agent,
                checkpoint,
                restartFresh,
            }
        })

        if (restartFresh) {
            // Reset everything and start over
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    status: 'processing',
                    progress_percent: 0,
                    current_step: 'Initializing...',
                    current_agent: 'agent_0',
                    agent_progress: {},
                    error_message: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('job_id', jobId)

            await inngest.send({
                name: 'proposal/generate.requested',
                data: {
                    jobId,
                    rfpText: job.rfp_text,
                    companyId: job.company_id,
                    rfpSizeBytes: job.rfp_text?.length || 0,
                    estimatedDurationMinutes: 20,
                },
            })

            return NextResponse.json({
                success: true,
                message: 'Job restarted from beginning',
                jobId,
                checkpoint: null,
            })
        }

        // Resume from checkpoint
        const resumeFromAgent = fromAgent || checkpoint.resumeAgent
        
        // Reset status but preserve completed work
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                status: 'processing',
                current_step: `Resuming from ${resumeFromAgent}...`,
                current_agent: resumeFromAgent,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('job_id', jobId)

        // Send resume event
        await inngest.send({
            name: 'proposal/resume.requested',
            data: {
                jobId,
                fromAgent: resumeFromAgent,
                checkpoint: checkpoint,
            },
        })

        return NextResponse.json({
            success: true,
            message: `Job retry initiated from ${resumeFromAgent}`,
            jobId,
            checkpoint,
        })
    } catch (error) {
        console.error('[Retry API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to retry job' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/proposals/:jobId/retry
 * 
 * Returns checkpoint information for a failed job - what work can be salvaged.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: fetchError } = await (supabase.from('proposal_jobs') as any)
            .select('*')
            .eq('job_id', jobId)
            .single()

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        const checkpoint = analyzeCheckpoint(job)

        return NextResponse.json({
            jobId,
            status: job.status,
            checkpoint,
        })
    } catch (error) {
        console.error('[Retry API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to analyze checkpoint' },
            { status: 500 }
        )
    }
}

interface CheckpointAnalysis {
    hasVolumes: boolean
    volumesComplete: {
        technical: boolean
        management: boolean
        pastPerformance: boolean
        pricing: boolean
    }
    totalPagesGenerated: number
    completedAgents: string[]
    failedAgent: string | null
    resumeAgent: string
    canResume: boolean
    salvageableWork: string[]
}

function analyzeCheckpoint(job: Record<string, unknown>): CheckpointAnalysis {
    const agentProgress = (job.agent_progress || {}) as Record<string, { status?: string }>
    const volumeProgress = (job.volume_progress || {}) as Record<string, { status?: string; page_count?: number }>

    // Check which agents completed
    const completedAgents: string[] = []
    for (const [agent, progress] of Object.entries(agentProgress)) {
        if (progress?.status === 'complete') {
            completedAgents.push(agent)
        }
    }

    // Check which volumes are complete
    const volumesComplete = {
        technical: volumeProgress.volume_1?.status === 'complete',
        management: volumeProgress.volume_2?.status === 'complete',
        pastPerformance: volumeProgress.volume_3?.status === 'complete',
        pricing: volumeProgress.volume_4?.status === 'complete',
    }

    const hasVolumes = Object.values(volumesComplete).some(v => v)

    // Count pages generated
    let totalPagesGenerated = 0
    for (const vol of Object.values(volumeProgress)) {
        if (vol?.page_count) {
            totalPagesGenerated += vol.page_count
        }
    }

    // Also check if content exists in the job
    const hasContent = !!(job.technical_approach || job.management_approach || 
                         job.past_performance_volume || job.pricing)
    
    // Determine what can be salvaged
    const salvageableWork: string[] = []
    if (volumesComplete.technical) salvageableWork.push('Volume 1: Technical Approach')
    if (volumesComplete.management) salvageableWork.push('Volume 2: Management Approach')
    if (volumesComplete.pastPerformance) salvageableWork.push('Volume 3: Past Performance')
    if (volumesComplete.pricing) salvageableWork.push('Volume 4: Pricing')
    if (hasContent && !hasVolumes) salvageableWork.push('Partial content generated')

    // Determine which agent to resume from
    const failedAgent = job.current_agent as string | null
    let resumeAgent = 'agent_0'
    
    if (completedAgents.includes('agent_4')) {
        // Volumes complete, resume from compliance
        resumeAgent = 'agent_5'
    } else if (completedAgents.includes('agent_3')) {
        // Content mapping done, resume from writing
        resumeAgent = 'agent_4'
    } else if (completedAgents.includes('agent_2')) {
        resumeAgent = 'agent_3'
    } else if (completedAgents.includes('agent_1')) {
        resumeAgent = 'agent_2'
    } else if (completedAgents.includes('agent_0')) {
        resumeAgent = 'agent_1'
    }

    return {
        hasVolumes,
        volumesComplete,
        totalPagesGenerated,
        completedAgents,
        failedAgent,
        resumeAgent,
        canResume: completedAgents.length > 0,
        salvageableWork,
    }
}












