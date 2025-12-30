import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * API Route: Download Volume Content
 * 
 * Returns the HTML content of a specific volume for download.
 * Optionally converts to PDF if format=pdf query parameter is provided.
 */

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string; volumeId: string }> }
) {
    try {
        const { jobId, volumeId } = await params
        const searchParams = request.nextUrl.searchParams
        const format = searchParams.get('format') || 'html'
        
        // Validate volume ID
        const volumeNum = parseInt(volumeId)
        if (isNaN(volumeNum) || volumeNum < 1 || volumeNum > 4) {
            return NextResponse.json(
                { error: 'Invalid volume ID (must be 1-4)' },
                { status: 400 }
            )
        }

        // Fetch job data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job, error } = await (supabase.from('proposal_jobs') as any)
            .select('volumes, volume_status, rfp_metadata, job_id')
            .eq('job_id', jobId)
            .single()

        if (error || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        const volumeKey = `volume${volumeNum}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        const volumeContent = job.volumes?.[volumeKey]
        const volumeStatus = job.volume_status?.[volumeKey]
        const volumeNames = ['Technical', 'Management', 'Past Performance', 'Pricing']
        const volumeName = volumeNames[volumeNum - 1]

        // Check if volume exists and is ready
        if (!volumeContent) {
            return NextResponse.json(
                { error: `Volume ${volumeNum} content not found. Volume may still be generating.` },
                { status: 404 }
            )
        }

        // Allow downloading for volumes that are awaiting approval, approved, or complete
        const downloadableStatuses = ['awaiting_approval', 'approved', 'complete']
        if (!downloadableStatuses.includes(volumeStatus)) {
            return NextResponse.json(
                { error: `Volume ${volumeNum} is not yet ready for download (status: ${volumeStatus})` },
                { status: 400 }
            )
        }

        logger.info('[API] Volume download requested', {
            data: { jobId, volume: volumeNum, format }
        })

        // For HTML format, return the content with download headers
        if (format === 'html') {
            const filename = `Volume_${volumeNum}_${volumeName}_${jobId.substring(0, 8)}.html`
            
            return new NextResponse(volumeContent, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
            })
        }

        // For PDF format, return error for now (PDF conversion would require puppeteer or similar)
        // TODO: Implement PDF conversion using puppeteer or a PDF library
        if (format === 'pdf') {
            return NextResponse.json(
                { error: 'PDF download not yet implemented. Please use format=html for now.' },
                { status: 501 }
            )
        }

        return NextResponse.json(
            { error: 'Invalid format. Use format=html or format=pdf' },
            { status: 400 }
        )

    } catch (error) {
        logger.error('[API] Failed to download volume content', {
            data: {
                error: error instanceof Error ? error.message : String(error)
            }
        })
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}


