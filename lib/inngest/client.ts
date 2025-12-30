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

export interface VolumeDecisionEvent {
    name: 'proposal/volume.decision'
    data: {
        jobId: string
        volume: number // 1-4
        decision: 'approved' | 'iterate'
        finalScore?: number // Present when approved
        userFeedback?: string // Present when iterate
        currentScore?: number // Present when iterate
        iteration?: number // Present when iterate
    }
}

export interface VolumeIterationCompleteEvent {
    name: 'proposal/volume.iteration.complete'
    data: {
        jobId: string
        volume: number
        iteration: number
        newScore: number
        improvement: number
    }
}

export interface PreparationStartEvent {
    name: 'proposal/preparation.start'
    data: {
        jobId: string
        rfpText: string
        companyId: string
    }
}

export interface PreparationCompleteEvent {
    name: 'proposal/preparation.complete'
    data: {
        jobId: string
        companyId: string
        rfpText: string
        volumePageLimits: unknown
        rfpParsedData: unknown
        validationReport: unknown
        contentOutlines: unknown
    }
}

export interface VolumeGenerateEvent {
    name: 'proposal/volume.generate'
    data: {
        jobId: string
        volume: number // 1-4
        volumeName: string
        progressStart: number
        progressEnd: number
    }
}

export interface VolumeGeneratedEvent {
    name: 'proposal/volume.generated'
    data: {
        jobId: string
        volume: number
        volumeName: string
    }
}

export interface VolumeConsultEvent {
    name: 'proposal/volume.consult'
    data: {
        jobId: string
        volume: number
        volumeName: string
        iteration?: number
    }
}

export interface VolumeConsultedEvent {
    name: 'proposal/volume.consulted'
    data: {
        jobId: string
        volume: number
        volumeName: string
        decision: 'approved' | 'iterated' | 'max_iterations_reached'
        finalScore?: number
        newScore?: number
    }
}

export interface AssemblyStartEvent {
    name: 'proposal/assembly.start'
    data: {
        jobId: string
    }
}

export interface AssemblyCompleteEvent {
    name: 'proposal/assembly.complete'
    data: {
        jobId: string
        qualityChecks: unknown[]
        finalSizeKB: number
    }
}

export interface ScoringStartEvent {
    name: 'proposal/scoring.start'
    data: {
        jobId: string
    }
}

export interface ScoringCompleteEvent {
    name: 'proposal/scoring.complete'
    data: {
        jobId: string
        overallScore: number
        needsRevision: boolean
    }
}

// Union type for all events
export type ProposalEvents = 
    | ProposalGenerationEvent 
    | ProposalCancelEvent
    | VolumeDecisionEvent
    | VolumeIterationCompleteEvent
    | PreparationStartEvent
    | PreparationCompleteEvent
    | VolumeGenerateEvent
    | VolumeGeneratedEvent
    | VolumeConsultEvent
    | VolumeConsultedEvent
    | AssemblyStartEvent
    | AssemblyCompleteEvent
    | ScoringStartEvent
    | ScoringCompleteEvent

// ============================================================================
// TIMEOUT CONFIGURATION
// ============================================================================

/**
 * Estimate generation time based on RFP size
 * Multi-agent pipeline with section-by-section writing takes longer but produces better results
 * 
 * - Small RFPs (<20KB): ~10 minutes
 * - Medium RFPs (20-100KB): ~20 minutes
 * - Large RFPs (>100KB): ~35 minutes
 * - Max timeout: 45 minutes (hard cap)
 */
export function estimateGenerationTime(rfpSizeBytes: number): {
    estimatedMinutes: number
    maxMinutes: number
    description: string
} {
    const sizeKB = rfpSizeBytes / 1024
    
    if (sizeKB < 20) {
        return {
            estimatedMinutes: 10,
            maxMinutes: 20,
            description: 'Small RFP (~10 min)'
        }
    } else if (sizeKB < 100) {
        return {
            estimatedMinutes: 20,
            maxMinutes: 35,
            description: 'Medium RFP (~20 min)'
        }
    } else {
        return {
            estimatedMinutes: 35,
            maxMinutes: 45,
            description: 'Large RFP (~35 min)'
        }
    }
}

// Hard cap on any job - allows for rate limiting delays and complex RFPs
// The stalled job monitor checks for ACTIVITY, not just duration
// INCREASED from 45 to 90 minutes to handle parallel volume writing where
// individual Claude API calls can hang for 20+ minutes without timing out
export const MAX_JOB_DURATION_MINUTES = 90

// How long without activity before a job is considered stalled (separate from max duration)
// INCREASED from 5 to 30 minutes because Claude API calls writing large sections
// can legitimately take 20+ minutes, especially under load or rate limiting
export const STALL_THRESHOLD_MINUTES = 30

