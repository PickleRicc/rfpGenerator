import { supabase } from '@/lib/supabase'
import { inngest, estimateGenerationTime } from '@/lib/inngest/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { rfp_text, company_id, email } = body

        if (!rfp_text || !company_id) {
            return NextResponse.json(
                { error: 'Missing required fields: rfp_text and company_id' },
                { status: 400 }
            )
        }

        // Calculate RFP size and time estimates
        const rfpSizeBytes = new TextEncoder().encode(rfp_text).length
        const timeEstimate = estimateGenerationTime(rfpSizeBytes)

        // Generate unique job ID
        const job_id = crypto.randomUUID()

        // Create initial job record with time estimates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase
            .from('proposal_jobs') as any)
            .insert({
                job_id,
                company_id,
                status: 'processing',
                progress_percent: 0,
                current_step: 'Queued...',
                sections_completed: [],
                rfp_metadata: {
                    rfpSizeBytes,
                    estimatedMinutes: timeEstimate.estimatedMinutes,
                    maxMinutes: timeEstimate.maxMinutes,
                    sizeDescription: timeEstimate.description,
                },
                executive_summary: null,
                technical_approach: null,
                management_approach: null,
                past_performance_volume: null,
                compliance_matrix: null,
                pricing: null,
                cover_and_toc: null,
                appendices: null,
                final_html: null,
                completed_at: null,
            })

        if (insertError) {
            console.error('Error creating job:', insertError)
            return NextResponse.json(
                { error: 'Failed to create proposal job' },
                { status: 500 }
            )
        }

        // Trigger Inngest event (non-blocking, durable background processing)
        await inngest.send({
            name: 'proposal/generate.requested',
            data: {
                jobId: job_id,
                rfpText: rfp_text,
                companyId: company_id,
                email,
                rfpSizeBytes,
                estimatedDurationMinutes: timeEstimate.estimatedMinutes,
            },
        })

        console.log(`[API] Job ${job_id} queued via Inngest (${timeEstimate.description})`)

        // Return immediately with job ID and time estimates
        return NextResponse.json({
            job_id,
            estimated_minutes: timeEstimate.estimatedMinutes,
            max_minutes: timeEstimate.maxMinutes,
            size_description: timeEstimate.description,
        })
    } catch (error) {
        console.error('Error in create proposal endpoint:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
