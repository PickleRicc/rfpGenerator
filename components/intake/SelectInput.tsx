'use client'

import React from 'react'

interface Option {
    value: string
    label: string
}

interface SelectInputProps {
    label: string
    name: string
    value: string
    onChange: (name: string, value: string) => void
    options: Option[]
    placeholder?: string
    required?: boolean
    disabled?: boolean
    helpText?: string
}

const SelectInput: React.FC<SelectInputProps> = ({
    label,
    name,
    value,
    onChange,
    options,
    placeholder = 'Select an option...',
    required = false,
    disabled = false,
    helpText,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(name, e.target.value)
    }

    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#9ca3af' }}>
                    {label}
                    {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
            </div>

            <div style={{ position: 'relative' }}>
                <select
                    name={name}
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        padding: '12px 40px 12px 16px',
                        backgroundColor: '#141414',
                        border: '1px solid #262626',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: value ? '#e5e5e5' : '#6b7280',
                        outline: 'none',
                        appearance: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1,
                    }}
                >
                    <option value="">{placeholder}</option>
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#6b7280',
                }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {helpText && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                    {helpText}
                </p>
            )}

            <style jsx global>{`
                select option {
                    background-color: #141414;
                    color: #e5e5e5;
                }
            `}</style>
        </div>
    )
}

export default SelectInput













