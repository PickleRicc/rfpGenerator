import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { supabase } from '@/lib/supabase'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json()
        const { ignoredWarnings = [] } = body

        // Verify job exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: fetchError } = await (supabase.from('proposal_jobs') as any)
            .select('status, validation_status, company_id, rfp_text, agent_progress')
            .eq('job_id', jobId)
            .single()

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        // Only allow proceeding if blocked or in validation state
        if (job.status !== 'blocked' && job.validation_status !== 'blocked') {
            return NextResponse.json(
                { error: `Cannot proceed from current status: ${job.status}` },
                { status: 400 }
            )
        }

        // Update validation status to passed and resume pipeline
        const agentProgress = job.agent_progress || {}
        agentProgress['agent_2'] = {
            status: 'complete',
            completed_at: new Date().toISOString(),
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                status: 'processing',
                validation_status: 'passed_with_warnings',
                ignored_warnings: ignoredWarnings,
                agent_progress: agentProgress,
            })
            .eq('job_id', jobId)

        // Send resume event to continue from agent 3
        await inngest.send({
            name: 'proposal/resume.requested',
            data: {
                jobId,
                fromAgent: 'agent_3',
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Pipeline resumed from content mapping',
            jobId,
        })
    } catch (error) {
        console.error('[Proceed API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to proceed with generation' },
            { status: 500 }
        )
    }
}












