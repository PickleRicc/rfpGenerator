'use client'

import React from 'react'

interface Section {
    id: string
    title: string
    isComplete: boolean
}

interface IntakeProgressProps {
    sections: Section[]
    currentSection: string
    onSectionClick: (sectionId: string) => void
    onSave: () => void
    isSaving: boolean
    lastSaved?: Date | null
}

const IntakeProgress: React.FC<IntakeProgressProps> = ({
    sections,
    currentSection,
    onSectionClick,
    onSave,
    isSaving,
    lastSaved,
}) => {
    const completedCount = sections.filter(s => s.isComplete).length
    const percentComplete = Math.round((completedCount / sections.length) * 100)

    return (
        <div style={{
            position: 'sticky',
            top: '24px',
            backgroundColor: '#0f0f0f',
            border: '1px solid #1a1a1a',
            borderRadius: '12px',
            padding: '24px',
        }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', margin: '0 0 8px 0' }}>
                    Form Progress
                </h3>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    <div style={{
                        flex: 1,
                        height: '6px',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '3px',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${percentComplete}%`,
                            height: '100%',
                            backgroundColor: percentComplete === 100 ? '#22c55e' : '#f97316',
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>
                        {percentComplete}%
                    </span>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '8px 0 0 0' }}>
                    {completedCount} of {sections.length} sections complete
                </p>
            </div>

            {/* Section list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
                {sections.map((section, index) => (
                    <button
                        key={section.id}
                        onClick={() => onSectionClick(section.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            backgroundColor: currentSection === section.id ? '#1a1a1a' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 0.2s ease',
                        }}
                    >
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            backgroundColor: section.isComplete ? '#166534' : '#1a1a1a',
                            border: `1px solid ${section.isComplete ? '#22c55e' : '#262626'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: section.isComplete ? '#22c55e' : '#6b7280',
                        }}>
                            {section.isComplete ? (
                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                index + 1
                            )}
                        </div>
                        <span style={{
                            fontSize: '13px',
                            color: currentSection === section.id ? '#e5e5e5' : '#9ca3af',
                            fontWeight: currentSection === section.id ? 500 : 400,
                        }}>
                            {section.title}
                        </span>
                    </button>
                ))}
            </div>

            {/* Save status */}
            <div style={{
                padding: '16px',
                backgroundColor: '#141414',
                borderRadius: '8px',
                marginBottom: '16px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {isSaving ? (
                        <>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#f97316',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                            <span style={{ fontSize: '12px', color: '#f97316' }}>Saving...</span>
                        </>
                    ) : (
                        <>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: '#22c55e',
                            }} />
                            <span style={{ fontSize: '12px', color: '#22c55e' }}>Auto-saved</span>
                        </>
                    )}
                </div>
                {lastSaved && (
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>
                        Last saved: {lastSaved.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Save button */}
            <button
                onClick={onSave}
                disabled={isSaving}
                style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#e5e5e5',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: isSaving ? 0.6 : 1,
                }}
            >
                Save & Continue Later
            </button>

            <style jsx global>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    )
}

export default IntakeProgress













