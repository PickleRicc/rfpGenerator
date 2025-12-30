'use client'

import React, { useState, useCallback, useRef } from 'react'

interface UploadedFile {
    name: string
    size: number
    type: string
    url?: string
    file?: File
}

interface FileUploadProps {
    label: string
    name: string
    value?: UploadedFile | null
    onChange: (name: string, file: UploadedFile | null) => void
    accept?: string
    maxSize?: number // in MB
    required?: boolean
    helpText?: string
}

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FileUpload: React.FC<FileUploadProps> = ({
    label,
    name,
    value,
    onChange,
    accept = '.pdf,.doc,.docx',
    maxSize = 5, // 5MB default
    required = false,
    helpText,
}) => {
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback((file: File) => {
        setError(null)

        // Check file size
        const maxBytes = maxSize * 1024 * 1024
        if (file.size > maxBytes) {
            setError(`File size must be less than ${maxSize}MB`)
            return
        }

        // Check file type
        const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase())
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`
        const fileType = file.type.toLowerCase()

        const isAccepted = acceptedTypes.some(type => {
            if (type.startsWith('.')) {
                return fileExtension === type
            }
            return fileType.includes(type.replace('*', ''))
        })

        if (!isAccepted) {
            setError(`Invalid file type. Accepted: ${accept}`)
            return
        }

        // Create file object
        const uploadedFile: UploadedFile = {
            name: file.name,
            size: file.size,
            type: file.type,
            file: file,
        }

        onChange(name, uploadedFile)
    }, [accept, maxSize, name, onChange])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)

        const file = e.dataTransfer.files[0]
        if (file) {
            handleFile(file)
        }
    }, [handleFile])

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleClick = () => {
        fileInputRef.current?.click()
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFile(file)
        }
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange(name, null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: '#9ca3af' }}>
                    {label}
                    {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                </label>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleInputChange}
                style={{ display: 'none' }}
            />

            {value ? (
                // File preview
                <div style={{
                    padding: '16px',
                    backgroundColor: '#141414',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: '#1a1a1a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f97316',
                        }}>
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontSize: '14px', color: '#e5e5e5', margin: 0 }}>{value.name}</p>
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>
                                {formatFileSize(value.size)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleRemove}
                        style={{
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                        }}
                    >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ) : (
                // Dropzone
                <div
                    onClick={handleClick}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{
                        padding: '32px',
                        backgroundColor: isDragging ? '#1a1a1a' : '#141414',
                        border: `2px dashed ${isDragging ? '#f97316' : error ? '#ef4444' : '#262626'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <div style={{
                        width: '48px',
                        height: '48px',
                        margin: '0 auto 12px',
                        borderRadius: '12px',
                        backgroundColor: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280',
                    }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 4px 0' }}>
                        <span style={{ color: '#f97316', fontWeight: 500 }}>Click to upload</span> or drag and drop
                    </p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        {accept.replace(/\./g, '').toUpperCase()} up to {maxSize}MB
                    </p>
                </div>
            )}

            {helpText && !error && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                    {helpText}
                </p>
            )}

            {error && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>
                    {error}
                </p>
            )}
        </div>
    )
}

export default FileUpload













