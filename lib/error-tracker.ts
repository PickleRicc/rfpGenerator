/**
 * Centralized error tracking for proposal generation
 * 
 * Ensures no errors go unnoticed and all failures are logged properly
 */

import { supabase } from './supabase'

export interface ErrorLog {
    jobId: string
    agent: string
    errorType: 'api_failure' | 'validation_error' | 'timeout' | 'network_error' | 'unknown'
    errorMessage: string
    errorStack?: string
    context?: Record<string, unknown>
    recoverable: boolean
    attemptNumber?: number
    timestamp: string
}

/**
 * Log an error that occurred during proposal generation
 */
export async function logError(error: ErrorLog): Promise<void> {
    try {
        // Log to console for immediate visibility
        console.error(`[ERROR TRACKER] ${error.agent} - ${error.errorType}:`, error.errorMessage)
        if (error.context) {
            console.error('Context:', error.context)
        }
        
        // Get current error log
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: currentJob } = await (supabase.from('proposal_jobs') as any)
            .select('error_log')
            .eq('job_id', error.jobId)
            .single()
        
        const errorLog = currentJob?.error_log || []
        errorLog.push({
            ...error,
            timestamp: new Date().toISOString()
        })
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({ error_log: errorLog })
            .eq('job_id', error.jobId)
        
        // If non-recoverable, send alert
        if (!error.recoverable) {
            await sendCriticalAlert(error)
        }
    } catch (logErr) {
        // Don't let logging errors break the main flow
        console.error('[ERROR TRACKER] Failed to log error:', logErr)
    }
}

/**
 * Get all errors for a job
 */
export async function getJobErrors(jobId: string): Promise<ErrorLog[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('proposal_jobs') as any)
        .select('error_log')
        .eq('job_id', jobId)
        .single()
    
    return data?.error_log || []
}

/**
 * Check if error is recoverable
 */
export function isRecoverable(error: unknown): boolean {
    if (error instanceof Error) {
        // Network errors are usually recoverable
        if (error.message.includes('ENOTFOUND') || 
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('fetch failed')) {
            return true
        }
        
        // Rate limits are recoverable
        if (error.message.includes('429') || error.message.includes('rate limit')) {
            return true
        }
        
        // Validation errors are NOT recoverable
        if (error.message.includes('validation') || error.message.includes('invalid')) {
            return false
        }
    }
    
    // Unknown errors - assume recoverable to attempt retry
    return true
}

/**
 * Send critical alert (email, Slack, etc.)
 */
async function sendCriticalAlert(error: ErrorLog): Promise<void> {
    // TODO: Implement email/Slack notification
    console.error('🚨 CRITICAL ERROR - Manual intervention may be needed:')
    console.error(JSON.stringify(error, null, 2))
    
    // For now, just ensure it's very visible in logs
    console.error('─'.repeat(80))
    console.error(`Job ${error.jobId} has encountered a non-recoverable error in ${error.agent}`)
    console.error(`Error: ${error.errorMessage}`)
    console.error('─'.repeat(80))
}

/**
 * Classify error type from error object
 */
export function classifyError(error: unknown): ErrorLog['errorType'] {
    if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('fetch failed')) {
            return 'network_error'
        }
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            return 'timeout'
        }
        if (error.message.includes('429') || error.message.includes('rate limit')) {
            return 'api_failure'
        }
        if (error.message.includes('validation') || error.message.includes('invalid')) {
            return 'validation_error'
        }
    }
    return 'unknown'
}









