import { Inngest } from 'inngest'

// Create the Inngest client
export const inngest = new Inngest({
    id: 'rfp-proposal-generator',
    name: 'RFP Proposal Generator',
})

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface ProposalGenerationEvent {
    name: 'proposal/generate.requested'
    data: {
        jobId: string
        rfpText: string
        companyId: string
        email?: string
        rfpSizeBytes: number
        estimatedDurationMinutes: number
    }
}

export interface ProposalCancelEvent {
    name: 'proposal/generate.cancelled'
    data: {
        jobId: string
        reason: string
    }
}

// Union type for all events
export type ProposalEvents = ProposalGenerationEvent | ProposalCancelEvent

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

/**
 * Estimate generation time based on RFP size
 * - Small RFPs (<20KB): ~4 minutes
 * - Medium RFPs (20-100KB): ~6 minutes
 * - Large RFPs (>100KB): ~10 minutes
 * - Max timeout: 15 minutes (hard cap)
 */
export function estimateGenerationTime(rfpSizeBytes: number): {
    estimatedMinutes: number
    maxMinutes: number
    description: string
} {
    const sizeKB = rfpSizeBytes / 1024
    
    if (sizeKB < 20) {
        return {
            estimatedMinutes: 4,
            maxMinutes: 8,
            description: 'Small RFP (~4 min)'
        }
    } else if (sizeKB < 100) {
        return {
            estimatedMinutes: 6,
            maxMinutes: 12,
            description: 'Medium RFP (~6 min)'
        }
    } else {
        return {
            estimatedMinutes: 10,
            maxMinutes: 15,
            description: 'Large RFP (~10 min)'
        }
    }
}

// Hard cap on any job - if it runs longer than this, something is wrong
export const MAX_JOB_DURATION_MINUTES = 15

