// Inngest exports
export { inngest, estimateGenerationTime, MAX_JOB_DURATION_MINUTES } from './client'
export { generateProposalFunction, monitorStalledJobs } from './functions'
export type { ProposalGenerationEvent, ProposalCancelEvent, ProposalEvents } from './client'

