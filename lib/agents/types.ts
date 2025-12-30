/**
 * Agent Types & Interfaces
 * 
 * Defines the contract for all agents in the 8-agent RFP proposal system.
 */

import {
    RfpParsedData,
    ValidationReport,
    ContentOutlines,
    VolumePageLimits,
    VolumeProgress,
    AgentName,
    AgentStatus,
    Company,
    PastPerformance,
    Personnel,
    LaborRate,
} from '../database.types'

// ============================================================================
// AGENT RESULT TYPES
// ============================================================================

export type AgentResultStatus = 'success' | 'blocked' | 'warning' | 'error'

export interface AgentResult<T = unknown> {
    status: AgentResultStatus
    data: T
    blockers?: string[]
    warnings?: string[]
    errors?: string[]
    nextAgent?: AgentName
    metadata?: Record<string, unknown>
}

// ============================================================================
// AGENT CONTEXT
// ============================================================================

export interface NormalizedCompanyData {
    company: Company
    pastPerformance: PastPerformance[]
    personnel: Personnel[]
    laborRates: LaborRate[]
}

export interface AgentContext {
    jobId: string
    companyId: string
    intakeId?: string
    
    // RFP data
    rfpText?: string
    rfpFileUrl?: string
    rfpParsedData?: RfpParsedData
    
    // Company data
    companyData?: NormalizedCompanyData
    
    // Content planning
    contentOutlines?: ContentOutlines
    volumePageLimits?: VolumePageLimits
    volumeProgress?: VolumeProgress
    
    // Validation
    validationReport?: ValidationReport
    
    // Generated content
    volumes?: {
        volume1?: string
        volume2?: string
        volume3?: string
        volume4?: string
    }
    
    // Compliance
    complianceScore?: number
    complianceReport?: object
    humanizationReport?: object
    
    // Volume iteration mode (NEW)
    targetVolume?: 1 | 2 | 3 | 4  // If set, agent should process only this volume
    userFeedback?: string // User feedback for iteration
}

// ============================================================================
// AGENT INTERFACE
// ============================================================================

export interface Agent<TInput = AgentContext, TOutput = unknown> {
    name: AgentName
    description: string
    
    /**
     * Execute the agent's primary task
     */
    execute(context: TInput): Promise<AgentResult<TOutput>>
    
    /**
     * Validate that prerequisites are met before execution
     */
    validatePrerequisites?(context: TInput): Promise<{ valid: boolean; errors: string[] }>
}

// ============================================================================
// AGENT 0: VOLUME STRUCTURE ENFORCER
// ============================================================================

export interface Agent0Output {
    volumePageLimits: VolumePageLimits
    volumeProgress: VolumeProgress
    volumeUrls: {
        volume1: string
        volume2: string
        volume3: string
        volume4: string
    }
}

// ============================================================================
// AGENT 1: RFP INTELLIGENCE EXTRACTOR
// ============================================================================

export interface Agent1Output {
    rfpParsedData: RfpParsedData
    complianceMatrixSkeleton: Array<{
        reqId: string
        requirement: string
        mandatory: boolean
        evalFactor?: string
    }>
}

// ============================================================================
// AGENT 2: DATA VALIDATION
// ============================================================================

export interface Agent2Output {
    validationReport: ValidationReport
    dataQualityScore: number
}

// ============================================================================
// AGENT 3: CONTENT ARCHITECT
// ============================================================================

export interface Agent3Output {
    contentOutlines: ContentOutlines
    pageAllocations: {
        volume1: number
        volume2: number
        volume3: number
        volume4: number
    }
}

// ============================================================================
// AGENT 4: MASTER WRITING COORDINATOR
// ============================================================================

export interface VolumeWriteResult {
    volumeNumber: number
    content: string
    pageCount: number
    sectionsWritten: string[]
    failedSections?: string[] // NEW: Track failed sections for graceful error handling
    requirementsAddressed: string[]
}

export interface Agent4Output {
    volumes: {
        volume1: VolumeWriteResult
        volume2: VolumeWriteResult
        volume3: VolumeWriteResult
        volume4: VolumeWriteResult
    }
    totalPages: number
}

// ============================================================================
// AGENT 5: COMPLIANCE AUDITOR
// ============================================================================

export interface ComplianceCheckResult {
    category: 'format' | 'content' | 'scoring'
    item: string
    status: 'pass' | 'fail' | 'warning'
    details: string
    fixPriority?: 'critical' | 'high' | 'medium' | 'low'
}

export interface Agent5Output {
    formatCompliance: ComplianceCheckResult[]
    contentCompliance: ComplianceCheckResult[]
    scoringCompliance: ComplianceCheckResult[]
    overallScore: number
    estimatedWinProbability: number
    criticalFixes: string[]
    highPriorityFixes: string[]
    // NEW: Requirement-level scoring for consultant use
    requirementScores?: Array<{
        requirementId: string
        requirementText: string
        score: number
        rationale: string
        gaps: string[]
    }>
    strengths?: string[]
    criticalGaps?: string[]
}

// ============================================================================
// AGENT 6: HUMANIZATION
// ============================================================================

export interface HumanizationFix {
    volume: number
    page?: number
    original: string
    replacement: string
    reason: string
}

export interface Agent6Output {
    buzzwordsRemoved: number
    phrasesVaried: number
    metricsStandardized: number
    fixes: HumanizationFix[]
    readabilityScore: {
        before: number
        after: number
    }
}

// ============================================================================
// AGENT 7: REVISION HANDLER
// ============================================================================

export interface RevisionRequest {
    source: 'agent5' | 'agent6' | 'user'
    volume: number
    section?: string
    description: string
    priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface RevisionResult {
    request: RevisionRequest
    implemented: boolean
    changes: string[]
    newPageCount?: number
}

export interface Agent7Output {
    revisionsImplemented: RevisionResult[]
    finalComplianceCheck: boolean
    readyForPackaging: boolean
}

// ============================================================================
// AGENT 8: PACKAGING
// ============================================================================

export interface PackagedFile {
    fileName: string
    fileType: 'pdf' | 'docx' | 'xlsx'
    fileUrl: string
    fileSize: number
}

export interface Agent8Output {
    submissionPackage: {
        volume1Pdf: PackagedFile
        volume2Pdf: PackagedFile
        volume3Pdf: PackagedFile
        volume4Pdf: PackagedFile
        costTemplate: PackagedFile
        coverLetter: PackagedFile
    }
    archivePackage: {
        volume1Docx: PackagedFile
        volume2Docx: PackagedFile
        volume3Docx: PackagedFile
        volume4Docx: PackagedFile
        complianceMatrix: PackagedFile
    }
    finalChecklist: {
        item: string
        status: 'pass' | 'fail'
    }[]
}

// ============================================================================
// AGENT ORCHESTRATION
// ============================================================================

export interface AgentPipelineStep {
    agent: AgentName
    status: AgentStatus
    startedAt?: string
    completedAt?: string
    result?: AgentResult
    error?: string
}

export interface AgentPipeline {
    jobId: string
    currentAgent: AgentName
    steps: AgentPipelineStep[]
    context: AgentContext
}

export type AgentEventType = 
    | 'agent.started'
    | 'agent.progress'
    | 'agent.completed'
    | 'agent.failed'
    | 'agent.blocked'
    | 'pipeline.completed'
    | 'pipeline.failed'

export interface AgentEvent {
    type: AgentEventType
    jobId: string
    agent: AgentName
    timestamp: string
    data?: unknown
}






