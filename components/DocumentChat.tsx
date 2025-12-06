'use client'

import React, { useState, useRef, useEffect } from 'react'

// =============================================================================
// SVG ICONS
// =============================================================================

const Icons = {
    bot: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
        </svg>
    ),
    check: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    x: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    save: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
        </svg>
    ),
    undo: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
    ),
    send: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    ),
    edit: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    eye: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    loader: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
    ),
}

// =============================================================================
// TYPES
// =============================================================================

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    pendingEdit?: {
        originalHtml: string
        updatedHtml: string
        sectionName: string
        summary: string
    }
}

interface DocumentChatProps {
    jobId: string
    currentHtml: string
    onHtmlUpdate: (newHtml: string) => void
    onSave: () => Promise<void>
    hasUnsavedChanges: boolean
    isOpen: boolean
    onClose: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function DocumentChat({ 
    jobId, 
    currentHtml, 
    onHtmlUpdate, 
    onSave,
    hasUnsavedChanges,
    isOpen,
    onClose,
}: DocumentChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: `I can answer questions or make edits. Be specific for faster results!

Questions:
• "Who are the key personnel?"
• "What's the total contract value?"

Edits (name the section):
• "Change the title to [new title]"
• "Shorten the Executive Summary"
• "Add a sentence to Technical Approach"
• "Update the pricing table"

Or paste the exact text:
• "Add a sentence to this: [paste paragraph]"`,
            timestamp: new Date(),
        }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [history, setHistory] = useState<string[]>([]) // Undo history
    const [abortController, setAbortController] = useState<AbortController | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Save current state to history before making changes
    const pushToHistory = (html: string) => {
        setHistory(prev => [...prev.slice(-9), html]) // Keep last 10 states
    }

    // Validate instruction for vague references
    const validateInstruction = (instruction: string): { valid: boolean; message?: string } => {
        const lower = instruction.toLowerCase().trim()
        
        // Too short
        if (lower.length < 10) {
            return { valid: false, message: "Please provide more detail about what you'd like to do." }
        }
        
        // If instruction contains a colon followed by substantial content, it's specific enough
        // User is pasting the actual content they want to edit
        const colonIndex = instruction.indexOf(':')
        if (colonIndex > 0 && colonIndex < 80) {
            const afterColon = instruction.slice(colonIndex + 1).trim()
            if (afterColon.length > 30) {
                // User provided specific content - this is valid
                return { valid: true }
            }
        }
        
        // Questions are always valid
        if (lower.includes('?') || lower.startsWith('who') || lower.startsWith('what') || 
            lower.startsWith('where') || lower.startsWith('how') || lower.startsWith('why')) {
            return { valid: true }
        }
        
        // Vague reference patterns - "this/that/the" without specifying what
        const vaguePatterns = [
            /^(can you )?(add|change|update|modify|edit|fix|remove|delete)\s+(to\s+)?(this|that|the)\s*(paragraph|section|sentence|part|thing|one)?[.!]?$/i,
            /^(can you )?(add|put|insert)\s+.{0,20}\s+(to|in|into)\s+(this|that|the)\s*(paragraph|section|sentence|part)?[.!]?$/i,
        ]
        
        for (const pattern of vaguePatterns) {
            if (pattern.test(lower)) {
                return { 
                    valid: false, 
                    message: "Please specify which part you're referring to.\n\nYou can either:\n• Name the section: \"Add a sentence to the Executive Summary\"\n• Or paste the content: \"Add a sentence to this paragraph: [paste the text]\""
                }
            }
        }
        
        // Check for "this" or "that" without context
        const editWords = ['add', 'change', 'update', 'modify', 'edit', 'fix', 'remove', 'delete', 'put', 'insert']
        const hasEditWord = editWords.some(w => lower.includes(w))
        const hasVagueReference = /\b(this|that)\s+(paragraph|section|sentence|part)\b/i.test(lower)
        const hasSpecificTarget = /\b(title|cover|summary|executive|technical|management|pricing|past performance|compliance|personnel|appendix|toc|table of contents|company|date|agency)\b/i.test(lower)
        
        if (hasEditWord && hasVagueReference && !hasSpecificTarget && colonIndex === -1) {
            return { 
                valid: false, 
                message: "Please specify which part you want to modify.\n\nTry:\n• \"Edit the executive summary\"\n• \"Change the title\"\n• Or paste the text after a colon"
            }
        }
        
        return { valid: true }
    }

    const handleCancel = () => {
        console.log('[Chat] Cancel clicked, abortController:', !!abortController)
        if (abortController) {
            abortController.abort()
        }
        // Always update state regardless
        setAbortController(null)
        setIsLoading(false)
        
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: "Request cancelled.",
            timestamp: new Date(),
        }])
    }

    const handleUndo = () => {
        if (history.length === 0) return
        
        const previousState = history[history.length - 1]
        setHistory(prev => prev.slice(0, -1))
        onHtmlUpdate(previousState)
        
        const undoMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: "Reverted to previous version.",
            timestamp: new Date(),
        }
        setMessages(prev => [...prev, undoMessage])
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')

        // Validate instruction before sending
        const validation = validateInstruction(userMessage.content)
        if (!validation.valid) {
            const clarifyMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: validation.message || "Please be more specific about what you'd like to change.",
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, clarifyMessage])
            return
        }

        setIsLoading(true)
        const controller = new AbortController()
        setAbortController(controller)

        try {
            const response = await fetch(`/api/proposals/edit/${jobId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instruction: userMessage.content,
                    html: currentHtml,
                    previewMode: true,
                }),
                signal: controller.signal,
            })

            const data = await response.json()

            // Reset loading state on successful response
            setIsLoading(false)
            setAbortController(null)

            if (response.ok) {
                if (data.isQuestion && data.answer) {
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: data.answer,
                        timestamp: new Date(),
                    }])
                } else if (data.preview) {
                    // Save current state for undo before showing preview
                    pushToHistory(currentHtml)
                    onHtmlUpdate(data.preview.fullUpdatedHtml)
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: '',
                        timestamp: new Date(),
                        pendingEdit: {
                            originalHtml: currentHtml,
                            updatedHtml: data.preview.fullUpdatedHtml,
                            sectionName: data.preview.sectionName,
                            summary: data.preview.summary,
                        },
                    }])
                } else if (data.updatedHtml) {
                    pushToHistory(currentHtml)
                    onHtmlUpdate(data.updatedHtml)
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: `Done: ${data.message || 'Changes applied'}`,
                        timestamp: new Date(),
                    }])
                }
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: `Sorry, couldn't process that. ${data.error || 'Try again.'}`,
                    timestamp: new Date(),
                }])
            }
        } catch (error) {
            // Don't show error if it was cancelled
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[Chat] Request was aborted')
                // State is already handled by handleCancel
                return
            }
            console.error('[Chat] Error:', error)
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Something went wrong. Please try again.",
                timestamp: new Date(),
            }])
            setIsLoading(false)
            setAbortController(null)
        }
    }

    const handleAcceptEdit = (messageId: string) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId && msg.pendingEdit) {
                // Log acceptance
                console.log(`[Chat] ===== EDIT ACCEPTED =====`)
                console.log(`[Chat] Section: ${msg.pendingEdit.sectionName}`)
                console.log(`[Chat] Summary: ${msg.pendingEdit.summary}`)
                console.log(`[Chat] New HTML size: ${msg.pendingEdit.updatedHtml.length} chars`)
                console.log(`[Chat] ===========================`)
                
                return {
                    ...msg,
                    content: `Applied: ${msg.pendingEdit.summary}`,
                    pendingEdit: undefined,
                }
            }
            return msg
        }))
    }

    const handleRejectEdit = (messageId: string, originalHtml: string) => {
        // Log rejection
        console.log(`[Chat] ===== EDIT REJECTED =====`)
        console.log(`[Chat] Reverting to original (${originalHtml.length} chars)`)
        console.log(`[Chat] ===========================`)
        
        onHtmlUpdate(originalHtml)
        // Remove from history since we're reverting
        setHistory(prev => prev.slice(0, -1))
        
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId && msg.pendingEdit) {
                return {
                    ...msg,
                    content: `Rejected: ${msg.pendingEdit.summary}`,
                    pendingEdit: undefined,
                }
            }
            return msg
        }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await onSave()
            const saveMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: "All changes saved to database.",
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, saveMessage])
        } catch (error) {
            console.error('Error saving:', error)
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div 
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 40,
                }}
            />
            
            {/* Floating Chat Panel */}
            <div style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                width: 420,
                height: 560,
                backgroundColor: '#0f0f0f',
                borderRadius: 16,
                border: '1px solid #262626',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '12px 14px', 
                    borderBottom: '1px solid #1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #141414 0%, #0f0f0f 100%)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                            width: 32, 
                            height: 32, 
                            borderRadius: 8, 
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                            color: 'white',
                        }}>
                            {Icons.bot}
                        </div>
                        <div>
                            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
                                AI Assistant
                            </h2>
                            <p style={{ fontSize: 10, color: '#6b7280' }}>
                                Preview edits before applying
                            </p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Undo Button */}
                        {history.length > 0 && (
                            <button
                                onClick={handleUndo}
                                title={`Undo (${history.length} available)`}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #262626',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                }}
                            >
                                {Icons.undo}
                                <span style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    backgroundColor: '#f97316',
                                    color: 'white',
                                    fontSize: 9,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    {history.length}
                                </span>
                            </button>
                        )}
                        
                        {/* Save Button */}
                        {hasUnsavedChanges && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    opacity: isSaving ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                {isSaving ? Icons.loader : Icons.save}
                                <span>Save</span>
                            </button>
                        )}
                        
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #262626',
                                color: '#6b7280',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {Icons.x}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}>
                    {messages.map((message) => (
                        <div key={message.id}>
                            {message.pendingEdit ? (
                                /* Edit Preview Card */
                                <div style={{
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid rgba(249, 115, 22, 0.3)',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        padding: '12px 14px',
                                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                    }}>
                                        <div style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            backgroundColor: '#f97316',
                                            animation: 'pulse 2s infinite',
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 12, fontWeight: 600, color: '#f97316' }}>
                                                Preview: {message.pendingEdit.sectionName}
                                            </p>
                                            <p style={{ fontSize: 11, color: '#e5e5e5', marginTop: 2 }}>
                                                {message.pendingEdit.summary}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Hint */}
                                    <div style={{ padding: '10px 14px', borderTop: '1px solid #262626', borderBottom: '1px solid #262626' }}>
                                        <p style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ color: '#9ca3af' }}>{Icons.eye}</span>
                                            Check the document preview to see the changes
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ 
                                        padding: '12px 14px', 
                                        display: 'flex',
                                        gap: 8,
                                    }}>
                                        <button
                                            onClick={() => handleAcceptEdit(message.id)}
                                            style={{
                                                flex: 1,
                                                padding: '10px 16px',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                backgroundColor: '#22c55e',
                                                color: 'white',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {Icons.check}
                                            <span>Keep Changes</span>
                                        </button>
                                        <button
                                            onClick={() => handleRejectEdit(message.id, message.pendingEdit!.originalHtml)}
                                            style={{
                                                flex: 1,
                                                padding: '10px 16px',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 500,
                                                backgroundColor: 'transparent',
                                                color: '#f87171',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {Icons.x}
                                            <span>Revert</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Regular Message */
                                <div style={{
                                    display: 'flex',
                                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                                }}>
                                    <div style={{
                                        maxWidth: '85%',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        backgroundColor: message.role === 'user' ? '#f97316' : '#1a1a1a',
                                        color: 'white',
                                        fontSize: 12,
                                        lineHeight: 1.5,
                                        border: message.role === 'user' ? 'none' : '1px solid #262626',
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {message.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: 10,
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #262626',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af' }}>
                                    {Icons.loader}
                                    <span style={{ fontSize: 12 }}>Processing...</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleCancel()
                                    }}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        color: '#f87171',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    {Icons.x}
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} style={{ padding: 14, borderTop: '1px solid #1a1a1a' }}>
                    <div style={{ 
                        display: 'flex', 
                        gap: 8,
                        backgroundColor: '#141414',
                        border: '1px solid #262626',
                        borderRadius: 10,
                        padding: 4,
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a question or request an edit..."
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                backgroundColor: 'transparent',
                                border: 'none',
                                outline: 'none',
                                padding: '8px 10px',
                                fontSize: 12,
                                color: 'white',
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                backgroundColor: input.trim() && !isLoading ? '#f97316' : '#262626',
                                color: input.trim() && !isLoading ? 'white' : '#6b7280',
                                border: 'none',
                                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            {Icons.send}
                        </button>
                    </div>
                </form>

                <style jsx global>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes pulse { 
                        0%, 100% { opacity: 1; } 
                        50% { opacity: 0.4; } 
                    }
                `}</style>
            </div>
        </>
    )
}

// =============================================================================
// TOGGLE BUTTON
// =============================================================================

export function ChatToggleButton({ 
    onClick, 
    hasUnsavedChanges 
}: { 
    onClick: () => void
    hasUnsavedChanges: boolean 
}) {
    return (
        <button
            onClick={onClick}
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)',
                zIndex: 30,
                transition: 'transform 0.2s, box-shadow 0.2s',
                color: 'white',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(249, 115, 22, 0.5)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(249, 115, 22, 0.4)'
            }}
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
            {hasUnsavedChanges && (
                <div style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    border: '2px solid #0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <span style={{ fontSize: 10, color: 'white', fontWeight: 600 }}>!</span>
                </div>
            )}
        </button>
    )
}
