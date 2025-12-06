'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProposalJob } from '@/lib/database.types'
import DocumentChat, { ChatToggleButton } from '@/components/DocumentChat'

interface StepInfo {
    name: string
    key: string
    estimatedSeconds: number
    icon: string
}

const GENERATION_STEPS: StepInfo[] = [
    { name: 'Analyzing RFP', key: 'RFP Analysis', estimatedSeconds: 30, icon: '📄' },
    { name: 'Loading Company Data', key: 'Company Data', estimatedSeconds: 5, icon: '🏢' },
    { name: 'Executive Summary', key: 'Executive Summary', estimatedSeconds: 60, icon: '📋' },
    { name: 'Technical Approach', key: 'Technical Approach', estimatedSeconds: 90, icon: '⚙️' },
    { name: 'Management Approach', key: 'Management Approach', estimatedSeconds: 60, icon: '👥' },
    { name: 'Past Performance', key: 'Past Performance', estimatedSeconds: 60, icon: '📊' },
    { name: 'Pricing Summary', key: 'Pricing', estimatedSeconds: 45, icon: '💰' },
    { name: 'Compliance Matrix', key: 'Compliance Matrix', estimatedSeconds: 45, icon: '✅' },
    { name: 'Key Personnel Resumes', key: 'Key Personnel', estimatedSeconds: 60, icon: '👤' },
    { name: 'Appendices', key: 'Appendices', estimatedSeconds: 45, icon: '📎' },
    { name: 'Final Assembly', key: 'Final Assembly', estimatedSeconds: 5, icon: '📦' },
]

export default function ProgressPage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params.jobId as string

    const [job, setJob] = useState<ProposalJob | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)
    const [startTime] = useState(Date.now())
    const [elapsedTime, setElapsedTime] = useState(0)
    
    // Editable document state
    const [editedHtml, setEditedHtml] = useState<string | null>(null)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
        return () => clearInterval(timer)
    }, [startTime])

    useEffect(() => {
        if (!jobId) return

        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/proposals/status/${jobId}`)
                if (!res.ok) throw new Error('Failed to fetch status')
                const data = await res.json()
                setJob(data)
                
                // Initialize edited HTML when job completes
                if (data.status === 'completed' && data.final_html && !editedHtml) {
                    setEditedHtml(data.final_html)
                }
            } catch (err) {
                setError('Failed to load proposal status')
                console.error(err)
            }
        }

        fetchStatus()
        const interval = setInterval(() => {
            if (job?.status !== 'completed' && job?.status !== 'failed') {
                fetchStatus()
            }
        }, 1500)

        return () => clearInterval(interval)
    }, [jobId, job?.status, editedHtml])

    const handleCancel = async () => {
        if (!window.confirm('Cancel this proposal generation?')) return
        setIsCancelling(true)
        try {
            await fetch(`/api/proposals/cancel/${jobId}`, { method: 'POST' })
            const res = await fetch(`/api/proposals/status/${jobId}`)
            setJob(await res.json())
        } catch (err) {
            console.error(err)
        } finally {
            setIsCancelling(false)
        }
    }

    const handleHtmlUpdate = (newHtml: string) => {
        setEditedHtml(newHtml)
        setHasUnsavedChanges(true)
    }

    const handleSave = async () => {
        if (!editedHtml) return
        
        const response = await fetch(`/api/proposals/edit/${jobId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: editedHtml }),
        })
        
        if (response.ok) {
            setHasUnsavedChanges(false)
            if (job) {
                setJob({ ...job, final_html: editedHtml })
            }
        } else {
            throw new Error('Failed to save')
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    }

    const getStepStatus = (stepKey: string): 'pending' | 'in_progress' | 'completed' => {
        if (!job) return 'pending'
        if (job.sections_completed?.includes(stepKey)) return 'completed'
        if (job.current_step?.toLowerCase().includes(stepKey.toLowerCase())) return 'in_progress'
        return 'pending'
    }

    const getCompletedCount = () => job?.sections_completed?.length || 0
    const getTotalSteps = () => GENERATION_STEPS.length

    const calculateTimeRemaining = () => {
        const completedCount = getCompletedCount()
        return GENERATION_STEPS.slice(completedCount).reduce((t, s) => t + s.estimatedSeconds, 0)
    }

    const isComplete = job?.status === 'completed'
    const isFailed = job?.status === 'failed'
    const displayHtml = editedHtml || job?.final_html

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', padding: 32 }}>
                <div style={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: 16, padding: 32, maxWidth: 400, textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.2)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 32 }}>❌</span>
                    </div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 8 }}>Error</h2>
                    <p style={{ color: '#9ca3af' }}>{error}</p>
                </div>
            </div>
        )
    }

    if (!job) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'white' }}>
                    <span style={{ width: 32, height: 32, border: '4px solid rgba(249, 115, 22, 0.3)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 20 }}>Loading...</span>
                </div>
                <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* LEFT SIDE - Progress or Document Preview */}
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1a1a1a', backgroundColor: '#0a0a0a' }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isComplete ? '#22c55e' : isFailed ? '#ef4444' : '#f97316',
                            boxShadow: isComplete ? '0 0 16px rgba(34, 197, 94, 0.4)' : isFailed ? '0 0 16px rgba(239, 68, 68, 0.4)' : '0 0 16px rgba(249, 115, 22, 0.4)'
                        }}>
                            <span style={{ fontSize: 16 }}>{isComplete ? '✓' : isFailed ? '✕' : '⚡'}</span>
                        </div>
                        <div>
                            <h1 style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
                                {isComplete ? 'Document Preview' : isFailed ? 'Generation Failed' : 'Generating Proposal'}
                            </h1>
                            <p style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{jobId.slice(0, 8)}...</p>
                        </div>
                    </div>
                    
                    {/* Unsaved indicator */}
                    {hasUnsavedChanges && (
                        <div style={{ 
                            padding: '4px 10px', 
                            backgroundColor: 'rgba(249, 115, 22, 0.15)', 
                            border: '1px solid rgba(249, 115, 22, 0.3)',
                            borderRadius: 6,
                            fontSize: 11,
                            color: '#f97316',
                            fontWeight: 500,
                        }}>
                            Unsaved changes
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!isComplete && !isFailed ? (
                        /* Progress View */
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                            {/* Circular Progress */}
                            <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 40 }}>
                                <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                    <circle cx="110" cy="110" r="95" stroke="#1a1a1a" strokeWidth="12" fill="none" />
                                    <circle 
                                        cx="110" cy="110" r="95" 
                                        stroke="url(#progressGradient)" 
                                        strokeWidth="12" 
                                        fill="none"
                                        strokeDasharray={2 * Math.PI * 95}
                                        strokeDashoffset={2 * Math.PI * 95 * (1 - (job.progress_percent || 0) / 100)}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                                    />
                                    <defs>
                                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#f97316" />
                                            <stop offset="100%" stopColor="#ea580c" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontSize: 48, fontWeight: 700, color: 'white', lineHeight: 1 }}>{job.progress_percent || 0}%</div>
                                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Complete</div>
                                </div>
                            </div>

                            {/* Time Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 600, color: '#f97316' }}>{formatTime(elapsedTime)}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Elapsed</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 600, color: '#9ca3af' }}>~{formatTime(calculateTimeRemaining())}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Remaining</div>
                                </div>
                            </div>

                            {/* Current Step */}
                            <div style={{ 
                                padding: '14px 20px', 
                                backgroundColor: '#141414', 
                                border: '1px solid #262626', 
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <span style={{ width: 18, height: 18, border: '2px solid rgba(249, 115, 22, 0.3)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <span style={{ color: '#e5e5e5', fontSize: 13 }}>{job.current_step}</span>
                            </div>
                        </div>
                    ) : isComplete && displayHtml ? (
                        /* Document Preview */
                        <div style={{ 
                            flex: 1, 
                            backgroundColor: '#1a1a1a', 
                            padding: 12,
                            display: 'flex',
                            overflow: 'hidden',
                        }}>
                            <iframe
                                srcDoc={displayHtml}
                                style={{
                                    flex: 1,
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    backgroundColor: 'white',
                                    borderRadius: 6,
                                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
                                }}
                                title="Proposal Preview"
                            />
                        </div>
                    ) : isFailed ? (
                        /* Error View */
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                            <div style={{ width: 100, height: 100, borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 48 }}>✕</span>
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>Generation Failed</h2>
                            <p style={{ fontSize: 13, color: '#9ca3af', maxWidth: 300, textAlign: 'center' }}>{job.current_step}</p>
                        </div>
                    ) : null}
                </div>

                {/* Footer with metadata and actions */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {job.rfp_metadata && (
                            <>
                                <span style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, backgroundColor: '#1a1a1a', color: '#9ca3af', borderRadius: 6, border: '1px solid #262626' }}>
                                    {job.rfp_metadata.agency}
                                </span>
                                <span style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316', borderRadius: 6, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                                    {job.rfp_metadata.solicitationNum}
                                </span>
                            </>
                        )}
                    </div>
                    
                    {isComplete && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => {
                                    if (displayHtml) {
                                        const blob = new Blob([displayHtml], { type: 'text/html' })
                                        const url = URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = `proposal-${jobId.slice(0, 8)}.html`
                                        a.click()
                                        URL.revokeObjectURL(url)
                                    }
                                }}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: '#9ca3af',
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #262626',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                📥 HTML
                            </button>
                            <button
                                onClick={() => window.open(`/api/proposals/download/${jobId}`, '_blank')}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'white',
                                    backgroundColor: '#ea580c',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                📄 PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE - Step-by-Step Progress / Summary */}
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', backgroundColor: '#0f0f0f' }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a1a1a', border: '1px solid #262626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 16 }}>{isComplete ? '✅' : '📋'}</span>
                    </div>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
                            {isComplete ? 'Generation Complete' : 'Step-by-Step Progress'}
                        </h2>
                        <p style={{ fontSize: 11, color: '#6b7280' }}>
                            {getCompletedCount()} of {getTotalSteps()} steps completed
                        </p>
                    </div>
                </div>

                {/* Steps List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {GENERATION_STEPS.map((step, index) => {
                            const status = getStepStatus(step.key)
                            const isActive = status === 'in_progress'
                            const isDone = status === 'completed'

                            return (
                                <div
                                    key={step.key}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        padding: 14,
                                        borderRadius: 10,
                                        backgroundColor: isDone ? 'rgba(34, 197, 94, 0.08)' : isActive ? 'rgba(249, 115, 22, 0.08)' : '#141414',
                                        border: `1px solid ${isDone ? 'rgba(34, 197, 94, 0.2)' : isActive ? 'rgba(249, 115, 22, 0.2)' : '#222'}`,
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isDone ? '#22c55e' : isActive ? '#f97316' : '#262626',
                                        fontSize: 16,
                                        flexShrink: 0,
                                    }}>
                                        {isDone ? '✓' : isActive ? (
                                            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <span style={{ fontSize: 12, color: '#6b7280' }}>{index + 1}</span>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <p style={{ 
                                            fontSize: 13, 
                                            fontWeight: 500, 
                                            color: isDone ? '#4ade80' : isActive ? '#fb923c' : '#9ca3af',
                                            marginBottom: 2
                                        }}>
                                            {step.name}
                                        </p>
                                        <p style={{ fontSize: 11, color: '#4b5563' }}>
                                            {isDone ? 'Completed' : isActive ? 'In progress...' : `~${step.estimatedSeconds}s`}
                                        </p>
                                    </div>

                                    <div style={{
                                        padding: '3px 8px',
                                        borderRadius: 5,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        backgroundColor: isDone ? 'rgba(34, 197, 94, 0.15)' : isActive ? 'rgba(249, 115, 22, 0.15)' : '#1a1a1a',
                                        color: isDone ? '#4ade80' : isActive ? '#fb923c' : '#6b7280',
                                    }}>
                                        {isDone ? 'Done' : isActive ? 'Active' : 'Pending'}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Summary on Complete */}
                    {isComplete && job.rfp_metadata && (
                        <div style={{ marginTop: 24, padding: 20, backgroundColor: '#141414', border: '1px solid #222', borderRadius: 12 }}>
                            <h3 style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Proposal Summary
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Agency</p>
                                    <p style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{job.rfp_metadata.agency}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>RFP Number</p>
                                    <p style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{job.rfp_metadata.solicitationNum}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Total Pages</p>
                                    <p style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>~{job.rfp_metadata.totalPages || '100+'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Generation Time</p>
                                    <p style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{formatTime(elapsedTime)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{ flexShrink: 0, padding: 20, borderTop: '1px solid #1a1a1a' }}>
                    {!isComplete && !isFailed ? (
                        <button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 500,
                                color: '#f87171',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                cursor: isCancelling ? 'not-allowed' : 'pointer',
                                opacity: isCancelling ? 0.5 : 1,
                            }}
                        >
                            {isCancelling ? 'Cancelling...' : 'Cancel Generation'}
                        </button>
                    ) : isComplete ? (
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                            }}
                        >
                            ← Create New Proposal
                        </button>
                    ) : (
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #262626',
                                cursor: 'pointer',
                            }}
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>

            {/* Floating AI Chat (only when complete) */}
            {isComplete && displayHtml && (
                <>
                    {!isChatOpen && (
                        <ChatToggleButton 
                            onClick={() => setIsChatOpen(true)} 
                            hasUnsavedChanges={hasUnsavedChanges}
                        />
                    )}
                    <DocumentChat
                        jobId={jobId}
                        currentHtml={displayHtml}
                        onHtmlUpdate={handleHtmlUpdate}
                        onSave={handleSave}
                        hasUnsavedChanges={hasUnsavedChanges}
                        isOpen={isChatOpen}
                        onClose={() => setIsChatOpen(false)}
                    />
                </>
            )}

            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
