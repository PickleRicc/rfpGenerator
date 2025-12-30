import { NextRequest, NextResponse } from 'next/server'
import { inngest } from '@/lib/inngest/client'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string; volumeId: string }> }
) {
    try {
        const { jobId, volumeId } = await params
        const volume = parseInt(volumeId)

        if (![1, 2, 3, 4].includes(volume)) {
            return NextResponse.json({ error: 'Invalid volume ID' }, { status: 400 })
        }

        // Get volume info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: job } = await (supabase.from('proposal_jobs') as any)
            .select('volume_status, volume_structure')
            .eq('job_id', jobId)
            .single()

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        const volumeKey = `volume${volume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        const status = job.volume_status?.[volumeKey]

        // Only allow scoring if volume is ready
        if (status !== 'ready_for_scoring') {
            return NextResponse.json({ 
                error: 'Volume not ready for scoring', 
                currentStatus: status 
            }, { status: 400 })
        }

        const volumeName = ['Technical', 'Management', 'Past Performance', 'Pricing'][volume - 1]

        logger.info('[API] Triggering manual volume scoring', {
            data: { jobId, volume, volumeName }
        })

        // Trigger consultation service
        await inngest.send({
            name: 'proposal/volume.consult',
            data: {
                jobId,
                volume,
                volumeName,
                iteration: 1
            }
        })

        return NextResponse.json({ 
            success: true, 
            message: `Scoring started for Volume ${volume}: ${volumeName}` 
        })

    } catch (error) {
        logger.error('[API] Failed to trigger volume scoring', {
            data: { 
                error: error instanceof Error ? error.message : String(error) 
            }
        })
        
        return NextResponse.json(
            { error: 'Failed to trigger scoring' },
            { status: 500 }
        )
    }
}



