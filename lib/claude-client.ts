import Anthropic from '@anthropic-ai/sdk'

const apiKey = process.env.ANTHROPIC_API_KEY

if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable')
}

export const anthropic = new Anthropic({
    apiKey,
})

export interface ClaudeCallOptions {
    system: string
    userPrompt: string
    maxTokens?: number
    temperature?: number
}

/**
 * Simple, robust Claude API wrapper
 * Keeps max_tokens under 8000 to avoid streaming requirement
 */
export async function callClaude(
    options: ClaudeCallOptions,
    retries = 3
): Promise<string> {
    // Cap max_tokens at 8000 to avoid "streaming required" error
    const { system, userPrompt, maxTokens = 8000, temperature = 0.7 } = options
    const safeMaxTokens = Math.min(maxTokens, 8000)

    console.log(`[Claude] Starting API call (max_tokens: ${safeMaxTokens}, temp: ${temperature})`)
    console.log(`[Claude] System prompt: ${system.length} chars, User prompt: ${userPrompt.length} chars`)
    
    const startTime = Date.now()

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[Claude] Attempt ${attempt}/${retries}...`)
            
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

            // Extract text from content blocks
            const textContent = message.content
                .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                .map((block) => block.text)
                .join('\n')

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            console.log(`[Claude] ✓ Success in ${elapsed}s (${textContent.length} chars)`)
            console.log(`[Claude] Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`)

            return textContent
        } catch (error) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            console.error(`[Claude] ✗ Attempt ${attempt} failed after ${elapsed}s:`, error)

            if (attempt === retries) {
                throw new Error(`Claude API failed after ${retries} attempts: ${error}`)
            }

            // Shorter backoff for faster retries
            const waitTime = Math.pow(2, attempt) * 500
            console.log(`[Claude] Waiting ${waitTime}ms...`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
    }

    throw new Error('Unexpected error in callClaude')
}
