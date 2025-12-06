import { supabase } from '@/lib/supabase'
import { generateProposalPdf } from '@/lib/pdf-generator'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        // Fetch the proposal job
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error } = await (supabase
            .from('proposal_jobs') as any)
            .select('final_html, rfp_metadata, status')
            .eq('job_id', jobId)
            .single()

        if (error || !job) {
            return NextResponse.json(
                { error: 'Proposal not found' },
                { status: 404 }
            )
        }

        if (job.status !== 'completed') {
            return NextResponse.json(
                { error: 'Proposal is not yet complete' },
                { status: 400 }
            )
        }

        if (!job.final_html) {
            return NextResponse.json(
                { error: 'No HTML content available' },
                { status: 400 }
            )
        }

        // Extract metadata for headers
        const solicitationNum = job.rfp_metadata?.solicitationNum || 'Proposal'
        const companyName = job.rfp_metadata?.agency || ''

        console.log(`[Download API] Generating PDF for job ${jobId}...`)

        // Generate PDF
        const pdfBuffer = await generateProposalPdf(
            job.final_html,
            solicitationNum,
            companyName
        )

        console.log(`[Download API] PDF generated: ${pdfBuffer.length} bytes`)

        // Create filename
        const filename = `proposal-${solicitationNum.replace(/[^a-zA-Z0-9]/g, '-')}-${jobId.slice(0, 8)}.pdf`

        // Return PDF as download - convert Buffer to Uint8Array for NextResponse
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
            },
        })

    } catch (error) {
        console.error('[Download API] Error generating PDF:', error)
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        )
    }
}
