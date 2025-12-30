import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * API Route: View Volume Content
 * 
 * Returns the HTML content of a specific volume for viewing in a modal or separate page.
 */

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string; volumeId: string }> }
) {
    try {
        const { jobId, volumeId } = await params
        
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
            .select('volumes, volume_status, job_id')
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

        // Check if volume exists and is ready
        if (!volumeContent) {
            return NextResponse.json(
                { error: `Volume ${volumeNum} content not found. Volume may still be generating.` },
                { status: 404 }
            )
        }

        // Allow viewing for volumes that are awaiting approval, approved, or complete
        const viewableStatuses = ['awaiting_approval', 'approved', 'complete']
        if (!viewableStatuses.includes(volumeStatus)) {
            return NextResponse.json(
                { error: `Volume ${volumeNum} is not yet ready for viewing (status: ${volumeStatus})` },
                { status: 400 }
            )
        }

        logger.info('[API] Volume view requested', {
            data: { jobId, volume: volumeNum }
        })

        // Return HTML content with proper headers
        return new NextResponse(volumeContent, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        })

    } catch (error) {
        logger.error('[API] Failed to fetch volume content', {
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


