'use client'

import React, { useState, useCallback } from 'react'

interface ValidationRule {
    validate: (value: string) => boolean
    message: string
}

interface ValidatedInputProps {
    label: string
    name: string
    value: string
    onChange: (name: string, value: string) => void
    type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea'
    placeholder?: string
    required?: boolean
    disabled?: boolean
    maxLength?: number
    helpText?: string
    validationRules?: ValidationRule[]
    pattern?: RegExp
    patternMessage?: string
    className?: string
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
    UEI: /^[A-Z0-9]{12}$/,
    CAGE: /^[A-Z0-9]{5}$/,
    DUNS: /^\d{9}$/,
    EIN: /^\d{2}-\d{7}$/,
    PHONE: /^\d{3}-\d{3}-\d{4}$/,
    NAICS: /^\d{6}$/,
}

export const PLACEHOLDER_PATTERNS = [
    /^ABC123/i,
    /^123456789$/,
    /^1A2B3$/,
    /^XXXXX/i,
    /^TBD$/i,
    /^N\/A$/i,
]

export const isPlaceholder = (value: string): boolean => {
    return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value))
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
    label,
    name,
    value,
    onChange,
    type = 'text',
    placeholder,
    required = false,
    disabled = false,
    maxLength,
    helpText,
    validationRules = [],
    pattern,
    patternMessage,
    className = '',
}) => {
    const [touched, setTouched] = useState(false)
    const [errors, setErrors] = useState<string[]>([])

    const validate = useCallback((val: string) => {
        const newErrors: string[] = []

        if (required && !val.trim()) {
            newErrors.push('This field is required')
        }

        if (val && pattern && !pattern.test(val)) {
            newErrors.push(patternMessage || 'Invalid format')
        }

        if (val && isPlaceholder(val)) {
            newErrors.push('Placeholder values are not allowed')
        }

        validationRules.forEach(rule => {
            if (val && !rule.validate(val)) {
                newErrors.push(rule.message)
            }
        })

        setErrors(newErrors)
        return newErrors.length === 0
    }, [required, pattern, patternMessage, validationRules])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value
        onChange(name, newValue)
        if (touched) {
            validate(newValue)
        }
    }

    const handleBlur = () => {
        setTouched(true)
        validate(value)
    }

    const hasError = touched && errors.length > 0
    const isValid = touched && errors.length === 0 && value.trim().length > 0

    const inputStyles: React.CSSProperties = {
        width: '100%',
        padding: '12px 16px',
        backgroundColor: '#141414',
        border: `1px solid ${hasError ? '#ef4444' : isValid ? '#22c55e' : '#262626'}`,
        borderRadius: '8px',
        fontSize: '14px',
        color: '#e5e5e5',
        outline: 'none',
        transition: 'border-color 0.2s ease',
    }

    return (
        <div className={className} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#9ca3af' }}>
                    {label}
                    {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
                {isValid && (
                    <span style={{ color: '#22c55e', fontSize: '12px' }}>✓</span>
                )}
            </div>

            {type === 'textarea' ? (
                <textarea
                    name={name}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={maxLength}
                    style={{ ...inputStyles, minHeight: '100px', resize: 'vertical' }}
                />
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={maxLength}
                    style={inputStyles}
                />
            )}

            {maxLength && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>
                    {value.length}/{maxLength}
                </div>
            )}

            {helpText && !hasError && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                    {helpText}
                </p>
            )}

            {hasError && (
                <div style={{ marginTop: '6px' }}>
                    {errors.map((error, index) => (
                        <p key={index} style={{ fontSize: '12px', color: '#ef4444', margin: '2px 0' }}>
                            {error}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ValidatedInput













