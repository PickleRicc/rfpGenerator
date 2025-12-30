'use client'

import React from 'react'

interface Option {
    value: string
    label: string
    description?: string
}

interface CheckboxGroupProps {
    label: string
    name: string
    value: string[]
    onChange: (name: string, value: string[]) => void
    options: Option[]
    required?: boolean
    helpText?: string
    columns?: number
}

const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
    label,
    name,
    value,
    onChange,
    options,
    required = false,
    helpText,
    columns = 2,
}) => {
    const handleToggle = (optionValue: string) => {
        const newValue = value.includes(optionValue)
            ? value.filter(v => v !== optionValue)
            : [...value, optionValue]
        onChange(name, newValue)
    }

    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#9ca3af' }}>
                    {label}
                    {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                {value.length > 0 && (
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {value.length} selected
                    </span>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: '8px',
            }}>
                {options.map((option) => {
                    const isChecked = value.includes(option.value)
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleToggle(option.value)}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '12px',
                                backgroundColor: isChecked ? '#1a1a1a' : '#141414',
                                border: `1px solid ${isChecked ? '#f97316' : '#262626'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                backgroundColor: isChecked ? '#f97316' : 'transparent',
                                border: `2px solid ${isChecked ? '#f97316' : '#4b5563'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: '1px',
                            }}>
                                {isChecked && (
                                    <svg width="10" height="10" fill="none" stroke="white" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <span style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: isChecked ? '#e5e5e5' : '#9ca3af',
                                }}>
                                    {option.label}
                                </span>
                                {option.description && (
                                    <p style={{
                                        fontSize: '11px',
                                        color: '#6b7280',
                                        margin: '2px 0 0 0',
                                    }}>
                                        {option.description}
                                    </p>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {helpText && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    {helpText}
                </p>
            )}
        </div>
    )
}

export default CheckboxGroup













