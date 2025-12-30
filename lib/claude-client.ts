import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

// Enhanced client with better connection handling
export const anthropic = new Anthropic({
    apiKey,
    // Add timeout and retry settings for better reliability
    maxRetries: 3,
    timeout: 600000, // 10 minutes - enough for long-running content generation
})

export interface ClaudeCallOptions {
    system: string
    userPrompt: string
    maxTokens?: number
    temperature?: number
    jobId?: string // Optional: if provided, will send heartbeats during long operations
}

/**
 * Send a heartbeat to keep the job alive during long Claude calls.
 * This prevents the stalled job monitor from killing jobs that are just slow.
 */
async function sendHeartbeat(jobId: string, step?: string): Promise<void> {
    try {
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        }
        if (step) {
            updateData.current_step = step
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update(updateData)
            .eq('job_id', jobId)
    } catch {
        // Ignore heartbeat errors - don't fail the main operation
    }
}

/**
 * Parse retry-after header from rate limit response
 */
function getRetryAfterMs(error: unknown): number {
    // Default wait time
    let waitMs = 30000 // 30 seconds
    
    if (error && typeof error === 'object' && 'headers' in error) {
        const headers = (error as { headers?: Headers }).headers
        if (headers) {
            const retryAfter = headers.get?.('retry-after')
            if (retryAfter) {
                const seconds = parseInt(retryAfter, 10)
                if (!isNaN(seconds)) {
                    waitMs = (seconds + 2) * 1000 // Add 2 seconds buffer
                    console.log(`[Claude] Rate limited - retry-after: ${seconds}s`)
                }
            }
        }
    }
    
    return waitMs
}

/**
 * Robust Claude API wrapper with heartbeat support
 * 
 * Features:
 * - Automatic retries with exponential backoff
 * - Rate limit handling with retry-after header respect
 * - Heartbeat support to keep jobs alive during long waits
 * - Caps max_tokens at 16000 for Final Draft Builder (was 8000)
 */
export async function callClaude(
    options: ClaudeCallOptions,
    retries = 3
): Promise<string> {
    const { system, userPrompt, maxTokens = 8000, temperature = 0.7, jobId } = options
    const safeMaxTokens = Math.min(maxTokens, 16000) // Increased for Final Draft Builder

    console.log(`[Claude] Starting API call (max_tokens: ${safeMaxTokens}, temp: ${temperature})`)
    console.log(`[Claude] System prompt: ${system.length} chars, User prompt: ${userPrompt.length} chars`)
    
    const startTime = Date.now()

    // Send initial heartbeat if we have a jobId
    if (jobId) {
        await sendHeartbeat(jobId, 'Calling Claude API...')
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[Claude] Attempt ${attempt}/${retries}...`)
            
            // Start a heartbeat interval during the API call to prevent stall detection
            // Send a heartbeat every 60 seconds during long-running API calls
            let heartbeatTimer: NodeJS.Timeout | null = null
            if (jobId) {
                heartbeatTimer = setInterval(async () => {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
                    await sendHeartbeat(jobId, `Claude API call in progress (${elapsed}s)`)
                    console.log(`[Claude] Heartbeat sent during API call (${elapsed}s elapsed)`)
                }, 60000) // Every 60 seconds
            }
            
            try {
                const message = await anthropic.messages.create({
                    model: 'claude-sonnet-4-5-20250929',
                    max_tokens: safeMaxTokens,
                    temperature,
                    system,
                    messages: [
                        {
                            role: 'user',
                            content: userPrompt,
                        },
                    ],
                })

                // Clear the heartbeat timer
                if (heartbeatTimer) {
                    clearInterval(heartbeatTimer)
                }

                // Extract text from content blocks
                const textContent = message.content
                    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                    .map((block) => block.text)
                    .join('\n')

                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                console.log(`[Claude] ✓ Success in ${elapsed}s (${textContent.length} chars)`)
                console.log(`[Claude] Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`)

                return textContent
            } catch (apiError) {
                // Clear the heartbeat timer on error
                if (heartbeatTimer) {
                    clearInterval(heartbeatTimer)
                }
                throw apiError
            }
        } catch (error) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            console.error(`[Claude] ✗ Attempt ${attempt} failed after ${elapsed}s:`, error)

            if (attempt === retries) {
                throw new Error(`Claude API failed after ${retries} attempts: ${error}`)
            }

            // Check error type for better handling
            const isRateLimit = error && typeof error === 'object' && 
                               'status' in error && (error as { status: number }).status === 429
            
            const isConnectionError = error && typeof error === 'object' &&
                                     'cause' in error && 
                                     (error as { cause?: { code?: string } }).cause?.code === 'ENOTFOUND'

            let waitTime: number
            if (isRateLimit) {
                // Use retry-after header if available
                waitTime = getRetryAfterMs(error)
                console.log(`[Claude] Rate limited - waiting ${Math.round(waitTime / 1000)}s before retry`)
            } else if (isConnectionError) {
                // DNS/Connection errors need longer waits to resolve
                waitTime = Math.min(30000 * attempt, 60000) // 30s, 60s, 60s
                console.log(`[Claude] Connection error (DNS/Network) - waiting ${Math.round(waitTime / 1000)}s before retry`)
            } else {
                // Standard exponential backoff for other errors
                waitTime = Math.pow(2, attempt) * 1000
                console.log(`[Claude] Error - waiting ${waitTime}ms before retry...`)
            }

            // Send heartbeats while waiting (every 30 seconds for long waits)
            if (jobId && waitTime > 30000) {
                const heartbeatInterval = 30000
                const heartbeats = Math.floor(waitTime / heartbeatInterval)
                
                for (let i = 0; i < heartbeats; i++) {
                    await new Promise((resolve) => setTimeout(resolve, heartbeatInterval))
                    await sendHeartbeat(jobId, `Rate limited - waiting to retry (${i + 1}/${heartbeats})`)
                    console.log(`[Claude] Heartbeat sent (${i + 1}/${heartbeats})`)
                }
                
                // Wait remaining time
                const remaining = waitTime % heartbeatInterval
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining))
                }
            } else {
                await new Promise((resolve) => setTimeout(resolve, waitTime))
                if (jobId) {
                    await sendHeartbeat(jobId, 'Retrying Claude API call...')
                }
            }
        }
    }

    throw new Error('Unexpected error in callClaude')
}
