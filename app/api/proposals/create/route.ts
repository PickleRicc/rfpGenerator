import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { generateProposal } from '@/lib/proposal-service'

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

        // Generate unique job ID
        const job_id = crypto.randomUUID()

        // Create initial job record
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insertError } = await (supabase
            .from('proposal_jobs') as any)
            .insert({
                job_id,
                company_id,
                status: 'processing',
                progress_percent: 0,
                current_step: 'Starting...',
                sections_completed: [],
                rfp_metadata: null,
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

        // Start background processing (non-blocking)
        // Using the NEW simplified proposal service
        generateProposal(job_id, rfp_text, company_id, email).catch((error) => {
            console.error('Background processing error:', error)
            // Error is already handled inside generateProposal
        })

        // Return immediately with job ID
        return NextResponse.json({ job_id })
    } catch (error) {
        console.error('Error in create proposal endpoint:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
