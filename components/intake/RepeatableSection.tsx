'use client'

import React from 'react'

interface RepeatableSectionProps<T> {
    title: string
    items: T[]
    onAdd: () => void
    onRemove: (index: number) => void
    renderItem: (item: T, index: number) => React.ReactNode
    minItems?: number
    maxItems?: number
    addButtonText?: string
    emptyMessage?: string
}

function RepeatableSection<T>({
    title,
    items,
    onAdd,
    onRemove,
    renderItem,
    minItems = 0,
    maxItems = 10,
    addButtonText = 'Add Item',
    emptyMessage = 'No items added yet.',
}: RepeatableSectionProps<T>) {
    const canAdd = items.length < maxItems
    const canRemove = items.length > minItems

    return (
        <div style={{ marginBottom: '24px' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
            }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', margin: 0 }}>
                    {title}
                    <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: '8px' }}>
                        ({items.length}{maxItems < 100 ? `/${maxItems}` : ''})
                    </span>
                </h4>
                {canAdd && (
                    <button
                        onClick={onAdd}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #262626',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#f97316',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {addButtonText}
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <div style={{
                    padding: '32px',
                    backgroundColor: '#141414',
                    border: '1px dashed #262626',
                    borderRadius: '8px',
                    textAlign: 'center',
                }}>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                        {emptyMessage}
                    </p>
                    {minItems > 0 && (
                        <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>
                            Minimum {minItems} required
                        </p>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {items.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                padding: '20px',
                                backgroundColor: '#141414',
                                border: '1px solid #262626',
                                borderRadius: '8px',
                                position: 'relative',
                            }}
                        >
                            {/* Item header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '16px',
                                paddingBottom: '12px',
                                borderBottom: '1px solid #1a1a1a',
                            }}>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                }}>
                                    #{index + 1}
                                </span>
                                {canRemove && (
                                    <button
                                        onClick={() => onRemove(index)}
                                        style={{
                                            padding: '6px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#6b7280',
                                            transition: 'color 0.2s ease',
                                        }}
                                        title="Remove"
                                    >
                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Item content */}
                            {renderItem(item, index)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default RepeatableSection













