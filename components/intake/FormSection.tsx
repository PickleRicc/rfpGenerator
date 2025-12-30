'use client'

import React, { useState } from 'react'

interface FormSectionProps {
    title: string
    description?: string
    sectionNumber: number
    isComplete: boolean
    isExpanded?: boolean
    children: React.ReactNode
    onToggle?: () => void
}

const FormSection: React.FC<FormSectionProps> = ({
    title,
    description,
    sectionNumber,
    isComplete,
    isExpanded = false,
    children,
    onToggle,
}) => {
    const [expanded, setExpanded] = useState(isExpanded)

    const handleToggle = () => {
        setExpanded(!expanded)
        onToggle?.()
    }

    return (
        <div style={{
            backgroundColor: '#0f0f0f',
            border: '1px solid #1a1a1a',
            borderRadius: '12px',
            marginBottom: '16px',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <button
                onClick={handleToggle}
                style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Section number badge */}
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isComplete ? '#166534' : '#1a1a1a',
                        border: `1px solid ${isComplete ? '#22c55e' : '#262626'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isComplete ? '#22c55e' : '#9ca3af',
                        fontSize: '14px',
                        fontWeight: 600,
                    }}>
                        {isComplete ? (
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            sectionNumber
                        )}
                    </div>

                    <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#e5e5e5', margin: 0 }}>
                            {title}
                        </h3>
                        {description && (
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isComplete && (
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#22c55e',
                            backgroundColor: '#052e16',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            Complete
                        </span>
                    )}
                    <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="#6b7280"
                        viewBox="0 0 24 24"
                        style={{
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s ease',
                        }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Content */}
            {expanded && (
                <div style={{
                    padding: '0 24px 24px 24px',
                    borderTop: '1px solid #1a1a1a',
                }}>
                    <div style={{ paddingTop: '24px' }}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    )
}

export default FormSection













