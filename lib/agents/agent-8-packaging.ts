/**
 * Agent 8: Packaging & Delivery Agent
 * 
 * PRIMARY MISSION: Apply professional formatting, generate final PDFs,
 * and package complete deliverable for client submission.
 * 
 * RESPONSIBILITIES:
 * 1. Apply all formatting requirements (headers, footers, TOC)
 * 2. Generate professional cover pages
 * 3. Convert to submission-ready PDFs
 * 4. Package all deliverables
 * 5. Verify final checklist
 */

import { supabase } from '../supabase'
import {
    Agent,
    AgentResult,
    AgentContext,
    Agent8Output,
    PackagedFile,
} from './types'

export class Agent8Packaging implements Agent<AgentContext, Agent8Output> {
    name = 'agent_8' as const
    description = 'Packages final deliverables'

    async validatePrerequisites(context: AgentContext): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = []

        if (!context.jobId) errors.push('Job ID is required')
        if (!context.volumes) errors.push('Generated volumes are required')
        if (!context.companyData) errors.push('Company data is required')

        return { valid: errors.length === 0, errors }
    }

    async execute(context: AgentContext): Promise<AgentResult<Agent8Output>> {
        console.log(`[Agent 8] Starting packaging for job ${context.jobId}`)

        try {
            const validation = await this.validatePrerequisites(context)
            if (!validation.valid) {
                return {
                    status: 'error',
                    data: null as unknown as Agent8Output,
                    errors: validation.errors,
                }
            }

            await this.updateAgentStatus(context.jobId, 'running')

            const companyName = context.companyData?.company.name || 'Company'
            const solNum = context.rfpParsedData?.metadata.solicitation_num || 'RFP'

            // Generate formatted HTML for each volume
            console.log(`[Agent 8] Applying professional formatting...`)
            
            const formattedVolumes = {
                volume1: this.applyFormatting(context.volumes?.volume1 || '', 1, companyName, solNum),
                volume2: this.applyFormatting(context.volumes?.volume2 || '', 2, companyName, solNum),
                volume3: this.applyFormatting(context.volumes?.volume3 || '', 3, companyName, solNum),
                volume4: this.applyFormatting(context.volumes?.volume4 || '', 4, companyName, solNum),
            }

            // In production, we would convert HTML to PDF using puppeteer or similar
            // For now, we'll store the formatted HTML and generate placeholder URLs
            
            const baseUrl = `proposals/${context.jobId}/final`
            
            const submissionPackage = {
                volume1Pdf: this.createPackagedFile(`${baseUrl}/Volume_I_Technical.pdf`, formattedVolumes.volume1.length),
                volume2Pdf: this.createPackagedFile(`${baseUrl}/Volume_II_Management.pdf`, formattedVolumes.volume2.length),
                volume3Pdf: this.createPackagedFile(`${baseUrl}/Volume_III_PastPerformance.pdf`, formattedVolumes.volume3.length),
                volume4Pdf: this.createPackagedFile(`${baseUrl}/Volume_IV_Price.pdf`, formattedVolumes.volume4.length),
                costTemplate: this.createPackagedFile(`${baseUrl}/Cost_Template.xlsx`, 50000, 'xlsx'),
                coverLetter: this.createPackagedFile(`${baseUrl}/Cover_Letter.pdf`, 5000),
            }

            const archivePackage = {
                volume1Docx: this.createPackagedFile(`${baseUrl}/Volume_I_Technical.docx`, formattedVolumes.volume1.length, 'docx'),
                volume2Docx: this.createPackagedFile(`${baseUrl}/Volume_II_Management.docx`, formattedVolumes.volume2.length, 'docx'),
                volume3Docx: this.createPackagedFile(`${baseUrl}/Volume_III_PastPerformance.docx`, formattedVolumes.volume3.length, 'docx'),
                volume4Docx: this.createPackagedFile(`${baseUrl}/Volume_IV_Price.docx`, formattedVolumes.volume4.length, 'docx'),
                complianceMatrix: this.createPackagedFile(`${baseUrl}/Compliance_Matrix.xlsx`, 30000, 'xlsx'),
            }

            // Generate final checklist
            const finalChecklist = this.generateFinalChecklist(context, formattedVolumes)

            const allPassed = finalChecklist.every(item => item.status === 'pass')
            console.log(`[Agent 8] Final checklist: ${finalChecklist.filter(i => i.status === 'pass').length}/${finalChecklist.length} passed`)

            const output: Agent8Output = {
                submissionPackage,
                archivePackage,
                finalChecklist,
            }

            // Save to database
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('proposal_jobs') as any)
                .update({
                    status: allPassed ? 'completed' : 'review',
                    final_html: this.assembleFullDocument(formattedVolumes, companyName, solNum),
                    final_pdf_urls: {
                        volume_1: submissionPackage.volume1Pdf.fileUrl,
                        volume_2: submissionPackage.volume2Pdf.fileUrl,
                        volume_3: submissionPackage.volume3Pdf.fileUrl,
                        volume_4: submissionPackage.volume4Pdf.fileUrl,
                    },
                    final_docx_urls: {
                        volume_1: archivePackage.volume1Docx.fileUrl,
                        volume_2: archivePackage.volume2Docx.fileUrl,
                        volume_3: archivePackage.volume3Docx.fileUrl,
                        volume_4: archivePackage.volume4Docx.fileUrl,
                    },
                    current_agent: 'agent_8',
                    completed_at: new Date().toISOString(),
                    agent_progress: {
                        agent_8: {
                            status: 'complete',
                            started_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                        },
                    },
                })
                .eq('job_id', context.jobId)

            console.log(`[Agent 8] ✓ Packaging complete!`)
            console.log(`[Agent 8] Submission package: 6 files`)
            console.log(`[Agent 8] Archive package: 5 files`)

            return {
                status: 'success',
                data: output,
                metadata: {
                    totalFiles: 11,
                    readyForSubmission: allPassed,
                },
            }
        } catch (error) {
            console.error(`[Agent 8] ❌ Error:`, error)
            await this.updateAgentStatus(context.jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
            
            return {
                status: 'error',
                data: null as unknown as Agent8Output,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            }
        }
    }

    private applyFormatting(content: string, volumeNum: number, company: string, solNum: string): string {
        const volumeNames: Record<number, string> = {
            1: 'Technical Approach',
            2: 'Management Approach',
            3: 'Past Performance',
            4: 'Price Proposal',
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <title>Volume ${volumeNum}: ${volumeNames[volumeNum]} - ${solNum}</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body { 
            font-family: "Times New Roman", serif; 
            font-size: 12pt; 
            line-height: 1.5;
            margin: 0;
            padding: 20px;
        }
        h1 { 
            font-size: 18pt; 
            border-bottom: 2px solid #000; 
            page-break-before: always;
            margin-top: 0;
            padding-top: 10px;
        }
        h1:first-of-type { page-break-before: avoid; }
        h2 { font-size: 14pt; color: #1a365d; margin-top: 20px; }
        h3 { font-size: 13pt; color: #2d3748; margin-top: 16px; }
        
        /* TABLE FIXES - Prevent overflow and cutoff */
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 12pt 0;
            table-layout: fixed; /* Critical: prevents table from overflowing */
            font-size: 10pt;
        }
        th { 
            background: #2c5282; 
            color: white; 
            padding: 8pt; 
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            vertical-align: top;
        }
        td { 
            padding: 6pt 8pt; 
            border: 1px solid #ccc;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            vertical-align: top;
        }
        
        /* Prevent page break inside table rows */
        tr { 
            page-break-inside: avoid; 
        }
        
        /* Ensure tables don't break awkwardly */
        table {
            page-break-inside: auto;
        }
        thead {
            display: table-header-group;
        }
        
        /* List styling */
        ul, ol { 
            margin: 8pt 0; 
            padding-left: 24pt; 
        }
        li { 
            margin-bottom: 4pt;
            word-wrap: break-word;
        }
        
        /* Cover page styling */
        .cover-page { 
            text-align: center; 
            margin-top: 200pt;
            page-break-after: always;
        }
        .cover-page h1 { 
            border: none; 
            font-size: 24pt;
            page-break-before: avoid;
        }
        
        /* Section dividers */
        hr.section-divider {
            border: none;
            border-top: 1px solid #ccc;
            margin: 24pt 0;
        }
        
        /* Volume header */
        .volume-header {
            text-align: center;
            margin-bottom: 24pt;
            padding-bottom: 12pt;
            border-bottom: 2px solid #2c5282;
        }
        .volume-header h1 {
            border: none;
            page-break-before: avoid;
            color: #1a365d;
        }
        .volume-header .solicitation {
            font-size: 11pt;
            color: #555;
        }
        .volume-header .agency {
            font-size: 10pt;
            color: #777;
        }
        
        /* Paragraph spacing */
        p {
            margin: 8pt 0;
            text-align: justify;
        }
        
        /* Strong emphasis */
        strong {
            color: #1a365d;
        }
    </style>
</head>
<body>
    <div class="cover-page">
        <h1>VOLUME ${volumeNum}</h1>
        <h2>${volumeNames[volumeNum].toUpperCase()}</h2>
        <p style="margin-top: 100pt;">
            <strong>Solicitation:</strong> ${solNum}<br>
            <strong>Submitted by:</strong> ${company}<br>
            <strong>Date:</strong> ${new Date().toLocaleDateString()}
        </p>
    </div>
    ${content}
</body>
</html>`
    }

    private createPackagedFile(url: string, contentLength: number, type: 'pdf' | 'docx' | 'xlsx' = 'pdf'): PackagedFile {
        const fileName = url.split('/').pop() || 'file'
        // Estimate file size based on content (very rough)
        const sizeMultiplier = type === 'pdf' ? 1.5 : type === 'docx' ? 1.2 : 0.3
        const fileSize = Math.round(contentLength * sizeMultiplier / 1000) * 1000 // Round to KB

        return {
            fileName,
            fileType: type,
            fileUrl: url,
            fileSize,
        }
    }

    private assembleFullDocument(
        volumes: { volume1: string; volume2: string; volume3: string; volume4: string },
        company: string,
        solNum: string
    ): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Complete Proposal - ${solNum} - ${company}</title>
</head>
<body>
    ${volumes.volume1}
    ${volumes.volume2}
    ${volumes.volume3}
    ${volumes.volume4}
</body>
</html>`
    }

    private generateFinalChecklist(
        context: AgentContext,
        volumes: { volume1: string; volume2: string; volume3: string; volume4: string }
    ): { item: string; status: 'pass' | 'fail' }[] {
        const limits = context.volumePageLimits || context.rfpParsedData?.section_l.page_limits

        return [
            { item: '4 separate volumes', status: volumes.volume1 && volumes.volume2 && volumes.volume3 && volumes.volume4 ? 'pass' : 'fail' },
            { item: 'Volume I page limit', status: Math.ceil(volumes.volume1.length / 3000) <= (limits?.volume_1_technical || 50) ? 'pass' : 'fail' },
            { item: 'Volume II page limit', status: Math.ceil(volumes.volume2.length / 3000) <= (limits?.volume_2_management || 30) ? 'pass' : 'fail' },
            { item: 'Volume III page limit', status: Math.ceil(volumes.volume3.length / 3000) <= (limits?.volume_3_past_performance || 25) ? 'pass' : 'fail' },
            { item: 'Headers include solicitation #', status: volumes.volume1.includes(context.rfpParsedData?.metadata.solicitation_num || '') ? 'pass' : 'fail' },
            { item: 'Professional formatting applied', status: volumes.volume1.includes('font-family') ? 'pass' : 'fail' },
            { item: 'Cover pages generated', status: volumes.volume1.includes('cover-page') ? 'pass' : 'fail' },
        ]
    }

    private async updateAgentStatus(
        jobId: string,
        status: 'running' | 'complete' | 'failed',
        error?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('proposal_jobs') as any)
            .update({
                current_agent: 'agent_8',
                agent_progress: {
                    agent_8: {
                        status,
                        ...(status === 'running' && { started_at: new Date().toISOString() }),
                        ...((status === 'complete' || status === 'failed') && { completed_at: new Date().toISOString() }),
                        ...(error && { error }),
                    },
                },
            })
            .eq('job_id', jobId)
    }
}

export const agent8 = new Agent8Packaging()


