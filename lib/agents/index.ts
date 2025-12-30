/**
 * Agent Exports
 * 
 * Central export file for all agents in the 8-agent RFP proposal system.
 */

// Types
export * from './types'

// Agent 0: Volume Structure Enforcer
export { Agent0VolumeStructure, agent0, validatePageCount } from './agent-0-volume-structure'

// Agent 1: RFP Intelligence Extractor
export { Agent1RfpParser, agent1 } from './agent-1-rfp-parser'

// Agent 2: Data Validation
export { Agent2Validation, agent2 } from './agent-2-validation'

// Agent 3: Content Architect
export { Agent3ContentMapper, agent3 } from './agent-3-content-mapper'

// Agent 4: Master Writing Coordinator
export { Agent4Coordinator, agent4 } from './agent-4-writer'

// Agent 5: Compliance Auditor
export { Agent5Compliance, agent5 } from './agent-5-compliance'

// Agent 8: Packaging
export { Agent8Packaging, agent8 } from './agent-8-packaging'

// New Volume-by-Volume Agents
export { AgentConsultant, agentConsultant } from './agent-consultant'
export { AgentRewriter, agentRewriter } from './agent-rewriter'

// Re-import for the agents map
import { agent0 as a0 } from './agent-0-volume-structure'
import { agent1 as a1 } from './agent-1-rfp-parser'
import { agent2 as a2 } from './agent-2-validation'
import { agent3 as a3 } from './agent-3-content-mapper'
import { agent4 as a4 } from './agent-4-writer'
import { agent5 as a5 } from './agent-5-compliance'
import { agent8 as a8 } from './agent-8-packaging'

// All agents map (Agent 6 & 7 removed in clean rebuild)
export const agents = {
    agent_0: a0,
    agent_1: a1,
    agent_2: a2,
    agent_3: a3,
    agent_4: a4,
    agent_5: a5,
    agent_8: a8,
} as const
