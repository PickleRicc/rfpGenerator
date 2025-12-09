import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        // Check if job exists and is still processing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: fetchError } = await (supabase
            .from('proposal_jobs') as any)
            .select('status')
            .eq('job_id', jobId)
            .single()

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Proposal job not found' },
                { status: 404 }
            )
        }

        if (job.status !== 'processing') {
            return NextResponse.json(
                { error: `Cannot cancel job with status: ${job.status}` },
                { status: 400 }
            )
        }

        // Send Inngest cancellation event
        await inngest.send({
            name: 'proposal/generate.cancelled',
            data: {
                jobId,
                reason: 'Cancelled by user',
            },
        })

        // Update job status to cancelled
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase
            .from('proposal_jobs') as any)
            .update({
                status: 'failed',
                current_step: 'Cancelled by user',
                completed_at: new Date().toISOString(),
            })
            .eq('job_id', jobId)

        if (updateError) {
            console.error('Error cancelling job:', updateError)
            return NextResponse.json(
                { error: 'Failed to cancel job' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, message: 'Job cancelled' })
    } catch (error) {
        console.error('Error in cancel endpoint:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
