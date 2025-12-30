'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SeedResult {
    success: boolean
    companyId?: string
    intakeId?: string
    message?: string
    error?: string
    links?: {
        intake: string
        company: string
    }
}

interface VerifyResult {
    success: boolean
    summary?: {
        companyId: string
        companyName: string
        isComplete: boolean
        counts: {
            pastPerformance: number
            personnel: number
            laborRates: number
        }
    }
    verification?: {
        company: { found: boolean; data: unknown; error?: string }
        pastPerformance: { count: number; data: unknown; error?: string }
        personnel: { count: number; data: unknown; error?: string }
        laborRates: { count: number; data: unknown; error?: string }
        clientIntake: { found: boolean; data: unknown; error?: string }
    }
    error?: string
}

export default function TestPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [seedResult, setSeedResult] = useState<SeedResult | null>(null)
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)

    const handleSeedCompany = async () => {
        setIsLoading(true)
        setSeedResult(null)
        setVerifyResult(null)

        try {
            const response = await fetch('/api/test/seed-company', {
                method: 'POST',
            })
            const data = await response.json()
            setSeedResult(data)
            
            if (data.success && data.companyId) {
                setActiveCompanyId(data.companyId)
            }
        } catch (error) {
            setSeedResult({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to seed company',
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyData = async () => {
        if (!activeCompanyId) return

        setIsLoading(true)
        setVerifyResult(null)

        try {
            const response = await fetch(`/api/test/verify-data?companyId=${activeCompanyId}`)
            const data = await response.json()
            setVerifyResult(data)
        } catch (error) {
            setVerifyResult({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to verify data',
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteCompany = async () => {
        if (!activeCompanyId) return

        setIsLoading(true)

        try {
            const response = await fetch(`/api/test/seed-company?companyId=${activeCompanyId}`, {
                method: 'DELETE',
            })
            const data = await response.json()
            
            if (data.success) {
                setSeedResult(null)
                setVerifyResult(null)
                setActiveCompanyId(null)
            }
        } catch (error) {
            console.error('Delete failed:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoToIntake = () => {
        if (activeCompanyId) {
            router.push(`/intake/${activeCompanyId}`)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0a0a0a',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '32px',
        }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', color: '#e5e5e5' }}>
                        🧪 Test Data Seeder
                    </h1>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                        Create a test company with complete intake data to test the full proposal pipeline
                    </p>
                </div>

                {/* Action Buttons */}
                <div style={{
                    padding: '24px',
                    backgroundColor: '#0f0f0f',
                    border: '1px solid #1a1a1a',
                    borderRadius: '12px',
                    marginBottom: '24px',
                }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', color: '#e5e5e5' }}>
                        Actions
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleSeedCompany}
                            disabled={isLoading}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#16a34a',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.6 : 1,
                            }}
                        >
                            {isLoading ? '⏳ Creating...' : '🌱 Create Test Company'}
                        </button>

                        <button
                            onClick={handleVerifyData}
                            disabled={isLoading || !activeCompanyId}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#2563eb',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                cursor: isLoading || !activeCompanyId ? 'not-allowed' : 'pointer',
                                opacity: isLoading || !activeCompanyId ? 0.6 : 1,
                            }}
                        >
                            🔍 Verify Database
                        </button>

                        <button
                            onClick={handleGoToIntake}
                            disabled={!activeCompanyId}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#ea580c',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                cursor: !activeCompanyId ? 'not-allowed' : 'pointer',
                                opacity: !activeCompanyId ? 0.6 : 1,
                            }}
                        >
                            📝 Go to Intake Form
                        </button>

                        <button
                            onClick={handleDeleteCompany}
                            disabled={isLoading || !activeCompanyId}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#dc2626',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: 'white',
                                cursor: isLoading || !activeCompanyId ? 'not-allowed' : 'pointer',
                                opacity: isLoading || !activeCompanyId ? 0.6 : 1,
                            }}
                        >
                            🗑️ Delete Test Company
                        </button>
                    </div>
                </div>

                {/* Seed Result */}
                {seedResult && (
                    <div style={{
                        padding: '24px',
                        backgroundColor: seedResult.success ? '#052e16' : '#450a0a',
                        border: `1px solid ${seedResult.success ? '#166534' : '#991b1b'}`,
                        borderRadius: '12px',
                        marginBottom: '24px',
                    }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            margin: '0 0 12px 0',
                            color: seedResult.success ? '#86efac' : '#fca5a5',
                        }}>
                            {seedResult.success ? '✅ Company Created!' : '❌ Creation Failed'}
                        </h3>
                        
                        {seedResult.success ? (
                            <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                                <p style={{ margin: '0 0 8px 0' }}>
                                    <strong>Company ID:</strong> <code style={{ color: '#22c55e' }}>{seedResult.companyId}</code>
                                </p>
                                <p style={{ margin: '0 0 8px 0' }}>
                                    <strong>Intake ID:</strong> <code style={{ color: '#22c55e' }}>{seedResult.intakeId}</code>
                                </p>
                                <p style={{ margin: 0 }}>{seedResult.message}</p>
                            </div>
                        ) : (
                            <p style={{ fontSize: '14px', color: '#fca5a5', margin: 0 }}>
                                {seedResult.error}
                            </p>
                        )}
                    </div>
                )}

                {/* Verify Result */}
                {verifyResult && (
                    <div style={{
                        padding: '24px',
                        backgroundColor: '#0f0f0f',
                        border: '1px solid #1a1a1a',
                        borderRadius: '12px',
                        marginBottom: '24px',
                    }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', color: '#e5e5e5' }}>
                            📊 Database Verification
                        </h3>
                        
                        {verifyResult.success && verifyResult.summary ? (
                            <>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '16px',
                                    marginBottom: '24px',
                                }}>
                                    <StatCard
                                        label="Company"
                                        value={verifyResult.verification?.company.found ? '✓' : '✗'}
                                        status={verifyResult.verification?.company.found}
                                    />
                                    <StatCard
                                        label="Past Performance"
                                        value={String(verifyResult.summary.counts.pastPerformance)}
                                        status={verifyResult.summary.counts.pastPerformance >= 3}
                                        target="3+"
                                    />
                                    <StatCard
                                        label="Personnel"
                                        value={String(verifyResult.summary.counts.personnel)}
                                        status={verifyResult.summary.counts.personnel >= 4}
                                        target="4+"
                                    />
                                    <StatCard
                                        label="Labor Rates"
                                        value={String(verifyResult.summary.counts.laborRates)}
                                        status={verifyResult.summary.counts.laborRates >= 1}
                                        target="1+"
                                    />
                                </div>

                                <div style={{
                                    padding: '16px',
                                    backgroundColor: verifyResult.summary.isComplete ? '#052e16' : '#422006',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                }}>
                                    <p style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: verifyResult.summary.isComplete ? '#86efac' : '#fcd34d',
                                        margin: 0,
                                    }}>
                                        {verifyResult.summary.isComplete
                                            ? '✅ All data saved correctly! Ready for testing.'
                                            : '⚠️ Some data may be missing. Check the counts above.'}
                                    </p>
                                </div>

                                {/* Raw Data Toggle */}
                                <details style={{ marginTop: '16px' }}>
                                    <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '13px' }}>
                                        View raw verification data
                                    </summary>
                                    <pre style={{
                                        marginTop: '12px',
                                        padding: '16px',
                                        backgroundColor: '#141414',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        color: '#9ca3af',
                                        overflow: 'auto',
                                        maxHeight: '400px',
                                    }}>
                                        {JSON.stringify(verifyResult.verification, null, 2)}
                                    </pre>
                                </details>
                            </>
                        ) : (
                            <p style={{ fontSize: '14px', color: '#ef4444', margin: 0 }}>
                                {verifyResult.error}
                            </p>
                        )}
                    </div>
                )}

                {/* Test Company Info */}
                <div style={{
                    padding: '24px',
                    backgroundColor: '#0f0f0f',
                    border: '1px solid #1a1a1a',
                    borderRadius: '12px',
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', color: '#e5e5e5' }}>
                        🏢 Test Company Details
                    </h3>
                    <div style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.8 }}>
                        <p><strong>Name:</strong> CloudSecure Federal Solutions, LLC</p>
                        <p><strong>Business Type:</strong> 8(a), SDVOSB</p>
                        <p><strong>Employees:</strong> 85</p>
                        <p><strong>Revenue:</strong> $18.5M</p>
                        <p><strong>Clearance:</strong> FCL Secret</p>
                        <p><strong>CMMC Level:</strong> Level 2</p>
                        <p><strong>Past Performance:</strong> 4 contracts (DoD, VA, DHS, Army)</p>
                        <p><strong>Key Personnel:</strong> 6 people with clearances</p>
                        <p><strong>Labor Categories:</strong> 10 rate categories</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface StatCardProps {
    label: string
    value: string
    status?: boolean
    target?: string
}

const StatCard: React.FC<StatCardProps> = ({ label, value, status, target }) => (
    <div style={{
        padding: '16px',
        backgroundColor: '#141414',
        borderRadius: '8px',
        textAlign: 'center',
        border: `1px solid ${status ? '#166534' : '#991b1b'}`,
    }}>
        <p style={{ fontSize: '24px', fontWeight: 700, color: status ? '#22c55e' : '#ef4444', margin: '0 0 4px 0' }}>
            {value}
        </p>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
            {label} {target && <span style={{ color: '#4b5563' }}>({target})</span>}
        </p>
    </div>
)












