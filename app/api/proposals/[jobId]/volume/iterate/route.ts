import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { logger } from '@/lib/logger'

/**
 * API Route: Request Volume Iteration
 * 
 * Triggers the Inngest event to iterate on a volume with user feedback.
 * This releases the pipeline from the user approval gate and triggers a rewrite.
 */

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json()
        
        const { volume, feedback, currentScore, iteration } = body

        // Validate inputs
        if (!volume || typeof volume !== 'number' || volume < 1 || volume > 4) {
            return NextResponse.json(
                { error: 'Invalid volume number (must be 1-4)' },
                { status: 400 }
            )
        }

        if (typeof feedback !== 'string') {
            return NextResponse.json(
                { error: 'Invalid feedback (must be string)' },
                { status: 400 }
            )
        }

        if (typeof currentScore !== 'number') {
            return NextResponse.json(
                { error: 'Invalid currentScore' },
                { status: 400 }
            )
        }

        if (typeof iteration !== 'number' || iteration < 1 || iteration > 5) {
            return NextResponse.json(
                { error: 'Invalid iteration number (must be 1-5)' },
                { status: 400 }
            )
        }

        logger.info('[API] Volume iteration request', {
            data: { jobId, volume, iteration, feedbackLength: feedback.length }
        })

        // Send Inngest event to trigger iteration
        await inngest.send({
            name: 'proposal/volume.decision',
            data: {
                jobId,
                volume,
                decision: 'iterate',
                userFeedback: feedback,
                currentScore,
                iteration
            }
        })

        logger.info('[API] Volume iteration triggered', {
            data: { jobId, volume, iteration }
        })

        return NextResponse.json({
            success: true,
            message: `Volume ${volume} iteration ${iteration + 1} started`,
            volume,
            iteration: iteration + 1
        })

    } catch (error) {
        logger.error('[API] Volume iteration failed', {
            data: {
                error: error instanceof Error ? error.message : String(error)
            }
        })

        return NextResponse.json(
            { error: 'Failed to request iteration' },
            { status: 500 }
        )
    }
}
