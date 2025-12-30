import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { logger } from '@/lib/logger'

/**
 * API Route: Approve Volume
 * 
 * Triggers the Inngest event to approve a volume and proceed to the next one.
 * This releases the pipeline from the user approval gate.
 */

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json()
        
        const { volume, finalScore } = body

        // Validate inputs
        if (!volume || typeof volume !== 'number' || volume < 1 || volume > 4) {
            return NextResponse.json(
                { error: 'Invalid volume number (must be 1-4)' },
                { status: 400 }
            )
        }

        if (typeof finalScore !== 'number') {
            return NextResponse.json(
                { error: 'Invalid finalScore' },
                { status: 400 }
            )
        }

        logger.info('[API] Volume approval request', {
            data: { jobId, volume, finalScore }
        })

        // Send Inngest event to release the approval gate
        await inngest.send({
            name: 'proposal/volume.decision',
            data: {
                jobId,
                volume,
                decision: 'approved',
                finalScore
            }
        })

        logger.info('[API] Volume approved', {
            data: { jobId, volume }
        })

        return NextResponse.json({
            success: true,
            message: `Volume ${volume} approved`,
            volume,
            finalScore
        })

    } catch (error) {
        logger.error('[API] Volume approval failed', {
            data: {
                error: error instanceof Error ? error.message : String(error)
            }
        })

        return NextResponse.json(
            { error: 'Failed to approve volume' },
            { status: 500 }
        )
    }
}
