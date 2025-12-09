import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { generateProposalFunction, monitorStalledJobs } from '@/lib/inngest/functions'

// Create the Inngest serve handler with all functions
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        generateProposalFunction,
        monitorStalledJobs,
    ],
})

