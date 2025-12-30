import { NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { supabase } from '@/lib/supabase'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        // Verify job exists and is blocked
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: fetchError } = await (supabase.from('proposal_jobs') as any)
            .select('status, current_agent, company_id, rfp_text')
            .eq('job_id', jobId)
            .single()

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        if (job.status !== 'blocked') {
            return NextResponse.json(
                { error: `Job is not blocked (current status: ${job.status})` },
                { status: 400 }
            )
        }

        // Send resume event to Inngest
        await inngest.send({
            name: 'proposal/resume.requested',
            data: {
                jobId,
                fromAgent: job.current_agent || 'agent_2',
            },
        })

        return NextResponse.json({
            success: true,
            message: 'Job resume initiated',
            jobId,
        })
    } catch (error) {
        console.error('[Resume API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to resume job' },
            { status: 500 }
        )
    }
}












