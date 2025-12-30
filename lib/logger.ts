/**
 * Centralized logging utility for the Multi-Agent RFP System
 * Provides consistent formatting and tracking of agent activity
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'agent'

interface AgentLogContext {
    jobId?: string
    agent?: string
    step?: string
    duration?: number
    data?: Record<string, unknown>
}

// ANSI color codes for terminal output
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Agent colors (each agent gets a unique color)
    agent_0: '\x1b[36m',  // Cyan - Volume Structure
    agent_1: '\x1b[34m',  // Blue - RFP Parser
    agent_2: '\x1b[33m',  // Yellow - Validation
    agent_3: '\x1b[35m',  // Magenta - Content Mapper
    agent_4: '\x1b[32m',  // Green - Writer
    agent_4a: '\x1b[32m', // Green variants
    agent_4b: '\x1b[92m',
    agent_4c: '\x1b[32m',
    agent_4d: '\x1b[92m',
    agent_5: '\x1b[31m',  // Red - Compliance
    agent_6: '\x1b[95m',  // Bright Magenta - Humanization
    agent_7: '\x1b[93m',  // Bright Yellow - Revision
    agent_8: '\x1b[96m',  // Bright Cyan - Packaging
    
    // Level colors
    info: '\x1b[37m',     // White
    warn: '\x1b[33m',     // Yellow
    error: '\x1b[31m',    // Red
    debug: '\x1b[90m',    // Gray
    agent: '\x1b[37m',    // White (for agent level logs)
}

const AGENT_NAMES: Record<string, string> = {
    agent_0: 'VOLUME-STRUCTURE',
    agent_1: 'RFP-PARSER',
    agent_2: 'VALIDATION',
    agent_3: 'CONTENT-MAPPER',
    agent_4: 'MASTER-WRITER',
    agent_4a: 'TECHNICAL-WRITER',
    agent_4b: 'MANAGEMENT-WRITER',
    agent_4c: 'PAST-PERF-WRITER',
    agent_4d: 'PRICING-WRITER',
    agent_5: 'COMPLIANCE-AUDIT',
    agent_6: 'HUMANIZATION',
    agent_7: 'REVISION',
    agent_8: 'PACKAGING',
}

const AGENT_ICONS: Record<string, string> = {
    agent_0: '📁',
    agent_1: '📄',
    agent_2: '✅',
    agent_3: '🗺️',
    agent_4: '✍️',
    agent_4a: '🔧',
    agent_4b: '📋',
    agent_4c: '🏆',
    agent_4d: '💰',
    agent_5: '🔍',
    agent_6: '🎨',
    agent_7: '🔄',
    agent_8: '📦',
}

function getTimestamp(): string {
    return new Date().toISOString().split('T')[1].split('.')[0]
}

function formatJobId(jobId?: string): string {
    if (!jobId) return ''
    return jobId.slice(0, 8)
}

function formatDuration(ms?: number): string {
    if (!ms) return ''
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

class Logger {
    private prefix: string
    private silent: boolean

    constructor(prefix: string = 'RFP', silent: boolean = false) {
        this.prefix = prefix
        this.silent = silent || process.env.NODE_ENV === 'test'
    }

    private log(level: LogLevel, message: string, context?: AgentLogContext): void {
        if (this.silent) return

        const timestamp = getTimestamp()
        const jobStr = context?.jobId ? `[${formatJobId(context.jobId)}]` : ''
        
        let agentStr = ''
        if (context?.agent) {
            const agentColor = COLORS[context.agent as keyof typeof COLORS] || COLORS.info
            const agentName = AGENT_NAMES[context.agent] || context.agent.toUpperCase()
            const agentIcon = AGENT_ICONS[context.agent] || '🤖'
            agentStr = `${agentColor}${agentIcon} [${agentName}]${COLORS.reset}`
        }

        const stepStr = context?.step ? `→ ${context.step}` : ''
        const durationStr = context?.duration ? `(${formatDuration(context.duration)})` : ''
        
        const levelColor = COLORS[level] || COLORS.info
        const levelStr = level === 'agent' ? '' : `${levelColor}[${level.toUpperCase()}]${COLORS.reset}`

        // Build the log line
        const parts = [
            `${COLORS.dim}${timestamp}${COLORS.reset}`,
            `${COLORS.bright}[${this.prefix}]${COLORS.reset}`,
            jobStr,
            agentStr,
            levelStr,
            message,
            stepStr,
            durationStr,
        ].filter(Boolean)

        console.log(parts.join(' '))

        // Log additional data if present
        if (context?.data && Object.keys(context.data).length > 0) {
            console.log(`${COLORS.dim}  └─ Data:${COLORS.reset}`, JSON.stringify(context.data, null, 2).split('\n').join('\n     '))
        }
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    info(message: string, context?: AgentLogContext): void {
        this.log('info', message, context)
    }

    warn(message: string, context?: AgentLogContext): void {
        this.log('warn', `⚠️  ${message}`, context)
    }

    error(message: string, context?: AgentLogContext): void {
        this.log('error', `❌ ${message}`, context)
    }

    debug(message: string, context?: AgentLogContext): void {
        if (process.env.DEBUG) {
            this.log('debug', message, context)
        }
    }

    // ==========================================================================
    // AGENT-SPECIFIC LOGGING
    // ==========================================================================

    agentStart(agentId: string, jobId: string, details?: string): void {
        const agentName = AGENT_NAMES[agentId] || agentId
        this.log('agent', `${COLORS.bright}▶ STARTING${COLORS.reset} ${details || ''}`, {
            jobId,
            agent: agentId,
        })
        console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`)
    }

    agentComplete(agentId: string, jobId: string, duration?: number, summary?: string): void {
        console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`)
        this.log('agent', `${COLORS.bright}✓ COMPLETED${COLORS.reset} ${summary || ''}`, {
            jobId,
            agent: agentId,
            duration,
        })
    }

    agentFailed(agentId: string, jobId: string, error: string): void {
        console.log(`${COLORS.dim}${'─'.repeat(60)}${COLORS.reset}`)
        this.log('error', `FAILED: ${error}`, {
            jobId,
            agent: agentId,
        })
    }

    agentBlocked(agentId: string, jobId: string, reason: string): void {
        this.log('warn', `⏸️  BLOCKED: ${reason}`, {
            jobId,
            agent: agentId,
        })
    }

    agentStep(agentId: string, jobId: string, step: string, data?: Record<string, unknown>): void {
        this.log('agent', '', {
            jobId,
            agent: agentId,
            step,
            data,
        })
    }

    // ==========================================================================
    // PIPELINE LOGGING
    // ==========================================================================

    pipelineStart(jobId: string, companyId: string): void {
        console.log('')
        console.log(`${COLORS.bright}${'═'.repeat(70)}${COLORS.reset}`)
        console.log(`${COLORS.bright}  🚀 MULTI-AGENT PROPOSAL PIPELINE STARTED${COLORS.reset}`)
        console.log(`${COLORS.dim}${'─'.repeat(70)}${COLORS.reset}`)
        console.log(`  Job ID:     ${jobId}`)
        console.log(`  Company ID: ${companyId}`)
        console.log(`  Started:    ${new Date().toISOString()}`)
        console.log(`${COLORS.bright}${'═'.repeat(70)}${COLORS.reset}`)
        console.log('')
    }

    pipelineComplete(jobId: string, totalDuration: number, complianceScore?: number): void {
        console.log('')
        console.log(`${COLORS.bright}${'═'.repeat(70)}${COLORS.reset}`)
        console.log(`${COLORS.bright}  ✅ PIPELINE COMPLETED SUCCESSFULLY${COLORS.reset}`)
        console.log(`${COLORS.dim}${'─'.repeat(70)}${COLORS.reset}`)
        console.log(`  Job ID:           ${jobId}`)
        console.log(`  Total Duration:   ${formatDuration(totalDuration)}`)
        if (complianceScore !== undefined) {
            console.log(`  Compliance Score: ${complianceScore}%`)
        }
        console.log(`  Completed:        ${new Date().toISOString()}`)
        console.log(`${COLORS.bright}${'═'.repeat(70)}${COLORS.reset}`)
        console.log('')
    }

    pipelineFailed(jobId: string, error: string, failedAgent?: string): void {
        console.log('')
        console.log(`${COLORS.error}${'═'.repeat(70)}${COLORS.reset}`)
        console.log(`${COLORS.error}  ❌ PIPELINE FAILED${COLORS.reset}`)
        console.log(`${COLORS.dim}${'─'.repeat(70)}${COLORS.reset}`)
        console.log(`  Job ID:       ${jobId}`)
        console.log(`  Failed Agent: ${failedAgent || 'Unknown'}`)
        console.log(`  Error:        ${error}`)
        console.log(`  Failed at:    ${new Date().toISOString()}`)
        console.log(`${COLORS.error}${'═'.repeat(70)}${COLORS.reset}`)
        console.log('')
    }

    pipelineBlocked(jobId: string, blockers: string[]): void {
        console.log('')
        console.log(`${COLORS.warn}${'═'.repeat(70)}${COLORS.reset}`)
        console.log(`${COLORS.warn}  ⚠️  PIPELINE BLOCKED - HUMAN ACTION REQUIRED${COLORS.reset}`)
        console.log(`${COLORS.dim}${'─'.repeat(70)}${COLORS.reset}`)
        console.log(`  Job ID: ${jobId}`)
        console.log(`  Blockers:`)
        blockers.forEach((b, i) => console.log(`    ${i + 1}. ${b}`))
        console.log(`${COLORS.warn}${'═'.repeat(70)}${COLORS.reset}`)
        console.log('')
    }

    // ==========================================================================
    // PROGRESS UPDATES
    // ==========================================================================

    progress(jobId: string, percent: number, message: string): void {
        const filled = Math.floor(percent / 5)
        const empty = 20 - filled
        const bar = `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
        console.log(`${COLORS.dim}${getTimestamp()}${COLORS.reset} [${this.prefix}] [${formatJobId(jobId)}] ${bar} ${percent}% - ${message}`)
    }
}

// Export singleton instance
export const logger = new Logger('RFP')

// Export for custom instances
export { Logger }
export type { AgentLogContext }












