import { supabase } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// Statuses that can be cancelled
const CANCELLABLE_STATUSES = ['draft', 'intake', 'validating', 'blocked', 'processing', 'review']

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        logger.info(`Cancel request received`, { jobId })

        // Check if job exists and can be cancelled
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error: fetchError } = await (supabase
            .from('proposal_jobs') as any)
            .select('status, current_agent')
            .eq('job_id', jobId)
            .single()

        if (fetchError || !job) {
            logger.warn(`Job not found for cancellation`, { jobId })
            return NextResponse.json(
                { error: 'Proposal job not found' },
                { status: 404 }
            )
        }

        // Check if job can be cancelled
        if (!CANCELLABLE_STATUSES.includes(job.status)) {
            logger.warn(`Cannot cancel job - already ${job.status}`, { jobId })
            return NextResponse.json(
                { error: `Cannot cancel job with status: ${job.status}` },
                { status: 400 }
            )
        }

        // Send Inngest cancellation event
        try {
            await inngest.send({
                name: 'proposal/generate.cancelled',
                data: {
                    jobId,
                    reason: 'Cancelled by user',
                },
            })
        } catch (inngestError) {
            // Log but don't fail - the job might not have an active Inngest run
            logger.warn(`Inngest cancellation event failed (may be expected)`, { 
                jobId, 
                data: { error: inngestError instanceof Error ? inngestError.message : 'Unknown' }
            })
        }

        // Try to update job status - first try 'cancelled', then fall back to 'failed'
        let updateError = null
        
        // Try 'cancelled' status first
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: cancelledError } = await (supabase
            .from('proposal_jobs') as any)
            .update({
                status: 'cancelled',
                current_step: 'Cancelled by user',
                completed_at: new Date().toISOString(),
            })
            .eq('job_id', jobId)

        if (cancelledError) {
            logger.debug(`'cancelled' status not accepted, trying 'failed'`, { jobId })
            
            // Fall back to 'failed' status
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: failedError } = await (supabase
                .from('proposal_jobs') as any)
                .update({
                    status: 'failed',
                    current_step: 'Cancelled by user',
                    completed_at: new Date().toISOString(),
                })
                .eq('job_id', jobId)

            updateError = failedError
        }

        if (updateError) {
            logger.error(`Failed to update job status`, { 
                jobId, 
                data: { error: updateError.message } 
            })
            return NextResponse.json(
                { error: 'Failed to cancel job', details: updateError.message },
                { status: 500 }
            )
        }

        logger.info(`Job cancelled successfully`, { 
            jobId, 
            data: { previousStatus: job.status, previousAgent: job.current_agent }
        })

        return NextResponse.json({ 
            success: true, 
            message: 'Job cancelled',
            previousStatus: job.status,
        })
    } catch (error) {
        logger.error(`Unexpected error in cancel endpoint`, { 
            data: { error: error instanceof Error ? error.message : 'Unknown' }
        })
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
