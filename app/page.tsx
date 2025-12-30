'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadDropzone, { PdfData } from '@/components/UploadDropzone'
import { Company } from '@/lib/database.types'

export default function HomePage() {
    const router = useRouter()
    const [pdfData, setPdfData] = useState<PdfData | null>(null)
    const [companies, setCompanies] = useState<Company[]>([])
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
    const [email, setEmail] = useState<string>('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [loadingCompanies, setLoadingCompanies] = useState(true)

    React.useEffect(() => {
        async function fetchCompanies() {
            try {
                const res = await fetch('/api/companies')
                const data = await res.json()
                // Ensure we only set an array
                if (Array.isArray(data)) {
                    setCompanies(data)
                } else {
                    console.error('Companies API did not return an array:', data)
                    setCompanies([])
                }
            } catch (error) {
                console.error('Error fetching companies:', error)
                setCompanies([])
            } finally {
                setLoadingCompanies(false)
            }
        }
        fetchCompanies()
    }, [])

    const handleSubmit = async () => {
        if (!pdfData || !selectedCompanyId) return

        setIsSubmitting(true)
        try {
            const response = await fetch('/api/proposals/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rfp_text: pdfData.text,
                    company_id: selectedCompanyId,
                    email: email || undefined,
                }),
            })

            if (!response.ok) throw new Error('Failed to create proposal job')

            const { job_id } = await response.json()
            router.push(`/progress/${job_id}`)
        } catch (error) {
            console.error('Error creating proposal:', error)
            alert('Failed to start proposal generation. Please try again.')
            setIsSubmitting(false)
        }
    }

    const canSubmit = pdfData && selectedCompanyId && !isSubmitting

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* LEFT SIDE - Upload Area */}
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', position: 'relative', borderRight: '1px solid #1a1a1a' }}>
                {/* Breadcrumb */}
                <div style={{ position: 'absolute', top: 32, left: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#161616', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
                        <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>RFP Generator</span>
                    <span style={{ color: '#374151' }}>/</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>New Proposal</span>
                </div>

                {/* Centered Dropzone */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                    <UploadDropzone onPdfExtracted={setPdfData} />
                    
                    <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 16, opacity: 0.5 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: 'monospace', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.5)' }}></span>
                            Encrypted
                        </span>
                        <span style={{ width: 1, height: 12, backgroundColor: '#374151' }}></span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            PDF 2.0+
                        </span>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE - Configuration Panel */}
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', backgroundColor: '#0f0f0f' }}>
                {/* Scrollable Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '80px 48px 48px 48px' }}>
                    <div style={{ maxWidth: 520, margin: '0 auto' }}>
                        
                        {/* Icon */}
                        <div style={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: 12, 
                            backgroundColor: '#1a1a1a', 
                            border: '1px solid #2a2a2a', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: '#f97316',
                            marginBottom: 32
                        }}>
                            <svg style={{ width: 24, height: 24 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'white', marginBottom: 16, letterSpacing: '-0.02em' }}>
                            Configure Proposal
                        </h1>
                        
                        {/* Description */}
                        <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 48 }}>
                            Customize your generation settings. We'll analyze the uploaded RFP and map requirements to your company's capabilities.
                        </p>

                        {/* Company Select Field */}
                        <div style={{ marginBottom: 40 }}>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#9ca3af', marginBottom: 12 }}>
                                Company Profile
                            </label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={selectedCompanyId}
                                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                                    disabled={loadingCompanies || companies.length === 0}
                                    style={{
                                        width: '100%',
                                        height: 56,
                                        paddingLeft: 20,
                                        paddingRight: 48,
                                        backgroundColor: '#141414',
                                        border: '1px solid #262626',
                                        borderRadius: 12,
                                        fontSize: 15,
                                        color: '#e5e5e5',
                                        outline: 'none',
                                        appearance: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <option value="">
                                        {loadingCompanies 
                                            ? 'Loading companies...' 
                                            : companies.length === 0 
                                                ? 'No companies found - create one first'
                                                : 'Select a company profile...'}
                                    </option>
                                    {companies.map((company) => (
                                        <option key={company.id} value={company.id}>
                                            {company.name}
                                        </option>
                                    ))}
                                </select>
                                <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }}>
                                    <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            <p style={{ fontSize: 12, color: '#4b5563', marginTop: 12 }}>
                                The legal entity submitting this proposal.
                            </p>
                        </div>

                        {/* Email Field */}
                        <div style={{ marginBottom: 40 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <label style={{ fontSize: 14, fontWeight: 500, color: '#9ca3af' }}>
                                    Notification Email
                                </label>
                                <span style={{ fontSize: 11, fontWeight: 500, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#1a1a1a', padding: '4px 8px', borderRadius: 4 }}>
                                    Optional
                                </span>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    style={{
                                        width: '100%',
                                        height: 56,
                                        paddingLeft: 20,
                                        paddingRight: 48,
                                        backgroundColor: '#141414',
                                        border: '1px solid #262626',
                                        borderRadius: 12,
                                        fontSize: 15,
                                        color: '#e5e5e5',
                                        outline: 'none',
                                    }}
                                />
                                <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', color: '#4b5563' }}>
                                    <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div style={{ 
                            display: 'flex', 
                            gap: 16, 
                            padding: 20, 
                            backgroundColor: '#141414', 
                            border: '1px solid #222', 
                            borderRadius: 12 
                        }}>
                            <div style={{ paddingTop: 4 }}>
                                <div style={{ 
                                    width: 8, 
                                    height: 8, 
                                    borderRadius: '50%', 
                                    backgroundColor: '#f97316',
                                    boxShadow: '0 0 8px rgba(249, 115, 22, 0.6)'
                                }}></div>
                            </div>
                            <div>
                                <h4 style={{ fontSize: 14, fontWeight: 500, color: '#e5e5e5', marginBottom: 6 }}>
                                    High-Performance Mode Active
                                </h4>
                                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                                    Running on optimized generation cluster. Estimated time: <span style={{ color: '#9ca3af', fontWeight: 500 }}>3-5 minutes</span> for 100+ pages.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ 
                    flexShrink: 0, 
                    borderTop: '1px solid #1a1a1a', 
                    backgroundColor: '#0f0f0f', 
                    padding: '24px 48px' 
                }}>
                    <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                            onClick={() => {
                                setPdfData(null)
                                setSelectedCompanyId('')
                                setEmail('')
                            }}
                            style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#6b7280',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px 4px',
                            }}
                        >
                            Cancel
                        </button>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {!canSubmit && (
                                <span style={{ fontSize: 12, color: '#4b5563' }}>
                                    Upload PDF & Select Company
                                </span>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={!canSubmit}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '14px 28px',
                                    borderRadius: 12,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                                    backgroundColor: canSubmit ? '#ea580c' : '#1a1a1a',
                                    color: canSubmit ? 'white' : '#4b5563',
                                    boxShadow: canSubmit ? '0 4px 14px rgba(234, 88, 12, 0.25)' : 'none',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                                        Initializing...
                                    </>
                                ) : (
                                    <>
                                        Generate Proposal
                                        {canSubmit && (
                                            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                select option {
                    background-color: #141414;
                    color: #e5e5e5;
                }
                input::placeholder {
                    color: #4b5563;
                }
                button:hover {
                    opacity: 0.9;
                }
            `}</style>
        </div>
    )
}
