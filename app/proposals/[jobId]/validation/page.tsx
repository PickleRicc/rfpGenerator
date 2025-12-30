'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ValidationReport, ValidationReportItem } from '@/lib/database.types'

interface ProposalJobData {
    job_id: string
    company_id: string
    validation_status: string
    validation_report: ValidationReport | null
    rfp_metadata: {
        agency?: string
        solicitationNum?: string
    } | null
}

export default function ValidationPage() {
    const params = useParams()
    const router = useRouter()
    const jobId = params.jobId as string

    const [jobData, setJobData] = useState<ProposalJobData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [ignoredWarnings, setIgnoredWarnings] = useState<Set<string>>(new Set())
    const [isProceeding, setIsProceeding] = useState(false)

    useEffect(() => {
        const fetchJobData = async () => {
            try {
                const response = await fetch(`/api/proposals/status/${jobId}`)
                const data = await response.json()
                setJobData(data)
            } catch (error) {
                console.error('Failed to fetch job data:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchJobData()
    }, [jobId])

    const handleIgnoreWarning = (field: string) => {
        setIgnoredWarnings(prev => new Set([...prev, field]))
    }

    const handleProceed = async () => {
        setIsProceeding(true)
        try {
            // Trigger Agent 3 to continue the pipeline
            await fetch(`/api/proposals/${jobId}/proceed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ignoredWarnings: Array.from(ignoredWarnings) }),
            })
            router.push(`/progress/${jobId}`)
        } catch (error) {
            console.error('Failed to proceed:', error)
            setIsProceeding(false)
        }
    }

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
            }}>
                Loading validation report...
            </div>
        )
    }

    if (!jobData?.validation_report) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
            }}>
                No validation report available
            </div>
        )
    }

    const { validation_report: report } = jobData
    const hasBlockers = report.blockers.length > 0
    const activeWarnings = report.warnings.filter(w => !ignoredWarnings.has(w.field))

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0a0a0a',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* Header */}
            <div style={{
                borderBottom: '1px solid #1a1a1a',
                padding: '20px 32px',
            }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => router.back()}
                            style={{
                                padding: '8px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#6b7280',
                            }}
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div>
                            <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: '#e5e5e5' }}>
                                Data Validation Report
                            </h1>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
                                {jobData.rfp_metadata?.solicitationNum || 'Unknown RFP'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px' }}>
                {/* Status banner */}
                <div style={{
                    padding: '20px 24px',
                    backgroundColor: hasBlockers ? '#450a0a' : activeWarnings.length > 0 ? '#422006' : '#052e16',
                    border: `1px solid ${hasBlockers ? '#991b1b' : activeWarnings.length > 0 ? '#854d0e' : '#166534'}`,
                    borderRadius: '12px',
                    marginBottom: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: hasBlockers ? '#7f1d1d' : activeWarnings.length > 0 ? '#713f12' : '#14532d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {hasBlockers ? (
                            <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        ) : activeWarnings.length > 0 ? (
                            <svg width="24" height="24" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h2 style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            margin: 0,
                            color: hasBlockers ? '#fca5a5' : activeWarnings.length > 0 ? '#fcd34d' : '#86efac',
                        }}>
                            {hasBlockers
                                ? 'Validation Failed - Action Required'
                                : activeWarnings.length > 0
                                    ? 'Validation Passed with Warnings'
                                    : 'Validation Passed'}
                        </h2>
                        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '4px 0 0 0' }}>
                            {hasBlockers
                                ? `${report.blockers.length} blocking issues must be fixed before proceeding`
                                : activeWarnings.length > 0
                                    ? `${activeWarnings.length} warnings to review`
                                    : 'All validation checks passed'}
                        </p>
                    </div>
                </div>

                {/* Blockers section */}
                {report.blockers.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#ef4444',
                            margin: '0 0 16px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Blockers ({report.blockers.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {report.blockers.map((item, index) => (
                                <ValidationItem
                                    key={index}
                                    item={item}
                                    type="blocker"
                                    companyId={jobData.company_id}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Warnings section */}
                {report.warnings.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#f59e0b',
                            margin: '0 0 16px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Warnings ({report.warnings.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {report.warnings.map((item, index) => (
                                <ValidationItem
                                    key={index}
                                    item={item}
                                    type="warning"
                                    companyId={jobData.company_id}
                                    isIgnored={ignoredWarnings.has(item.field)}
                                    onIgnore={() => handleIgnoreWarning(item.field)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommendations section */}
                {report.recommendations.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#22c55e',
                            margin: '0 0 16px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Recommendations ({report.recommendations.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {report.recommendations.map((item, index) => (
                                <ValidationItem
                                    key={index}
                                    item={item}
                                    type="recommendation"
                                    companyId={jobData.company_id}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '16px',
                    paddingTop: '24px',
                    borderTop: '1px solid #1a1a1a',
                }}>
                    {hasBlockers ? (
                        <button
                            onClick={() => router.push(`/intake/${jobData.company_id}`)}
                            style={{
                                padding: '14px 28px',
                                backgroundColor: '#ea580c',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            Fix Issues in Intake Form
                        </button>
                    ) : (
                        <button
                            onClick={handleProceed}
                            disabled={isProceeding}
                            style={{
                                padding: '14px 28px',
                                backgroundColor: '#16a34a',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                cursor: isProceeding ? 'not-allowed' : 'pointer',
                                opacity: isProceeding ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            {isProceeding ? (
                                <>
                                    <span style={{
                                        width: 16,
                                        height: 16,
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }} />
                                    Proceeding...
                                </>
                            ) : (
                                <>
                                    Proceed to Content Generation
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

interface ValidationItemProps {
    item: ValidationReportItem
    type: 'blocker' | 'warning' | 'recommendation'
    companyId: string
    isIgnored?: boolean
    onIgnore?: () => void
}

const ValidationItem: React.FC<ValidationItemProps> = ({
    item,
    type,
    companyId,
    isIgnored = false,
    onIgnore,
}) => {
    const router = useRouter()

    const colors = {
        blocker: { bg: '#1c1917', border: '#991b1b', icon: '#ef4444' },
        warning: { bg: '#1c1917', border: '#854d0e', icon: '#f59e0b' },
        recommendation: { bg: '#1c1917', border: '#166534', icon: '#22c55e' },
    }

    const handleFix = () => {
        if (item.fix_path) {
            router.push(item.fix_path)
        } else {
            router.push(`/intake/${companyId}`)
        }
    }

    return (
        <div style={{
            padding: '16px 20px',
            backgroundColor: isIgnored ? '#0a0a0a' : colors[type].bg,
            border: `1px solid ${isIgnored ? '#262626' : colors[type].border}`,
            borderRadius: '8px',
            opacity: isIgnored ? 0.5 : 1,
            transition: 'all 0.2s ease',
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: colors[type].icon,
                        marginTop: '6px',
                        flexShrink: 0,
                    }} />
                    <div>
                        <p style={{
                            fontSize: '14px',
                            color: '#e5e5e5',
                            margin: 0,
                            textDecoration: isIgnored ? 'line-through' : 'none',
                        }}>
                            {item.message}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                            Field: {item.field}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {type === 'warning' && !isIgnored && onIgnore && (
                        <button
                            onClick={onIgnore}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: 'transparent',
                                border: '1px solid #4b5563',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#9ca3af',
                                cursor: 'pointer',
                            }}
                        >
                            Ignore
                        </button>
                    )}
                    {type !== 'recommendation' && !isIgnored && (
                        <button
                            onClick={handleFix}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: colors[type].icon,
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            Fix
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}













