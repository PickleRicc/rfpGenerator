import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
    generateProposalOrchestratorFunction,
    preparationPhaseFunction,
    volumeGenerationFunction,
    consultantServiceFunction,
    finalAssemblyFunction,
    finalScoringFunction,
    handleVolumeIterationFunction,
    monitorStalledJobsFunction
} from '@/lib/inngest/functions/index'

// Create the Inngest serve handler with all functions
// Modular pipeline architecture with parallel execution
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        // Main orchestrator (event coordination only)
        generateProposalOrchestratorFunction,
        
        // Modular pipeline functions
        preparationPhaseFunction,
        volumeGenerationFunction,
        consultantServiceFunction,
        finalAssemblyFunction,
        finalScoringFunction,
        
        // Supporting functions
        handleVolumeIterationFunction,
        monitorStalledJobsFunction,
    ],
})

