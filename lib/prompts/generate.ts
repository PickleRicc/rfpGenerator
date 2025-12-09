/**
 * Micro-prompts for each proposal section
 * Each prompt generates ONE section quickly (under 2 minutes)
 * Avoids streaming requirement by keeping responses small
 */

import { NormalizedCompanyData } from '../utils/normalize-data'
import { RfpAnalysis } from './analyze-rfp'

// ============================================================================
// HTML SANITIZATION - Fix broken tables
// ============================================================================

/**
 * Fix common HTML table issues that cause formatting problems
 * - Ensures all tables are properly closed
 * - Removes section headers that got stuck inside table cells
 * - Balances table row and cell tags
 */
export function sanitizeHtmlContent(html: string): string {
    let result = html
    
    // Step 0: Strip markdown code fences that Claude sometimes outputs
    result = result.replace(/^```html?\s*/i, '')  // Remove opening ```html or ```
    result = result.replace(/```\s*$/i, '')       // Remove closing ```
    result = result.trim()
    
    // Step 1: Close any unclosed tables before h1/h2 tags
    // This catches cases where Claude forgets to close a table before starting a new section
    result = result.replace(/(<\/td>\s*<\/tr>\s*)(<h[12][^>]*>)/gi, '$1</tbody></table>\n\n$2')
    result = result.replace(/(<\/th>\s*<\/tr>\s*)(<h[12][^>]*>)/gi, '$1</thead></table>\n\n$2')
    
    // Step 2: Remove any h1/h2/h3 tags that appear inside table cells
    // This prevents section headers from being squeezed into narrow columns
    const headerInCellPattern = /<t[dh][^>]*>\s*(<h[123][^>]*>.*?<\/h[123]>)\s*<\/t[dh]>/gi
    result = result.replace(headerInCellPattern, '</td></tr></tbody></table>\n\n$1\n\n<table><tbody><tr><td>')
    
    // Step 3: Count opening and closing table tags and balance them
    const openTables = (result.match(/<table[^>]*>/gi) || []).length
    const closeTables = (result.match(/<\/table>/gi) || []).length
    
    if (openTables > closeTables) {
        // Add missing closing tags at the end
        for (let i = 0; i < openTables - closeTables; i++) {
            result += '\n</tbody></table>'
        }
    }
    
    // Step 4: Ensure tables have tbody if they have rows but no tbody
    result = result.replace(/<table([^>]*)>\s*<tr>/gi, '<table$1><tbody><tr>')
    result = result.replace(/<\/tr>\s*<\/table>/gi, '</tr></tbody></table>')
    
    // Step 5: Remove any completely empty table cells that might cause issues
    result = result.replace(/<td[^>]*>\s*<\/td>/gi, '<td>&nbsp;</td>')
    
    return result
}

// Helper to format company data for prompts
function formatCompanyContext(companyData: NormalizedCompanyData): string {
    const { company, pastPerformance, personnel, laborRates } = companyData
    
    return `
COMPANY: ${company.name}
- Type: ${company.business_type}
- DUNS: ${company.duns} | CAGE: ${company.cage_code} | UEI: ${company.uei}
- Founded: ${company.founded_year} | Employees: ${company.employee_count}
- Certifications: ${company.certifications.join(', ') || 'None'}
- Capabilities: ${company.capabilities_statement.substring(0, 500)}

PAST PERFORMANCE (${pastPerformance.length} contracts):
${pastPerformance.slice(0, 3).map(pp => 
    `- ${pp.project_name} (${pp.agency}): $${pp.contract_value.toLocaleString()}, ${pp.start_date} to ${pp.end_date}`
).join('\n')}

KEY PERSONNEL (${personnel.length} staff):
${personnel.slice(0, 5).map(p => 
    `- ${p.name}, ${p.title}: ${p.years_experience} years, ${p.clearance_level}`
).join('\n')}

LABOR RATES (${laborRates.length} categories):
${laborRates.slice(0, 5).map(r => `- ${r.category}: $${r.hourly_rate}/hr`).join('\n')}
`
}

// ============================================================================
// SECTION 1: EXECUTIVE SUMMARY
// ============================================================================

export function createExecutiveSummaryPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    return {
        system: `You are an expert government proposal writer. Generate professional HTML content with tables.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr> MUST have a closing </tr> tag  
- Every <td> and <th> MUST have closing tags
- NEVER put section headers (h1, h2, h3) inside table cells
- Complete ALL table content before moving to the next topic`,
        userPrompt: `Generate an EXECUTIVE SUMMARY (2-3 pages) for this RFP response.

RFP: ${rfpAnalysis.metadata.solicitationNum} - ${rfpAnalysis.metadata.title}
Agency: ${rfpAnalysis.metadata.agency}
Deadline: ${rfpAnalysis.metadata.deadline}

Key Requirements: ${rfpAnalysis.requirements.slice(0, 5).join('; ')}
Key Themes: ${rfpAnalysis.keyThemes.join(', ')}

${formatCompanyContext(companyData)}

Generate HTML with:
1. Opening paragraph showing understanding of agency mission
2. Company qualifications table (Requirement | Our Capability | Differentiator)
3. Our value proposition (2-3 paragraphs)
4. Past performance highlights table (Project | Agency | Value | Relevance)
5. Why choose us conclusion

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table>, <ul> tags. Start directly with content, no <html> wrapper.`
    }
}

// ============================================================================
// SECTION 2: TECHNICAL APPROACH
// ============================================================================

export function createTechnicalApproachPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const requirements = rfpAnalysis.requirements.length > 0 
        ? rfpAnalysis.requirements.map((r, i) => `${i+1}. ${r}`).join('\n')
        : '1. IT modernization\n2. Cloud migration\n3. Security compliance'

    return {
        system: `You are an expert government technical proposal writer. Generate professional HTML content.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr> MUST have a closing </tr> tag
- Every <td> and <th> MUST have closing tags
- NEVER put section headers inside table cells
- Complete ALL table rows before closing a table`,
        userPrompt: `Generate a TECHNICAL APPROACH section (8-10 pages) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}

REQUIREMENTS TO ADDRESS:
${requirements}

${formatCompanyContext(companyData)}

Generate HTML covering:
1. Technical Understanding (1 page)
   - Restate key requirements
   - Our understanding of agency needs

2. Technical Solution (5-6 pages)
   For each requirement, provide:
   - Our approach/methodology
   - Tools & technologies table
   - Implementation phases
   - Quality assurance approach

3. Technical Summary Table
   | Requirement | Our Solution | Key Technology | Timeline |

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table>, <ul> tags. Start directly with content.`
    }
}

// ============================================================================
// SECTION 3: MANAGEMENT APPROACH
// ============================================================================

export function createManagementApproachPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const { personnel } = companyData

    return {
        system: `You are an expert in federal program management. Generate professional HTML content.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr>, <td>, <th> MUST have closing tags
- NEVER put section headers inside table cells
- Complete ALL table content before starting new sections`,
        userPrompt: `Generate a MANAGEMENT APPROACH section (5-6 pages) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}

KEY PERSONNEL:
${personnel.map(p => `
- ${p.name}, ${p.title}
  Role: ${p.role} | Experience: ${p.years_experience} years | Clearance: ${p.clearance_level}
  Expertise: ${p.expertise}
  Certifications: ${p.certifications.join(', ') || 'None'}
`).join('\n')}

Generate HTML covering:
1. Project Management Methodology (1 page)
   - Agile/PMBOK framework
   - Project phases table

2. Organizational Structure (2 pages)
   - Org chart description
   - Roles & responsibilities table
   - Key personnel summaries

3. Risk Management (1 page)
   - Risk identification process
   - Top 5 risks table (Risk | Probability | Impact | Mitigation)

4. Quality Assurance (1 page)
   - QA framework
   - Quality metrics table

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table>, <ul> tags. Start directly with content.`
    }
}

// ============================================================================
// SECTION 4: PAST PERFORMANCE
// ============================================================================

export function createPastPerformancePrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const { pastPerformance, company } = companyData

    const ppDetails = pastPerformance.map((pp, i) => `
CONTRACT ${i+1}: ${pp.project_name}
- Agency: ${pp.agency}
- Contract #: ${pp.contract_number}
- Value: $${pp.contract_value.toLocaleString()}
- Period: ${pp.start_date} to ${pp.end_date}
- Scope: ${pp.scope}
- Results: ${pp.performance_summary}
- POC: ${pp.poc_name} (${pp.poc_email}, ${pp.poc_phone})
`).join('\n')

    return {
        system: `You are an expert at writing compelling past performance narratives. Generate professional HTML.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr>, <td>, <th> MUST have closing tags
- NEVER put section headers inside table cells`,
        userPrompt: `Generate a PAST PERFORMANCE section (4-5 pages) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}
Company: ${company.name}

PAST PERFORMANCE CONTRACTS:
${ppDetails || 'No past performance records - generate placeholder content for 3 relevant projects.'}

For EACH contract, generate:
1. Project Overview Table (Agency, Value, Period, Contract Type)
2. Scope & Objectives (2-3 paragraphs)
3. Results & Achievements with metrics
4. Relevance to current RFP
5. Customer Reference info

End with a Summary Table:
| Project | Agency | Value | Period | Key Outcomes | Relevance |

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table>, <ul> tags. Start directly with content.`
    }
}

// ============================================================================
// SECTION 5: PRICING
// ============================================================================

export function createPricingPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const { laborRates, company } = companyData

    const ratesText = laborRates.map(r => 
        `- ${r.category}: $${r.hourly_rate}/hour`
    ).join('\n')

    return {
        system: `You are an expert at federal contract pricing. Generate professional HTML with pricing tables.
        
CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr> MUST have a closing </tr> tag
- Every <td> and <th> MUST have closing tags
- NEVER put section headers (h1, h2, h3) inside table cells
- Complete ALL table content before moving to the next section`,
        userPrompt: `Generate a PRICING SUMMARY section (3-4 pages) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}
Company: ${company.name}

LABOR RATES:
${ratesText || 'Use standard GSA rates for IT labor categories'}

ASSUMPTIONS:
- Base Year + 4 Option Years (5 years total)
- 2080 hours per FTE per year
- 3% annual escalation
- Standard government indirect rates

Generate HTML covering:
1. Pricing Methodology (1 page)
   - Our approach to competitive pricing
   - Value proposition

2. Labor Rates Table
   | Category | Base Rate | Loaded Rate | OY1 | OY2 | OY3 | OY4 |

3. Staffing Plan Summary
   | Role | FTEs | Hours/Year | Annual Cost |

4. 5-Year Cost Summary Table
   | Period | Labor | Total | Cumulative |

5. Cost Control & Efficiencies (1 page)

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table>, <ul> tags. Start directly with content.`
    }
}

// ============================================================================
// SECTION 6: COMPLIANCE MATRIX
// ============================================================================

export function createComplianceMatrixPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const requirements = rfpAnalysis.requirements.length > 0 
        ? rfpAnalysis.requirements.map((r, i) => `REQ-${i+1}: ${r}`).join('\n')
        : 'REQ-1: Technical capability\nREQ-2: Management approach\nREQ-3: Past performance'

    return {
        system: `You are an expert at creating government proposal compliance matrices. Generate professional HTML tables.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr>, <td>, <th> MUST have closing tags
- NEVER put section headers inside table cells
- Complete the compliance matrix table FULLY before adding summary paragraphs`,
        userPrompt: `Generate a COMPLIANCE MATRIX (2-3 pages) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}
Company: ${companyData.company.name}

RFP REQUIREMENTS:
${requirements}

KEY THEMES: ${rfpAnalysis.keyThemes.join(', ')}

Generate HTML with a comprehensive compliance matrix table:

| Req ID | RFP Requirement | Proposal Section | Page Ref | Compliance Status | Notes |
|--------|-----------------|------------------|----------|-------------------|-------|

Include rows for:
1. All technical requirements from Section C
2. All evaluation factors from Section M  
3. Key personnel requirements
4. Security/clearance requirements
5. Reporting requirements
6. Quality assurance requirements

Compliance Status options: FULLY COMPLIANT, EXCEEDS, PARTIAL, N/A

After the main matrix, add:
1. A summary paragraph on overall compliance
2. Any exceptions or clarifications needed
3. Cross-reference to key differentiators

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table> tags. Start directly with content.`
    }
}

// ============================================================================
// SECTION 7: KEY PERSONNEL RESUMES
// ============================================================================

export function createKeyPersonnelResumesPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const { personnel } = companyData

    const personnelDetails = personnel.map((p, i) => `
PERSON ${i+1}: ${p.name}
- Current Title: ${p.title}
- Proposed Role: ${p.role}
- Years of Experience: ${p.years_experience}
- Security Clearance: ${p.clearance_level}
- Areas of Expertise: ${p.expertise}
- Certifications: ${p.certifications.join(', ') || 'None listed'}
- Resume Summary: ${p.resume_summary}
`).join('\n')

    return {
        system: `You are an expert at writing federal proposal resumes. Generate professional HTML resumes.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr>, <td>, <th> MUST have closing tags  
- NEVER put section headers inside table cells
- Complete each person's qualification table before moving to next content`,
        userPrompt: `Generate KEY PERSONNEL RESUMES (1 page per person) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}

PERSONNEL TO INCLUDE:
${personnelDetails || 'Generate 3 sample key personnel resumes for: Program Manager, Technical Lead, Security Engineer'}

For EACH person, generate a 1-page resume with:

1. Header with name, proposed role, and clearance level
2. Professional Summary (3-4 sentences)
3. Qualifications Summary Table:
   | Qualification | Details |
   |---------------|---------|
   | Years Experience | X years |
   | Education | Degree, School |
   | Clearance | Level |
   | Certifications | List |

4. Relevant Experience section (3-4 positions):
   - Job Title, Organization (Dates)
   - 3-4 bullet points of relevant accomplishments

5. Education & Certifications list

6. Relevance to This Contract paragraph

Add a page break between each resume using: <div style="page-break-after: always;"></div>

IMPORTANT: Close EVERY table with </table> before starting new content.
Use <h2>, <h3>, <p>, <table>, <ul> tags. Start directly with content.`
    }
}

// ============================================================================
// SECTION 8: APPENDICES
// ============================================================================

export function createAppendicesPrompt(
    rfpAnalysis: RfpAnalysis,
    companyData: NormalizedCompanyData
): { system: string; userPrompt: string } {
    const { company } = companyData

    return {
        system: `You are an expert at creating government proposal appendices. Generate professional HTML content.

CRITICAL HTML RULES:
- Every <table> MUST have a closing </table> tag
- Every <tr>, <td>, <th> MUST have closing tags
- NEVER put section headers inside table cells
- Complete each appendix table before the page break`,
        userPrompt: `Generate APPENDICES (3-4 pages) for this RFP.

RFP: ${rfpAnalysis.metadata.solicitationNum}
Agency: ${rfpAnalysis.metadata.agency}

COMPANY INFORMATION:
- Name: ${company.name}
- Business Type: ${company.business_type}
- DUNS: ${company.duns}
- CAGE Code: ${company.cage_code}
- UEI: ${company.uei}
- Address: ${company.address.street}, ${company.address.city}, ${company.address.state} ${company.address.zip}
- Certifications: ${company.certifications.join(', ') || 'None'}
- NAICS Codes: ${company.naics_codes.map(n => n.code + ' - ' + n.description).join('; ')}
- Founded: ${company.founded_year}
- Employees: ${company.employee_count}
- Annual Revenue: $${company.annual_revenue?.toLocaleString() || 'N/A'}

Generate HTML for these appendices:

APPENDIX A: COMPANY INFORMATION
- Company profile table
- Business classifications and set-asides
- Corporate structure description

APPENDIX B: CERTIFICATIONS & ACCREDITATIONS
- Table of all certifications (Certification | Issuing Body | Date | Expiration)
- Description of quality management system
- Security certifications if applicable

APPENDIX C: NAICS CODES & CAPABILITIES
- Table of NAICS codes with descriptions
- Size standards compliance

APPENDIX D: REFERENCES
- Table format: Reference Name | Organization | Phone | Email | Contract Value

APPENDIX E: REQUIRED REPRESENTATIONS
- Standard FAR representations checklist
- Small business status
- Conflict of interest statement

End the document with a brief "END OF PROPOSAL" statement.

CRITICAL REQUIREMENTS:
1. Generate ALL 5 appendices completely - do not stop early
2. Close EVERY table with </table> before page breaks or new appendices
3. Complete all bullet point lists - never leave empty bullets
4. End with a clear closing statement

Use <h2>, <h3>, <p>, <table>, <ul> tags. Add page breaks between appendices.`
    }
}
