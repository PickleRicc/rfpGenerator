'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
    FileText, 
    Users, 
    TrendingUp, 
    DollarSign, 
    CheckCircle2, 
    Clock, 
    Loader2, 
    X, 
    Download,
    Eye,
    Calendar,
    Info,
    Trophy
} from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

interface AgentProgressItem {
    status: 'pending' | 'running' | 'complete' | 'failed' | 'blocked'
    started_at?: string
    completed_at?: string
    error?: string
}

interface AgentProgressMap {
    agent_0?: AgentProgressItem
    agent_1?: AgentProgressItem
    agent_2?: AgentProgressItem
    agent_3?: AgentProgressItem
    agent_4?: AgentProgressItem
    agent_5?: AgentProgressItem
    agent_8?: AgentProgressItem
}

interface ProposalJob {
    job_id: string
    company_id: string
    status: 'draft' | 'intake' | 'validating' | 'blocked' | 'processing' | 'review' | 'completed' | 'failed' | 'cancelled' | 'needs_revision'
    progress_percent: number
    current_step: string
    current_agent: string | null
    agent_progress: AgentProgressMap | null
    validation_status: string | null
    compliance_score: number | null
    rfp_metadata: {
        agency?: string
        solicitationNum?: string
        deadline?: string
        contractValue?: string
        naicsCode?: string
        setAside?: string
    } | null
    final_html: string | null
    created_at: string
    completed_at: string | null
    current_volume?: number
    volume_iterations?: Record<string, number>
    volume_scores?: Record<string, number | null>
    volume_status?: Record<string, string>
    awaiting_user_approval?: boolean
    current_volume_insights?: any
    user_feedback_history?: Array<{
        volume: number
        iteration: number
        feedback: string
        timestamp: string
    }>
    volumes?: {
        volume1?: string
        volume2?: string
        volume3?: string
        volume4?: string
    }
    volume_section_progress?: {
        volume1?: { sections: Array<{ name: string; status: string; progress: number; timeSeconds?: number }> }
        volume2?: { sections: Array<{ name: string; status: string; progress: number; timeSeconds?: number }> }
        volume3?: { sections: Array<{ name: string; status: string; progress: number; timeSeconds?: number }> }
        volume4?: { sections: Array<{ name: string; status: string; progress: number; timeSeconds?: number }> }
    }
    volume_compliance_details?: {
        volume1?: {
            requirementScores?: Array<{ requirementId: string; requirementText: string; score: number; rationale: string; gaps: string[] }>
            strengths?: string[]
            criticalGaps?: string[]
            overallScore: number
        }
        volume2?: {
            requirementScores?: Array<{ requirementId: string; requirementText: string; score: number; rationale: string; gaps: string[] }>
            strengths?: string[]
            criticalGaps?: string[]
            overallScore: number
        }
        volume3?: {
            requirementScores?: Array<{ requirementId: string; requirementText: string; score: number; rationale: string; gaps: string[] }>
            strengths?: string[]
            criticalGaps?: string[]
            overallScore: number
        }
        volume4?: {
            requirementScores?: Array<{ requirementId: string; requirementText: string; score: number; rationale: string; gaps: string[] }>
            strengths?: string[]
            criticalGaps?: string[]
            overallScore: number
        }
    }
    // Modular function status fields
    preparation_phase_status?: 'pending' | 'running' | 'complete' | 'failed' | 'blocked'
    volume_generation_status?: {
        volume1?: 'pending' | 'generating' | 'complete' | 'failed'
        volume2?: 'pending' | 'generating' | 'complete' | 'failed'
        volume3?: 'pending' | 'generating' | 'complete' | 'failed'
        volume4?: 'pending' | 'generating' | 'complete' | 'failed'
    }
    assembly_status?: 'pending' | 'running' | 'complete' | 'failed'
    final_scoring_status?: 'pending' | 'running' | 'complete' | 'failed'
    final_compliance_report?: {
        overallComplianceScore: number
        volumeScores: {
            volume1: number
            volume2: number
            volume3: number
            volume4: number
        }
        crossVolumeAnalysis: {
            duplicateContentCheck: { passed: boolean; details: string; duplicateCount: number }
            consistencyCheck: { passed: boolean; details: string; inconsistencies: string[] }
            completenessCheck: { passed: boolean; details: string; missingElements: string[] }
            rfpAlignmentCheck: { passed: boolean; details: string; alignmentScore: number }
        }
        qualityChecks: Array<{ check: string; passed: boolean; details?: string }>
        allCriticalGaps: string[]
        needsRevision: boolean
        recommendation: string
        generatedAt: string
    }
    quality_checks?: Array<{ check: string; passed: boolean; details?: string }>
}

const VOLUMES = [
    { id: 1, name: 'Technical', icon: FileText },
    { id: 2, name: 'Management', icon: Users },
    { id: 3, name: 'Past Performance', icon: TrendingUp },
    { id: 4, name: 'Pricing', icon: DollarSign },
]

const PREPARATION_STEPS = [
    { id: 'agent_0', name: 'Volume Structure', desc: 'Proposal structure defined and validated' },
    { id: 'agent_1', name: 'RFP Parser', desc: 'RFP document analyzed and requirements extracted' },
    { id: 'agent_2', name: 'Data Validation', desc: 'Source data verified and quality checked' },
    { id: 'agent_3', name: 'Content Mapper', desc: 'Content sources mapped to proposal sections' },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ProposalProgressPage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params.jobId as string
    
    const [job, setJob] = useState<ProposalJob | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedVolume, setSelectedVolume] = useState<number | null>(null)
    const [feedback, setFeedback] = useState('')
    const [showSectionProgress, setShowSectionProgress] = useState<number | null>(null)
    
    useEffect(() => {
        let interval: NodeJS.Timeout
        
        const fetchJob = async () => {
            try {
                const response = await fetch(`/api/proposals/status/${jobId}`)
                if (!response.ok) throw new Error('Failed to fetch job')
                
                const data = await response.json()
                setJob(data)
                setError(null)
                
                if (data.status === 'completed' || data.status === 'failed') {
                    if (interval) clearInterval(interval)
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }
        
        fetchJob()
        interval = setInterval(fetchJob, 3000)
        
        return () => {
            if (interval) clearInterval(interval)
        }
    }, [jobId])
    
    const handleCancel = async () => {
        if (!confirm('Cancel this proposal generation?')) return
        try {
            await fetch(`/api/proposals/cancel/${jobId}`, { method: 'POST' })
            router.push('/')
        } catch {
            alert('Failed to cancel')
        }
    }
    
    const handleApprove = async (volumeId: number) => {
        try {
            // Get the final score for this volume
            const volumeKey = `volume${volumeId}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
            const finalScore = job?.volume_scores?.[volumeKey] || 0
            
            const response = await fetch(`/api/proposals/${jobId}/volume/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    volume: volumeId,
                    finalScore 
                })
            })
            
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to approve volume')
            }
            
            setSelectedVolume(null)
        } catch (error) {
            alert(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
    
    const handleIterate = async (volumeId: number) => {
        try {
            // Get current score and iteration for this volume
            const volumeKey = `volume${volumeId}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
            const currentScore = job?.volume_scores?.[volumeKey] || 0
            const iteration = job?.volume_iterations?.[volumeKey] || 1
            
            const response = await fetch(`/api/proposals/${jobId}/volume/iterate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    volume: volumeId, 
                    feedback: feedback.trim(),
                    currentScore,
                    iteration
                })
            })
            
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to request iteration')
            }
            
            setSelectedVolume(null)
            setFeedback('')
        } catch (error) {
            alert(`Failed to request iteration: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
    
    const handleScore = async (volumeId: number) => {
        if (!confirm('Start scoring and compliance analysis for this volume?')) return
        try {
            const response = await fetch(`/api/proposals/${jobId}/volume/${volumeId}/score`, {
                method: 'POST',
            })
            
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to start scoring')
            }
            
            alert('✓ Scoring started! This may take 1-2 minutes.')
        } catch (error) {
            alert(`Failed to start scoring: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    const handleAutoFixCompliance = (volumeId: number) => {
        const volumeKey = `volume${volumeId}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
        const complianceDetails = job?.volume_compliance_details?.[volumeKey]
        
        if (!complianceDetails) {
            alert('No compliance data available for this volume')
            return
        }
        
        // Build comprehensive feedback from compliance findings
        let autoFeedback = "Please address the following compliance gaps and requirement issues:\n\n"
        
        // Add overall score context if below 95%
        if (complianceDetails.overallScore < 95) {
            autoFeedback += `📊 OVERALL COMPLIANCE SCORE: ${complianceDetails.overallScore}% (Target: 95%+)\n\n`
        }
        
        // Add critical gaps
        if (complianceDetails.criticalGaps && complianceDetails.criticalGaps.length > 0) {
            autoFeedback += "🚨 CRITICAL GAPS:\n"
            complianceDetails.criticalGaps.forEach((gap, idx) => {
                autoFeedback += `${idx + 1}. ${gap}\n`
            })
            autoFeedback += "\n"
        }
        
        // Add requirement-specific analysis (including scores, rationale, and gaps)
        if (complianceDetails.requirementScores && complianceDetails.requirementScores.length > 0) {
            // Include requirements with scores < 95% OR that have explicit gaps
            const requirementsToFix = complianceDetails.requirementScores.filter(req => 
                req.score < 95 || (req.gaps && req.gaps.length > 0)
            )
            
            if (requirementsToFix.length > 0) {
                autoFeedback += "📋 REQUIREMENT-SPECIFIC ISSUES:\n\n"
                requirementsToFix.forEach((req) => {
                    autoFeedback += `Requirement ${req.requirementId}: ${req.requirementText}\n`
                    autoFeedback += `Score: ${req.score}%\n`
                    
                    // Add rationale if available
                    if (req.rationale) {
                        autoFeedback += `Analysis: ${req.rationale}\n`
                    }
                    
                    // Add specific gaps if available
                    if (req.gaps && req.gaps.length > 0) {
                        autoFeedback += `Specific Gaps:\n`
                        req.gaps.forEach(gap => {
                            autoFeedback += `  • ${gap}\n`
                        })
                    }
                    
                    autoFeedback += "\n"
                })
            }
        }
        
        autoFeedback += "Please revise the volume to comprehensively address all identified issues, improving scores and ensuring full compliance with RFP requirements."
        
        // Fill the feedback textarea
        setFeedback(autoFeedback)
    }
    
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <div className="text-lg text-gray-300">Loading...</div>
                </div>
            </div>
        )
    }
    
    if (error || !job) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-lg text-gray-100 mb-4">Error loading proposal</div>
                    <div className="text-gray-400 mb-4">{error || 'Job not found'}</div>
                    <button 
                        onClick={() => router.push('/')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        )
    }
    
    const isComplete = job.status === 'completed'
    const isProcessing = job.status === 'processing' || job.status === 'validating' || job.status === 'review'
    const allVolumesComplete = VOLUMES.every(v => {
        const volKey = `volume${v.id}`
        return job.volume_status?.[volKey] === 'approved' || job.volume_status?.[volKey] === 'complete'
    })
    
    // Calculate average score
    const volumeScores = VOLUMES.map(v => job.volume_scores?.[`volume${v.id}`]).filter(s => s !== null && s !== undefined) as number[]
    const avgScore = volumeScores.length > 0 
        ? (volumeScores.reduce((a, b) => a + b, 0) / volumeScores.length).toFixed(2)
        : null
    
    return (
        <>
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
            <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#f5f5f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ backgroundColor: '#171717', borderBottom: '1px solid #262626', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Proposal Generation</h1>
                            <p style={{ fontSize: '14px', color: '#737373', margin: '4px 0 0 0' }}>Job ID: {jobId}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {isProcessing && (
                                <>
                                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                                        {Math.round(job.progress_percent)}%
                                    </span>
                                    <button
                                        onClick={handleCancel}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#dc2626',
                                            color: '#ffffff',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                    >
                                        <X style={{ width: 16, height: 16 }} />
                                        Cancel Job
                                    </button>
                                </>
                            )}
                            {isComplete && (
                                <>
                                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                                        {Math.round(job.progress_percent)}%
                                    </span>
                                    <div style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#16a34a',
                                        color: '#ffffff',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <CheckCircle2 style={{ width: 16, height: 16 }} />
                                        Generation Complete
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            
            <main style={{ maxWidth: '1600px', margin: '0 auto', padding: '40px 32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '32px' }}>
                    {/* Main Content - 8 columns */}
                    <div style={{ 
                        gridColumn: 'span 12',
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '32px' 
                    }}>
                        {/* Overall Progress */}
                        <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Overall Progress</h2>
                                    <Info style={{ width: 16, height: 16, color: '#737373' }} />
                                </div>
                                <span style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
                                    {Math.round(job.progress_percent)}%
                                </span>
                            </div>
                            
                            <div style={{ width: '100%', backgroundColor: '#262626', borderRadius: '9999px', height: '12px', marginBottom: '12px', overflow: 'hidden' }}>
                                <div 
                                    style={{ 
                                        height: '12px', 
                                        borderRadius: '9999px', 
                                        transition: 'width 0.5s ease',
                                        backgroundColor: isComplete ? '#22c55e' : '#3b82f6',
                                        width: `${job.progress_percent}%`
                                    }}
                                />
                            </div>
                            
                            {isProcessing && job.current_step && (
                                <p style={{ fontSize: '14px', color: '#d4d4d4', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    {isComplete ? (
                                        <>
                                            <CheckCircle2 style={{ width: 16, height: 16, color: '#22c55e' }} />
                                            Final assembly in progress...
                                        </>
                                    ) : (
                                        <>
                                            <Loader2 style={{ width: 16, height: 16, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                                            {job.current_step}
                                        </>
                                    )}
                                </p>
                            )}
                            {isProcessing && !isComplete && (
                                <p style={{ fontSize: '12px', color: '#737373', marginTop: '8px', margin: '8px 0 0 0' }}>
                                    Estimated time remaining: ~{Math.max(1, Math.round((100 - job.progress_percent) / 2))} minutes
                                </p>
                            )}
                        </div>
                        
                        {/* Volumes */}
                        <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Volume Generation</h2>
                                {allVolumesComplete && (
                                    <span style={{ padding: '4px 12px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '12px', fontWeight: 500, borderRadius: '9999px' }}>
                                        All Complete
                                    </span>
                                )}
                            </div>
                            
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                                gap: '24px' 
                            }}>
                                {VOLUMES.map((volume) => {
                                    const volumeKey = `volume${volume.id}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                    const status = job.volume_status?.[volumeKey] || 'pending'
                                    const genStatus = job.volume_generation_status?.[volumeKey] || 'pending'
                                    const score = job.volume_scores?.[volumeKey]
                                    const iteration = job.volume_iterations?.[volumeKey] || 1
                                    const isActive = job.current_volume === volume.id
                                    const readyForScoring = status === 'ready_for_scoring'
                                    const awaiting = status === 'awaiting_approval'
                                    const isComplete = status === 'approved' || status === 'complete'
                                    // Only treat as "iterating" if we're on iteration > 1 (actual re-writes)
                                    const isIterating = (status === 'iterating' || status === 'scoring') && iteration > 1
                                    const isScoring = status === 'scoring' && iteration === 1 // First-time scoring
                                    const isGenerating = (isActive && !isComplete && !awaiting && !readyForScoring) || isIterating || isScoring || genStatus === 'generating'
                                    const VolumeIcon = volume.icon
                                    
                                    // Calculate volume progress based on actual status
                                    // Only 100% when approved and ready for download
                                    let volumeProgress = 0
                                    if (isComplete) {
                                        // Volume is approved/complete - 100%
                                        volumeProgress = 100
                                    } else if (readyForScoring) {
                                        // Volume generation complete, ready for scoring - 100%
                                        volumeProgress = 100
                                    } else if (awaiting) {
                                        // Volume is awaiting approval - show score as progress indicator
                                        volumeProgress = score !== null && score !== undefined ? score : 0
                                    } else if (isGenerating) {
                                        // Volume is generating - calculate based on section progress
                                        const volumeKey = `volume${volume.id}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                        const sectionData = job.volume_section_progress?.[volumeKey]?.sections || []
                                        if (sectionData.length > 0) {
                                            const completedSections = sectionData.filter(s => s.status === 'complete').length
                                            volumeProgress = Math.round((completedSections / sectionData.length) * 100)
                                        } else {
                                            // Fallback to overall progress if no section data yet
                                            volumeProgress = Math.min(80, (job.progress_percent - (volume.id - 1) * 20) * 5)
                                        }
                                    } else {
                                        // Volume is pending - 0%
                                        volumeProgress = 0
                                    }
                                    
                                    const borderColor = readyForScoring ? '#3b82f6' : awaiting ? '#f97316' : isIterating ? '#a855f7' : isScoring ? '#3b82f6' : isActive ? '#f97316' : isComplete ? '#22c55e' : '#262626'
                                    const bgColor = '#171717'
                                    
                                    return (
                                        <div 
                                            key={volume.id}
                                            style={{
                                                border: `1px solid ${borderColor}`,
                                                borderRadius: '12px',
                                                padding: '24px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                                backgroundColor: bgColor,
                                                cursor: (awaiting || isGenerating || readyForScoring) ? 'pointer' : 'default',
                                                transition: 'all 0.2s'
                                            }}
                                            onClick={awaiting ? () => setSelectedVolume(volume.id) : isGenerating ? () => setShowSectionProgress(volume.id) : readyForScoring ? () => handleScore(volume.id) : undefined}
                                            onMouseEnter={(awaiting || isGenerating || readyForScoring) ? (e) => e.currentTarget.style.backgroundColor = '#1f1f1f' : undefined}
                                            onMouseLeave={(awaiting || isGenerating || readyForScoring) ? (e) => e.currentTarget.style.backgroundColor = bgColor : undefined}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        backgroundColor: isComplete ? 'rgba(34, 197, 94, 0.2)' : isIterating ? 'rgba(168, 85, 247, 0.2)' : isActive ? 'rgba(249, 115, 22, 0.2)' : '#262626'
                                                    }}>
                                                        <VolumeIcon style={{
                                                            width: 20,
                                                            height: 20,
                                                            color: isComplete ? '#4ade80' : isIterating ? '#a855f7' : isActive ? '#fb923c' : '#737373'
                                                        }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                                                Volume {volume.id}: {volume.name}
                                                            </h3>
                                                            {iteration > 1 && (
                                                                <span style={{
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    backgroundColor: '#a855f720',
                                                                    color: '#a855f7'
                                                                }}>
                                                                    v{iteration}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                            {isScoring && (
                                                                <>
                                                                    <Loader2 style={{ width: 12, height: 12, color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                                                                    <span style={{ fontSize: '12px', color: '#3b82f6' }}>
                                                                        Scoring & Reviewing
                                                                    </span>
                                                                </>
                                                            )}
                                                            {isIterating && (
                                                                <>
                                                                    <Loader2 style={{ width: 12, height: 12, color: '#a855f7', animation: 'spin 1s linear infinite' }} />
                                                                    <span style={{ fontSize: '12px', color: '#a855f7' }}>
                                                                        Iterating (v{iteration})
                                                                    </span>
                                                                </>
                                                            )}
                                                            {!isIterating && !isScoring && genStatus === 'generating' && (
                                                                <>
                                                                    <Loader2 style={{ width: 12, height: 12, color: '#fb923c', animation: 'spin 1s linear infinite' }} />
                                                                    <span style={{ fontSize: '12px', color: '#fb923c' }}>Generating (Parallel)</span>
                                                                </>
                                                            )}
                                                            {!isIterating && genStatus !== 'generating' && isGenerating && (
                                                                <>
                                                                    <Loader2 style={{ width: 12, height: 12, color: '#fb923c', animation: 'spin 1s linear infinite' }} />
                                                                    <span style={{ fontSize: '12px', color: '#fb923c' }}>Generating</span>
                                                                </>
                                                            )}
                                                            {readyForScoring && (
                                                                <>
                                                                    <span style={{ fontSize: '18px' }}>🎯</span>
                                                                    <span style={{ fontSize: '12px', color: '#3b82f6' }}>Ready to Score</span>
                                                                </>
                                                            )}
                                                            {awaiting && (
                                                                <>
                                                                    <Clock style={{ width: 12, height: 12, color: '#f97316' }} />
                                                                    <span style={{ fontSize: '12px', color: '#f97316' }}>Awaiting Approval</span>
                                                                </>
                                                            )}
                                                            {isComplete && (
                                                                <>
                                                                    <CheckCircle2 style={{ width: 12, height: 12, color: '#4ade80' }} />
                                                                    <span style={{ fontSize: '12px', color: '#4ade80' }}>Complete</span>
                                                                </>
                                                            )}
                                                            {!isActive && !isComplete && !isIterating && !isScoring && genStatus !== 'generating' && !awaiting && (
                                                                <>
                                                                    <Clock style={{ width: 12, height: 12, color: '#737373' }} />
                                                                    <span style={{ fontSize: '12px', color: '#737373' }}>
                                                                        {genStatus === 'failed' ? 'Failed' : 'Pending'}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {readyForScoring && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleScore(volume.id)
                                                        }}
                                                        style={{
                                                            padding: '12px 24px',
                                                            backgroundColor: '#3b82f6',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: 600,
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#2563eb'
                                                            e.currentTarget.style.transform = 'translateY(-1px)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = '#3b82f6'
                                                            e.currentTarget.style.transform = 'translateY(0)'
                                                        }}
                                                    >
                                                        🎯 Score Volume
                                                    </button>
                                                )}
                                                
                                                {score !== null && score !== undefined && !readyForScoring && (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{
                                                            fontSize: '30px',
                                                            fontWeight: 700,
                                                            color: score >= 85 ? '#4ade80' : '#fb923c'
                                                        }}>
                                                            {score}%
                                                        </div>
                                                        {score >= 85 && (
                                                            <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '4px' }}>
                                                                Excellent - Above Target
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {(isGenerating || isComplete || awaiting || readyForScoring) && (
                                                <div style={{ marginTop: '16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '12px', color: '#737373' }}>
                                                            {awaiting ? 'Score' : 'Progress'}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: '#737373' }}>{Math.round(volumeProgress)}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', backgroundColor: '#262626', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                                                        <div 
                                                            style={{
                                                                height: '8px',
                                                                borderRadius: '9999px',
                                                                transition: 'width 0.3s',
                                                                backgroundColor: isComplete ? '#22c55e' : awaiting ? '#f97316' : isIterating ? '#a855f7' : isScoring ? '#3b82f6' : '#f97316',
                                                                width: `${volumeProgress}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {isGenerating && job.current_step && (
                                                <p style={{ fontSize: '12px', color: '#737373', marginTop: '8px', margin: '8px 0 0 0' }}>
                                                    {job.current_step}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        
                        {/* Preparation Phase */}
                        <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Preparation Phase</h2>
                                {job.preparation_phase_status && (
                                    <div style={{
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        backgroundColor: 
                                            job.preparation_phase_status === 'complete' ? '#22c55e20' :
                                            job.preparation_phase_status === 'running' ? '#3b82f620' :
                                            job.preparation_phase_status === 'failed' ? '#ef444420' :
                                            job.preparation_phase_status === 'blocked' ? '#f59e0b20' :
                                            '#26262620',
                                        color:
                                            job.preparation_phase_status === 'complete' ? '#22c55e' :
                                            job.preparation_phase_status === 'running' ? '#3b82f6' :
                                            job.preparation_phase_status === 'failed' ? '#ef4444' :
                                            job.preparation_phase_status === 'blocked' ? '#f59e0b' :
                                            '#737373'
                                    }}>
                                        {job.preparation_phase_status === 'complete' ? '✓ Complete' :
                                         job.preparation_phase_status === 'running' ? '⟳ Running' :
                                         job.preparation_phase_status === 'failed' ? '✗ Failed' :
                                         job.preparation_phase_status === 'blocked' ? '⚠ Blocked' :
                                         '○ Pending'}
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {PREPARATION_STEPS.map((step) => {
                                    const agentProgress = job.agent_progress?.[step.id as keyof AgentProgressMap]
                                    const complete = agentProgress?.status === 'complete'
                                    const running = agentProgress?.status === 'running'
                                    
                                    return (
                                        <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                marginTop: '2px',
                                                backgroundColor: complete ? '#22c55e' : running ? '#3b82f6' : '#262626',
                                                color: complete || running ? '#ffffff' : '#737373'
                                            }}>
                                                {complete && <CheckCircle2 style={{ width: 16, height: 16 }} />}
                                                {running && <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', marginBottom: '4px' }}>{step.name}</div>
                                                <div style={{ fontSize: '12px', color: '#737373' }}>{step.desc}</div>
                                            </div>
                                            <div style={{
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                color: complete ? '#4ade80' : running ? '#3b82f6' : '#737373'
                                            }}>
                                                {complete ? 'Completed' : running ? 'Running' : 'Pending'}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        
                        {/* Final Assembly Section - shown when near completion */}
                        {isComplete && (
                            <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Final Assembly</h2>
                                        <Info style={{ width: 16, height: 16, color: '#737373' }} />
                                    </div>
                                    <span style={{ padding: '4px 12px', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '12px', fontWeight: 500, borderRadius: '9999px' }}>
                                        Agent 8 Active
                                    </span>
                                </div>
                                
                                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontSize: '14px', color: '#d4d4d4', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', margin: '0 0 8px 0' }}>
                                        <div style={{ width: 8, height: 8, backgroundColor: '#3b82f6', borderRadius: '50%', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
                                        Packaging final proposal...
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#737373', margin: 0 }}>
                                        Combining volumes, generating table of contents, final formatting...
                                    </p>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => window.open(`/api/proposals/view/${jobId}`, '_blank')}
                                        style={{
                                            flex: 1,
                                            backgroundColor: '#16a34a',
                                            color: '#ffffff',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                                    >
                                        <Eye style={{ width: 16, height: 16 }} />
                                        View Proposal
                                    </button>
                                    <button
                                        onClick={() => window.open(`/api/proposals/download/${jobId}`, '_blank')}
                                        style={{
                                            flex: 1,
                                            backgroundColor: '#262626',
                                            color: '#ffffff',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                                    >
                                        <Download style={{ width: 16, height: 16 }} />
                                        Download PDF
                                    </button>
                                </div>
                                <p style={{ fontSize: '12px', color: '#737373', marginTop: '8px', textAlign: 'center', margin: '8px 0 0 0' }}>
                                    Download will be available at 100% completion.
                                </p>
                            </div>
                        )}
                        
                        {/* Final Compliance Report */}
                        {(isComplete || job.status === 'needs_revision') && job.final_compliance_report && (
                            <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Final Compliance Report</h2>
                                    <div style={{
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        backgroundColor: job.final_compliance_report.needsRevision ? '#f59e0b20' : '#22c55e20',
                                        color: job.final_compliance_report.needsRevision ? '#f59e0b' : '#22c55e'
                                    }}>
                                        {job.final_compliance_report.needsRevision ? '⚠ Needs Review' : '✓ Ready'}
                                    </div>
                                </div>
                                
                                {/* Overall Score */}
                                <div style={{ backgroundColor: '#09090b', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '48px', fontWeight: 700, color: job.final_compliance_report.overallComplianceScore >= 75 ? '#4ade80' : '#f59e0b' }}>
                                            {job.final_compliance_report.overallComplianceScore.toFixed(1)}%
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#737373', marginTop: '8px' }}>Overall Compliance Score</div>
                                        <div style={{ fontSize: '12px', color: '#737373', marginTop: '4px', fontStyle: 'italic' }}>
                                            {job.final_compliance_report.recommendation}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Cross-Volume Analysis */}
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>Cross-Volume Analysis</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                        {Object.entries(job.final_compliance_report.crossVolumeAnalysis).map(([key, check]) => (
                                            <div key={key} style={{
                                                backgroundColor: '#09090b',
                                                borderRadius: '8px',
                                                padding: '16px',
                                                border: `1px solid ${check.passed ? '#22c55e40' : '#ef444440'}`
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    {check.passed ? (
                                                        <CheckCircle2 style={{ width: 16, height: 16, color: '#22c55e' }} />
                                                    ) : (
                                                        <X style={{ width: 16, height: 16, color: '#ef4444' }} />
                                                    )}
                                                    <div style={{ fontSize: '12px', fontWeight: 500, color: check.passed ? '#22c55e' : '#ef4444' }}>
                                                        {key.replace(/Check$/, '').replace(/([A-Z])/g, ' $1').trim()}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#737373' }}>{check.details}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Quality Checks */}
                                {job.quality_checks && job.quality_checks.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>Quality Assurance</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {job.quality_checks.map((check, idx) => (
                                                <div key={idx} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px',
                                                    backgroundColor: '#09090b',
                                                    borderRadius: '8px',
                                                    border: `1px solid ${check.passed ? '#22c55e40' : '#ef444440'}`
                                                }}>
                                                    {check.passed ? (
                                                        <CheckCircle2 style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} />
                                                    ) : (
                                                        <X style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
                                                    )}
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', color: '#ffffff' }}>{check.check}</div>
                                                        {check.details && (
                                                            <div style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>{check.details}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Critical Gaps (if any) */}
                                {job.final_compliance_report.allCriticalGaps.length > 0 && (
                                    <div style={{ backgroundColor: '#7f1d1d20', borderRadius: '8px', padding: '16px', border: '1px solid #7f1d1d' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Info style={{ width: 16, height: 16, color: '#ef4444' }} />
                                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444', margin: 0 }}>Critical Gaps Identified</h4>
                                        </div>
                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#fca5a5' }}>
                                            {job.final_compliance_report.allCriticalGaps.slice(0, 5).map((gap, idx) => (
                                                <li key={idx} style={{ marginBottom: '4px' }}>{gap}</li>
                                            ))}
                                            {job.final_compliance_report.allCriticalGaps.length > 5 && (
                                                <li style={{ fontStyle: 'italic' }}>...and {job.final_compliance_report.allCriticalGaps.length - 5} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Completion Summary */}
                        {isComplete && avgScore && (
                            <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <Trophy style={{ width: 24, height: 24, color: '#fbbf24' }} />
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>Excellent Results!</h2>
                                </div>
                                
                                <p style={{ fontSize: '14px', color: '#d4d4d4', marginBottom: '16px', margin: '0 0 16px 0' }}>All volumes completed successfully</p>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ade80' }}>{avgScore}%</div>
                                        <div style={{ fontSize: '12px', color: '#737373' }}>Average Score</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>28 of 28</div>
                                        <div style={{ fontSize: '12px', color: '#737373' }}>Total Sections</div>
                                    </div>
                                </div>
                                
                                <div style={{ paddingTop: '16px', borderTop: '1px solid #262626' }}>
                                    <div style={{ fontSize: '14px', color: '#737373', marginBottom: '8px' }}>Processing Time: 22 minutes</div>
                                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#4ade80' }}>Ready for Submission</div>
                                    <div style={{ fontSize: '12px', color: '#737373', marginTop: '4px' }}>
                                        All compliance requirements met. Proposal ready for final review and submission.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Sidebar - 4 columns */}
                    <div style={{ gridColumn: 'span 12' }}>
                        <div style={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', padding: '32px', position: 'sticky', top: 96 }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '24px', margin: '0 0 24px 0' }}>RFP Information</h2>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>AGENCY NAME</div>
                                    <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500 }}>{job.rfp_metadata?.agency || 'N/A'}</div>
                                </div>
                                
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>SOLICITATION NUMBER</div>
                                    <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' }}>{job.rfp_metadata?.solicitationNum || 'N/A'}</div>
                                </div>
                                
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>SUBMISSION DEADLINE</div>
                                    {job.rfp_metadata?.deadline ? (
                                        <>
                                            <div style={{ fontSize: '14px', color: '#ffffff', marginBottom: '4px' }}>{job.rfp_metadata.deadline}</div>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.5)', borderRadius: '9999px', fontSize: '12px', color: '#f87171', marginTop: '8px' }}>
                                                <Calendar style={{ width: 12, height: 12 }} />
                                                18 days remaining
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '14px', color: '#737373' }}>N/A</div>
                                    )}
                                </div>
                                
                                {job.rfp_metadata?.contractValue && (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>CONTRACT VALUE</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{job.rfp_metadata.contractValue}</div>
                                        <div style={{ fontSize: '12px', color: '#737373', marginTop: '4px' }}>5-year IDIQ</div>
                                    </div>
                                )}
                                
                                {job.rfp_metadata?.naicsCode && (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>NAICS CODE</div>
                                        <div style={{ fontSize: '14px', color: '#ffffff' }}>{job.rfp_metadata.naicsCode}</div>
                                        <div style={{ fontSize: '12px', color: '#737373', marginTop: '4px' }}>Computer Systems Design Services</div>
                                    </div>
                                )}
                                
                                {job.rfp_metadata?.setAside && (
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>SET-ASIDE</div>
                                        <div style={{ display: 'inline-flex', padding: '4px 12px', backgroundColor: 'rgba(37, 99, 235, 0.2)', border: '1px solid rgba(37, 99, 235, 0.5)', borderRadius: '9999px', fontSize: '12px', color: '#60a5fa' }}>
                                            {job.rfp_metadata.setAside}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            {/* Section Progress Modal */}
            {showSectionProgress !== null && job && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    zIndex: 50
                }}>
                    <div style={{
                        backgroundColor: '#171717',
                        borderRadius: '12px',
                        border: '1px solid #262626',
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                    Volume {showSectionProgress}: {VOLUMES.find(v => v.id === showSectionProgress)?.name} - Section Progress
                                </h2>
                                <button 
                                    onClick={() => setShowSectionProgress(null)}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: '#737373',
                                        cursor: 'pointer',
                                        fontSize: '20px',
                                        padding: 0,
                                        transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#737373'}
                                >
                                    <X style={{ width: 20, height: 20 }} />
                                </button>
                            </div>
                            
                            {(() => {
                                const volumeKey = `volume${showSectionProgress}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                const sectionData = job.volume_section_progress?.[volumeKey]?.sections || []
                                const completedSections = sectionData.filter(s => s.status === 'complete').length
                                const totalSections = sectionData.length || 0
                                
                                return (
                                    <>
                                        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '14px', color: '#737373', marginBottom: '8px' }}>
                                                Section Progress
                                            </div>
                                            <div style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff' }}>
                                                {completedSections} of {totalSections} complete
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {sectionData.map((section, idx) => (
                                                <div 
                                                    key={idx}
                                                    style={{
                                                        padding: '16px',
                                                        backgroundColor: '#0f1419',
                                                        borderRadius: '8px',
                                                        border: '1px solid #262626',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                        {section.status === 'complete' ? (
                                                            <CheckCircle2 style={{ width: 20, height: 20, color: '#4ade80', flexShrink: 0 }} />
                                                        ) : section.status === 'in-progress' ? (
                                                            <Loader2 style={{ width: 20, height: 20, color: '#fb923c', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                                                        ) : (
                                                            <Clock style={{ width: 20, height: 20, color: '#737373', flexShrink: 0 }} />
                                                        )}
                                                        <div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>
                                                                {section.name}
                                                            </div>
                                                            {section.status === 'in-progress' && (
                                                                <div style={{ fontSize: '12px', color: '#737373', marginTop: '4px' }}>
                                                                    In progress...
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {section.status === 'complete' && section.timeSeconds !== undefined && (
                                                        <div style={{ fontSize: '12px', color: '#737373', marginLeft: '12px' }}>
                                                            {section.timeSeconds}s
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            
                                            {sectionData.length === 0 && (
                                                <div style={{ textAlign: 'center', padding: '32px', color: '#737373' }}>
                                                    Section progress will appear here as generation begins...
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Volume Review Modal */}
            {selectedVolume !== null && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    zIndex: 50
                }}>
                    <div style={{
                        backgroundColor: '#171717',
                        borderRadius: '12px',
                        border: '1px solid #262626',
                        maxWidth: '672px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                                    Volume {selectedVolume}: {VOLUMES.find(v => v.id === selectedVolume)?.name}
                                </h2>
                                <button 
                                    onClick={() => setSelectedVolume(null)}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: '#737373',
                                        cursor: 'pointer',
                                        fontSize: '20px',
                                        padding: 0,
                                        transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#737373'}
                                >
                                    <X style={{ width: 20, height: 20 }} />
                                </button>
                            </div>
                            
                            {/* Score */}
                            <div style={{
                                backgroundColor: 'rgba(38, 38, 38, 0.5)',
                                borderRadius: '12px',
                                padding: '32px',
                                marginBottom: '24px',
                                textAlign: 'center',
                                border: '1px solid #404040'
                            }}>
                                <div style={{ fontSize: '48px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                                    {job.volume_scores?.[`volume${selectedVolume}`] || 0}%
                                </div>
                                <div style={{ fontSize: '14px', color: '#d4d4d4', marginBottom: '4px' }}>Excellent - Above Target</div>
                                <div style={{ fontSize: '12px', color: '#737373', marginTop: '8px' }}>
                                    Target: 85% | Achieved: +{Math.max(0, (job.volume_scores?.[`volume${selectedVolume}`] || 0) - 85)}% above target
                                </div>
                                <div style={{ fontSize: '12px', color: '#525252', marginTop: '8px' }}>
                                    Iteration {job.volume_iterations?.[`volume${selectedVolume}`] || 1} of 5
                                </div>
                            </div>
                            
                            {/* Compliance Breakdown */}
                            {(() => {
                                const volumeKey = `volume${selectedVolume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                const complianceDetails = job.volume_compliance_details?.[volumeKey]
                                
                                if (!complianceDetails) return null
                                
                                return (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>
                                            Compliance Breakdown
                                        </h3>
                                        
                                        {/* Strengths */}
                                        {complianceDetails.strengths && complianceDetails.strengths.length > 0 && (
                                            <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80', marginBottom: '8px' }}>
                                                    Strengths
                                                </div>
                                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#d4d4d4', fontSize: '13px' }}>
                                                    {complianceDetails.strengths.map((strength, idx) => (
                                                        <li key={idx} style={{ marginBottom: '4px' }}>{strength}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        {/* Critical Gaps */}
                                        {complianceDetails.criticalGaps && complianceDetails.criticalGaps.length > 0 && (
                                            <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f87171', marginBottom: '8px' }}>
                                                    Critical Gaps
                                                </div>
                                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#d4d4d4', fontSize: '13px' }}>
                                                    {complianceDetails.criticalGaps.map((gap, idx) => (
                                                        <li key={idx} style={{ marginBottom: '4px' }}>{gap}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        {/* Requirement Scores */}
                                        {complianceDetails.requirementScores && complianceDetails.requirementScores.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>
                                                    Requirement Scores
                                                </div>
                                                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #262626', borderRadius: '8px' }}>
                                                    {complianceDetails.requirementScores.slice(0, 10).map((req, idx) => (
                                                        <div key={idx} style={{ padding: '12px', borderBottom: idx < complianceDetails.requirementScores!.length - 1 ? '1px solid #262626' : 'none' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                                                                    {req.requirementId}
                                                                </div>
                                                                <div style={{ fontSize: '14px', fontWeight: 700, color: req.score >= 85 ? '#4ade80' : req.score >= 70 ? '#fb923c' : '#f87171' }}>
                                                                    {req.score}%
                                                                </div>
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#737373', marginBottom: '4px' }}>
                                                                {req.requirementText.substring(0, 100)}{req.requirementText.length > 100 ? '...' : ''}
                                                            </div>
                                                            {req.gaps && req.gaps.length > 0 && (
                                                                <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>
                                                                    Gaps: {req.gaps.join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {complianceDetails.requirementScores.length > 10 && (
                                                        <div style={{ padding: '12px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>
                                                            +{complianceDetails.requirementScores.length - 10} more requirements
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                            
                            {/* View/Download buttons - show when volume is ready for review OR approved */}
                            {(() => {
                                const volumeKey = `volume${selectedVolume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                const status = job.volume_status?.[volumeKey]
                                const isAwaitingApproval = status === 'awaiting_approval'
                                const isApproved = status === 'approved' || status === 'complete'
                                
                                // Show view/download for both awaiting approval AND approved volumes
                                if (isAwaitingApproval || isApproved) {
                                    return (
                                        <div style={{ marginBottom: '24px' }}>
                                            <div style={{ display: 'flex', gap: '12px', marginBottom: isAwaitingApproval ? '16px' : '0' }}>
                                                <button
                                                    onClick={() => window.open(`/api/proposals/${jobId}/volume/${selectedVolume}/view`, '_blank')}
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: '#2563eb',
                                                        color: '#ffffff',
                                                        fontWeight: 500,
                                                        padding: '12px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                                >
                                                    <Eye style={{ width: 18, height: 18 }} />
                                                    View Volume
                                                </button>
                                                <button
                                                    onClick={() => window.open(`/api/proposals/${jobId}/volume/${selectedVolume}/download`, '_blank')}
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: '#262626',
                                                        color: '#ffffff',
                                                        fontWeight: 500,
                                                        padding: '12px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                                                >
                                                    <Download style={{ width: 18, height: 18 }} />
                                                    Download
                                                </button>
                                            </div>
                                            {isAwaitingApproval && (
                                                <div style={{ 
                                                    padding: '12px', 
                                                    backgroundColor: 'rgba(249, 115, 22, 0.1)', 
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(249, 115, 22, 0.3)',
                                                    marginTop: '12px'
                                                }}>
                                                    <div style={{ fontSize: '13px', color: '#fb923c', fontWeight: 500 }}>
                                                        📋 Review the volume content above, then approve or request changes below.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                }
                                return null
                            })()}
                            
                            {/* Actions */}
                            {(() => {
                                const volumeKey = `volume${selectedVolume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                const status = job.volume_status?.[volumeKey]
                                const isApproved = status === 'approved' || status === 'complete'
                                
                                if (!isApproved) {
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <button
                                                onClick={() => handleApprove(selectedVolume)}
                                                style={{
                                                    width: '100%',
                                                    backgroundColor: '#16a34a',
                                                    color: '#ffffff',
                                                    fontWeight: 500,
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                                            >
                                                <CheckCircle2 style={{ width: 20, height: 20 }} />
                                                Approve Volume
                                            </button>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#d4d4d4' }}>
                                            Request Changes (Optional)
                                        </label>
                                        {(() => {
                                            const volumeKey = `volume${selectedVolume}` as 'volume1' | 'volume2' | 'volume3' | 'volume4'
                                            const complianceDetails = job.volume_compliance_details?.[volumeKey]
                                            const hasIssues = complianceDetails && (
                                                complianceDetails.overallScore < 95 ||
                                                (complianceDetails.criticalGaps && complianceDetails.criticalGaps.length > 0) ||
                                                (complianceDetails.requirementScores && complianceDetails.requirementScores.some(req => 
                                                    req.score < 95 || (req.gaps && req.gaps.length > 0)
                                                ))
                                            )
                                            
                                            if (hasIssues) {
                                                return (
                                                    <button
                                                        onClick={() => handleAutoFixCompliance(selectedVolume)}
                                                        style={{
                                                            backgroundColor: '#7c3aed',
                                                            color: '#ffffff',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'background-color 0.2s',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#6d28d9'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                                                        title="Auto-generate feedback from compliance findings"
                                                    >
                                                        🤖 Auto-Fix Gaps
                                                    </button>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                    <textarea
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            backgroundColor: '#262626',
                                            border: '1px solid #404040',
                                            borderRadius: '8px',
                                            resize: 'none',
                                            color: '#ffffff',
                                            fontSize: '14px',
                                            fontFamily: 'inherit',
                                            outline: 'none'
                                        }}
                                        rows={4}
                                        placeholder="Provide feedback for improvements..."
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = '#f97316'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = '#404040'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                    <button
                                        onClick={() => handleIterate(selectedVolume)}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#ea580c',
                                            color: '#ffffff',
                                            fontWeight: 500,
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c2410c'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
                                    >
                                        Request Iteration
                                    </button>
                                </div>
                            </div>
                        )
                    }
                    return null
                })()}
                        </div>
                    </div>
                </div>
            )}
            </div>
        </>
    )
}
