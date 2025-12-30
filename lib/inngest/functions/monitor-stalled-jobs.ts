/**
 * Monitor Stalled Jobs Function
 * 
 * Runs every 5 minutes to check for jobs that have stalled
 * Marks jobs as failed if they haven't been updated in 60 minutes
 */

import { inngest } from '../client'
import { supabase } from '../../supabase'
import { logger } from '../../logger'
import { updateJobStatus } from '../db-helpers'

export const monitorStalledJobsFunction = inngest.createFunction(
    {
        id: 'rfp-proposal-generator-monitor-stalled-jobs',
        name: 'Monitor Stalled Jobs',
    },
    { cron: '*/5 * * * *' }, // Every 5 minutes
    async () => {
        logger.info('Checking for stalled jobs')

        const staleThreshold = new Date()
        staleThreshold.setMinutes(staleThreshold.getMinutes() - 60) // 60 minute threshold (considering long-running AI operations)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: stalledJobs } = await (supabase.from('proposal_jobs') as any)
            .select('job_id, current_step, updated_at')
            .eq('status', 'processing')
            .lt('updated_at', staleThreshold.toISOString())

        if (!stalledJobs || stalledJobs.length === 0) {
            logger.info('No stalled jobs found')
            return { stalledJobs: 0 }
        }

        logger.warn(`Found ${stalledJobs.length} stalled jobs`, {
            data: { count: stalledJobs.length }
        })

        for (const job of stalledJobs) {
            await updateJobStatus(job.job_id, 'failed', {
                current_step: `Job stalled - no activity for 30+ minutes`
            })
        }

        return { stalledJobs: stalledJobs.length }
    }
)



