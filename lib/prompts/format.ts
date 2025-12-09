/**
 * Prompt 3: Format and Polish (Optional - can also be done locally)
 * Light formatting pass for final HTML assembly
 * Target: ~30 seconds (or instant if done locally)
 */

import { NormalizedCompanyData } from '../utils/normalize-data'
import { RfpAnalysis } from './analyze-rfp'

/**
 * Assemble final HTML document locally (NO Claude call needed)
 * This is much faster than using Claude for assembly
 */
export function assembleProposalHtml(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData,
    generatedContent: string
): string {
    const { company } = companyData
    const { metadata } = rfpAnalysis
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proposal - ${metadata.solicitationNum} - ${company.name}</title>
    <style>
        /* Reset */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        /* Body - NO margins/padding, Puppeteer handles page margins */
        body {
            font-family: 'Times New Roman', Georgia, serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
            width: 100%;
        }
        
        /* Headings - Left aligned */
        h1 {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 20pt;
            margin-bottom: 12pt;
            border-bottom: 2px solid #2c5282;
            padding-bottom: 6pt;
            color: #1a365d;
            page-break-before: always;
            text-align: left;
        }
        
        h1:first-of-type {
            page-break-before: avoid;
            margin-top: 0;
        }
        
        h2 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 16pt;
            margin-bottom: 8pt;
            color: #2c5282;
            text-align: left;
        }
        
        h3 {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
            color: #4a5568;
            text-align: left;
        }
        
        /* Paragraphs */
        p {
            margin-bottom: 10pt;
            text-align: justify;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
        }
        
        /* Lists */
        ul, ol {
            margin-bottom: 10pt;
            margin-left: 20pt;
            padding-left: 0;
            text-align: left;
        }
        
        li {
            margin-bottom: 4pt;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        /* Tables - Fixed layout to prevent overflow */
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 12pt 0;
            font-size: 9pt;
            table-layout: fixed;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        th, td {
            padding: 6pt 8pt;
            border: 1px solid #999;
            vertical-align: top;
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
        }
        
        th {
            background-color: #2c5282;
            color: white;
            font-weight: bold;
            font-size: 9pt;
        }
        
        td {
            background-color: #fff;
        }
        
        tr:nth-child(even) td {
            background-color: #f5f5f5;
        }
        
        /* Cover Page */
        .cover-page {
            text-align: center;
            padding: 80pt 40pt;
            page-break-after: always;
            min-height: 100vh;
        }
        
        .cover-page h1 {
            font-size: 22pt;
            border: none;
            margin: 16pt 0;
            page-break-before: avoid;
            text-align: center;
            color: #1a365d;
        }
        
        .cover-page h2 {
            font-size: 16pt;
            margin: 12pt 0;
            text-align: center;
            color: #2c5282;
        }
        
        .cover-page .subtitle {
            font-size: 14pt;
            color: #4a5568;
            margin: 8pt 0;
        }
        
        .cover-page .company-info {
            margin-top: 50pt;
            font-size: 12pt;
            line-height: 1.8;
        }
        
        .cover-page .date {
            margin-top: 40pt;
            font-size: 11pt;
            color: #666;
        }
        
        /* Table of Contents */
        .toc {
            page-break-after: always;
            padding: 20pt 0;
        }
        
        .toc h1 {
            page-break-before: avoid;
            text-align: left;
            margin-bottom: 20pt;
        }
        
        .toc-entry {
            display: flex;
            justify-content: space-between;
            padding: 6pt 0;
            border-bottom: 1px dotted #999;
            font-size: 11pt;
        }
        
        .toc-entry span:first-child {
            flex: 1;
        }
        
        .toc-entry span:last-child {
            width: 40pt;
            text-align: right;
        }
        
        /* Print styles */
        @media print {
            body {
                width: 100%;
            }
            
            h1 {
                page-break-before: always;
                page-break-after: avoid;
            }
            
            h1:first-of-type {
                page-break-before: avoid;
            }
            
            h2, h3 {
                page-break-after: avoid;
            }
            
            table {
                page-break-inside: auto;
            }
            
            tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            
            thead {
                display: table-header-group;
            }
            
            tfoot {
                display: table-footer-group;
            }
        }
        
        /* Page break utility */
        .page-break {
            page-break-after: always;
        }
    </style>
</head>
<body>

<!-- Cover Page -->
<div class="cover-page">
    <h1>TECHNICAL AND PRICE PROPOSAL</h1>
    <div class="subtitle">In Response To</div>
    <h2>${metadata.solicitationNum}</h2>
    <div class="subtitle">${metadata.title || 'Government Contract Solicitation'}</div>
    <div class="subtitle">Submitted To</div>
    <h2>${metadata.agency}</h2>
    
    <div class="company-info">
        <strong>${company.name}</strong><br>
        ${company.address.street}<br>
        ${company.address.city}, ${company.address.state} ${company.address.zip}<br><br>
        DUNS: ${company.duns} | CAGE: ${company.cage_code} | UEI: ${company.uei}<br>
        Business Type: ${company.business_type}
    </div>
    
    <div class="date">
        Submitted: ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}<br>
        Deadline: ${metadata.deadline}
    </div>
</div>

<!-- Table of Contents -->
<div class="toc">
    <h1>TABLE OF CONTENTS</h1>
    <div class="toc-entry"><span>Section 1.0 - Executive Summary</span><span>3</span></div>
    <div class="toc-entry"><span>Section 2.0 - Technical Approach</span><span>6</span></div>
    <div class="toc-entry"><span>Section 3.0 - Management Approach</span><span>18</span></div>
    <div class="toc-entry"><span>Section 4.0 - Past Performance</span><span>26</span></div>
    <div class="toc-entry"><span>Section 5.0 - Pricing Summary</span><span>34</span></div>
    <div class="toc-entry"><span>Section 6.0 - Compliance Matrix</span><span>40</span></div>
    <div class="toc-entry"><span>Section 7.0 - Key Personnel Resumes</span><span>44</span></div>
    <div class="toc-entry"><span>Section 8.0 - Appendices</span><span>52</span></div>
</div>

<!-- Generated Proposal Content -->
${generatedContent}

<!-- Document Footer -->
<div style="margin-top: 60pt; padding-top: 20pt; border-top: 2px solid #2c5282; text-align: center;">
    <p style="font-size: 10pt; color: #4a5568; margin-bottom: 8pt;">
        <strong>END OF PROPOSAL</strong>
    </p>
    <p style="font-size: 9pt; color: #718096;">
        ${company.name} | ${metadata.solicitationNum} | Submitted: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </p>
    <p style="font-size: 8pt; color: #a0aec0; margin-top: 12pt;">
        This proposal contains proprietary and confidential information.<br>
        Unauthorized disclosure or reproduction is prohibited.
    </p>
</div>

</body>
</html>`
}

/**
 * Extract a rough page count estimate from HTML content
 */
export function estimatePageCount(html: string): number {
    // Rough estimate: ~2500 characters per page for formatted HTML
    const textLength = html.replace(/<[^>]*>/g, '').length
    return Math.max(1, Math.round(textLength / 2500))
}

/**
 * Extract contract value mentions from content
 */
export function extractContractValue(content: string): string {
    const matches = content.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|M|billion|B))?/gi)
    if (matches && matches.length > 0) {
        // Return the largest value found
        return matches[matches.length - 1]
    }
    return 'TBD'
}
