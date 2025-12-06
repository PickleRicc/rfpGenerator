import { Company, PastPerformance, Personnel, LaborRate, RfpMetadata } from './database.types'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CompanyData {
    company: Company
    pastPerformance: PastPerformance[]
    personnel: Personnel[]
    laborRates: LaborRate[]
}

export interface RfpExtractionResult {
    metadata: {
        agency: string
        solicitationNum: string
        deadline: string
    }
    sectionL: {
        volumes: Array<{ name: string; pageLimit: number }>
        formatting: { font: string; margins: string }
    }
    sectionM: {
        factors: Array<{ name: string; weight: number }>
    }
    sectionC: {
        requirements: string[]
    }
    sectionB: {
        clins: Array<{ clin: string; description: string; quantity: string }>
    }
}

export interface PromptResult {
    system: string
    userPrompt: string
}

export interface GeneratedSections {
    executiveSummary: string
    technicalApproach: string
    managementApproach: string
    pastPerformanceVolume: string
    complianceMatrix: string
    coverAndToc: string
    pricing: string
    appendices: string
}

// ============================================================================
// PROMPT 1: RFP DATA EXTRACTION
// ============================================================================

export function createRfpExtractionPrompt(rfpText: string): PromptResult {
    return {
        system: `You are an expert at extracting structured data from government RFPs. Return only valid JSON with no markdown.`,
        userPrompt: `Extract the following data from this RFP and return ONLY as valid JSON:

{
  "metadata": {
    "agency": "agency name",
    "solicitationNum": "solicitation number",
    "deadline": "deadline with time and timezone"
  },
  "sectionL": {
    "volumes": [{"name": "volume name", "pageLimit": number}],
    "formatting": {"font": "font requirements", "margins": "margin requirements"}
  },
  "sectionM": {
    "factors": [{"name": "evaluation factor", "weight": percentage}]
  },
  "sectionC": {
    "requirements": ["task 1 full text", "task 2 full text", "...all tasks"]
  },
  "sectionB": {
    "clins": [{"clin": "number", "description": "desc", "quantity": "qty"}]
  }
}

RFP TEXT:
${rfpText}`
    }
}

// ============================================================================
// PROMPT 2: EXECUTIVE SUMMARY
// ============================================================================

export function createExecutiveSummaryPrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData
): PromptResult {
    const { company, pastPerformance, personnel } = companyData
    const topPersonnel = personnel.slice(0, 3)

    const pastPerformanceText = pastPerformance
        .map(
            (pp) =>
                `${pp.project_name} - ${pp.agency}: $${pp.contract_value.toLocaleString()} (${pp.start_date} to ${pp.end_date})
Performance: ${pp.performance_summary}`
        )
        .join('\n\n')

    const personnelText = topPersonnel
        .map(
            (p) =>
                `${p.name}, ${p.title}: ${p.years_experience} years, Clearance: ${p.clearance_level}
Expertise: ${p.expertise}, Certs: ${p.certifications.join(', ')}`
        )
        .join('\n\n')

    return {
        system: `You are an expert government proposal writer. Use tables to organize information clearly.`,
        userPrompt: `RFP: ${rfpData.metadata.solicitationNum} for ${rfpData.metadata.agency}, Deadline: ${rfpData.metadata.deadline}

COMPANY:
Name: ${company.name}
Type: ${company.business_type}
Certifications: ${company.certifications.join(', ')}
DUNS: ${company.duns}, CAGE: ${company.cage_code}
Employees: ${company.employee_count}, Founded: ${company.founded_year}
Capabilities: ${company.capabilities_statement}

PAST PERFORMANCE (${pastPerformance.length} contracts):
${pastPerformanceText}

KEY PERSONNEL (top ${topPersonnel.length}):
${personnelText}

Generate 3-page Executive Summary with:

1. UNDERSTANDING (1 page)
   - Agency mission alignment
   - RFP objectives summary
   - Key challenges identified

2. VALUE PROPOSITION (1 page)
   - Company qualifications table:
     | Requirement | Our Capability | Differentiator |
   - Emphasize ${company.business_type} status
   - Highlight certifications

3. APPROACH OVERVIEW (1 page)
   - Technical approach summary
   - Management structure
   - Past performance table:
     | Project | Agency | Value | Key Results | Relevance |
   - Include quantifiable achievements (%, $, time)

Use professional tone. Return as HTML with h1/h2/h3 and tables.`
    }
}

// ============================================================================
// PROMPT 3: TECHNICAL APPROACH (ALL 9 TASKS)
// ============================================================================

export function createTechnicalApproachPrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData
): PromptResult {
    const { company, pastPerformance, personnel } = companyData
    const requirements = rfpData.sectionC?.requirements || []

    // Build task list
    const tasksText = requirements
        .map((req, idx) => `Task ${idx + 1}: ${req}`)
        .join('\n')

    // Filter for technical personnel (with null safety)
    const technicalRoles = ['architect', 'developer', 'engineer', 'technical', 'software', 'cloud', 'security', 'devops']
    const technicalPersonnel = personnel.filter((p) =>
        technicalRoles.some((role) => 
            (p.role?.toLowerCase()?.includes(role) || false) || 
            (p.title?.toLowerCase()?.includes(role) || false)
        )
    )

    const technicalPersonnelText = technicalPersonnel
        .map((p) => `${p.name}, ${p.title}: ${p.expertise}, ${p.certifications.join(', ')}, ${p.years_experience} years`)
        .join('\n')

    const pastPerformanceText = pastPerformance
        .map((pp) => `${pp.project_name}: ${pp.scope} - ${pp.performance_summary}`)
        .join('\n\n')

    return {
        system: `You are an expert government proposal technical writer. Use tables extensively.`,
        userPrompt: `RFP TASKS (${requirements.length} total from Section C):
${tasksText || 'No specific tasks extracted - generate standard IT modernization tasks'}

COMPANY: ${company.capabilities_statement}

PAST PERFORMANCE (relevant projects):
${pastPerformanceText || 'No past performance records available'}

TECHNICAL PERSONNEL:
${technicalPersonnelText || 'Technical staff details not provided'}

Generate 50-page Technical Approach addressing ALL tasks.

For EACH task, provide:

**TASK [X]: [Task Name]**

1. UNDERSTANDING (0.5 pages)
   - Restate requirement
   - Key objectives

2. TECHNICAL SOLUTION (3 pages)
   - Detailed methodology
   - Tools/technologies table:
     | Component | Technology | Version | Rationale |
   - Implementation phases table:
     | Phase | Duration | Activities | Deliverables | Dependencies |
   - Architecture/design approach
   - Integration strategy

3. TECHNICAL DETAILS (1.5 pages)
   - Specific configurations
   - Data flows
   - Security controls
   - Performance optimization

4. QUALITY ASSURANCE (0.5 pages)
   - Testing approach
   - Validation criteria
   - Success metrics table:
     | Metric | Target | Measurement |

5. RISKS & MITIGATION (0.5 pages)
   - Risk table:
     | Risk | Likelihood | Impact | Mitigation | Contingency |

6. RELEVANT EXPERIENCE (0.5 pages)
   - Reference specific past projects
   - Quantifiable results
   - Lessons applied

After all tasks, add:

**TECHNICAL SUMMARY TABLE**
| Task | Approach | Key Technologies | Timeline | Lead Personnel |

Return as HTML with extensive tables throughout. Each task should be 5-6 pages.`
    }
}

// ============================================================================
// PROMPT 4: MANAGEMENT APPROACH (ALL 5 SECTIONS)
// ============================================================================

export function createManagementApproachPrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData
): PromptResult {
    const { personnel, laborRates } = companyData

    // Find management weight from evaluation factors
    const managementFactor = rfpData.sectionM?.factors?.find(
        (f) => f.name?.toLowerCase()?.includes('management')
    )
    const managementWeight = managementFactor?.weight || 'Not specified'

    // Find Program Manager (with null safety)
    const pm = personnel.find(
        (p) =>
            (p.role?.toLowerCase()?.includes('program manager') || false) ||
            (p.title?.toLowerCase()?.includes('program manager') || false)
    )

    const evaluationFactorsText = rfpData.sectionM?.factors
        ?.map((f) => `${f.name}: ${f.weight}%`)
        .join('\n') || 'Not specified'

    const personnelText = personnel
        .map((p) => `${p.name}, ${p.role}: ${p.years_experience} years experience, Clearance: ${p.clearance_level}`)
        .join('\n')

    const laborRatesText = laborRates
        .map((lr) => `${lr.category}: $${lr.hourly_rate}/hour`)
        .join('\n')

    const clinsText = rfpData.sectionB?.clins
        ?.map((c) => `CLIN ${c.clin}: ${c.description} (Qty: ${c.quantity})`)
        .join('\n') || 'Not specified'

    return {
        system: `You are an expert in federal program management. Use comprehensive tables.`,
        userPrompt: `RFP: Management weighted at ${managementWeight}%
EVALUATION FACTORS:
${evaluationFactorsText}

PROGRAM MANAGER:
${pm ? `Name: ${pm.name}, Experience: ${pm.years_experience} years
Certifications: ${pm.certifications.join(', ')}
Resume: ${pm.resume_summary}` : 'Program Manager details not provided'}

ALL PERSONNEL:
${personnelText || 'Personnel details not provided'}

LABOR RATES & CLINS:
${laborRatesText || 'Labor rates not provided'}
${clinsText}

Generate 30-page Management Approach covering ALL 5 sections:

---

**SECTION 1: PROJECT MANAGEMENT METHODOLOGY (6 pages)**

1.1 Framework
   - Agile/Scrum for federal projects
   - PMBOK alignment
   - Framework table:
     | PMBOK Area | Our Approach | Tools | Deliverables |

1.2 Schedule Management
   - IMS development
   - 2-week sprints
   - Project phases table:
     | Phase | Duration | Milestones | Dependencies | Resources |
   - Critical path methodology

1.3 Earned Value Management
   - EVM metrics table:
     | Metric | Formula | Threshold | Action |
   - Monthly reporting format
   - Variance analysis

1.4 Risk & Issue Management
   - Risk process table:
     | Step | Activity | Frequency | Owner | Tool |
   - Issue escalation matrix

1.5 Change Control
   - CCB structure
   - Change request workflow table

1.6 Communications
   - Communication matrix:
     | Stakeholder | Type | Frequency | Format | Owner |
   - Meeting agendas

---

**SECTION 2: ORGANIZATIONAL STRUCTURE & STAFFING (8 pages)**

2.1 Organization Chart
   - Reporting hierarchy table:
     | Role | Reports To | Direct Reports |

2.2 Staffing Plan
   - Full staffing matrix:
     | Labor Category | CLIN | FTEs | Rate | Annual Cost | Clearance |
   - Phase staffing table:
     | Phase | Month 1 | Month 2 | Month 3 | ... | Total FTEs |

2.3 Key Personnel Resumes (3 detailed resumes)
   
   Include detailed resume format for each key person with:
   - Education table with degree, institution, year
   - Certifications list
   - Experience summary
   - Relevant Projects table with project, role, duration, achievements
   - Role on This Contract

2.4 Labor Category Descriptions
   | Category | Qualifications | Duties | Min Education | Clearance |

2.5 Transition & Onboarding
   - 30-60-90 day plan table

---

**SECTION 3: RISK MANAGEMENT (5 pages)**

3.1 Risk Framework
   - Process table:
     | Process | Description | Frequency | Tools | Owner |

3.2 Risk Assessment Matrix
   - Probability scale table (1-5)
   - Impact scale table (1-5)
   - Risk scoring methodology

3.3 Program Risk Register (Top 10 Risks)
   Comprehensive table:
   | ID | Risk | Category | Prob | Impact | Score | Mitigation | Contingency | Owner | Status |
   
   Include risks across:
   - Technical, Schedule, Budget, Security, Operational

3.4 Risk Monitoring
   - Monitoring schedule table:
     | Activity | Frequency | Participants | Deliverable |

---

**SECTION 4: QUALITY ASSURANCE (6 pages)**

4.1 QA Framework
   - Framework table:
     | Component | Standard | Implementation | Metrics |

4.2 Quality Control
   - QC activities table:
     | Process | Frequency | Criteria | Tools | Owner |

4.3 Testing Strategy
   - Comprehensive testing table:
     | Test Level | Scope | Approach | Tools | Entry | Exit | Owner |
   (Include: Unit, Integration, System, UAT, Security, Performance)

4.4 Defect Management
   - Defect lifecycle table:
     | Severity | Response Time | Resolution Time | Escalation |

4.5 Quality Metrics
   - KPI table:
     | Metric | Target | Measurement | Frequency | Threshold |

---

**SECTION 5: COMMUNICATIONS & REPORTING (5 pages)**

5.1 Communication Matrix
   | Stakeholder | Type | Purpose | Frequency | Method | Format | Owner |

5.2 Meeting Structures
   - Weekly Status Meeting agenda table
   - Monthly Executive Review structure table

5.3 Monthly Progress Report Format
   - Report sections table:
     | Section | Content | Pages | Frequency |
   - Include EVM metrics (BCWS, BCWP, ACWP, SV, CV, SPI, CPI)

5.4 Escalation Procedures
   | Level | Response Time | Escalation To | Method | Authority |

5.5 Collaboration Tools
   - Tools table:
     | Tool | Purpose | Users | Access Level |

Return as HTML with extensive tables. Total 30 pages.`
    }
}

// ============================================================================
// PROMPT 5: PAST PERFORMANCE VOLUME (ALL 5 CONTRACTS)
// ============================================================================

export function createPastPerformancePrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData
): PromptResult {
    const { pastPerformance } = companyData

    const contractsText = pastPerformance
        .map(
            (pp, idx) => `Contract ${idx + 1}:
{
  "project_name": "${pp.project_name}",
  "agency": "${pp.agency}",
  "contract_number": "${pp.contract_number}",
  "contract_value": ${pp.contract_value},
  "start_date": "${pp.start_date}",
  "end_date": "${pp.end_date}",
  "scope": "${pp.scope}",
  "performance_summary": "${pp.performance_summary}",
  "poc_name": "${pp.poc_name}",
  "poc_email": "${pp.poc_email}",
  "poc_phone": "${pp.poc_phone}"
}`
        )
        .join('\n\n')

    const requirementsSummary = rfpData.sectionC?.requirements?.slice(0, 3).join('; ') || 'IT modernization and cloud services'

    return {
        system: `You are an expert at writing compelling past performance case studies. Use tables for structured data.`,
        userPrompt: `ALL PAST PERFORMANCE CONTRACTS (${pastPerformance.length} total):

${contractsText || 'No past performance contracts available - generate sample case studies'}

CURRENT RFP:
Solicitation: ${rfpData.metadata.solicitationNum}
Agency: ${rfpData.metadata.agency}
Requirements: ${requirementsSummary}

Generate 25-page Past Performance Volume with detailed case study for EACH contract.

---

For EACH of the contracts, create 5-page case study:

**CONTRACT [X]: [project_name]**

**1. PROJECT OVERVIEW (1 page)**

Basic Information Table:
| Field | Details |
|-------|---------|
| Contract Number | [contract_number] |
| Agency | [agency] |
| Contract Value | $[contract_value] |
| Period of Performance | [start_date] to [end_date] |
| Contract Type | [infer from data] |
| NAICS Code | [if available] |

Scope Summary:
[scope]

Key Objectives:
- [Extract 3-5 objectives from scope]

**2. TECHNICAL APPROACH (1.5 pages)**

Solutions Implemented:
[Detailed technical solutions from scope and performance_summary]

Technologies Used:
| Technology | Purpose | Outcome |

Technical Challenges & Solutions:
| Challenge | Solution Applied | Result |

**3. PROJECT MANAGEMENT (0.5 pages)**

Management Approach:
[Extract management details]

Performance Metrics:
| Metric | Target | Achieved |
| On-time Delivery | 100% | [from performance_summary] |
| On-budget | 100% | [from performance_summary] |
| Quality | [standard] | [achieved] |

**4. RESULTS & ACHIEVEMENTS (1.5 pages)**

Quantifiable Outcomes:
[Extract specific numbers, percentages, cost savings from performance_summary]

Results Table:
| Category | Achievement | Business Impact |
| Cost | [savings/avoidance] | [impact] |
| Schedule | [early/on-time] | [impact] |
| Performance | [improvements] | [impact] |
| Quality | [ratings/metrics] | [impact] |

Awards & Recognition:
[Any awards mentioned in performance_summary]

Customer Satisfaction:
[Extract satisfaction data]

**5. RELEVANCE TO CURRENT RFP (0.5 pages)**

Relevance Analysis Table:
| RFP Requirement | How This Project Addresses It | Transferable Experience |

Similarities:
- Agency type: [compare agencies]
- Technical scope: [compare technical requirements]
- Contract size: [compare values]
- Complexity: [compare complexity factors]

Lessons Learned Applied:
- [Key lesson 1] → [How it benefits current RFP]
- [Key lesson 2] → [How it benefits current RFP]
- [Key lesson 3] → [How it benefits current RFP]

**6. CUSTOMER REFERENCE**

Point of Contact Table:
| Field | Information |
|-------|-------------|
| Name | [poc_name] |
| Title | [poc title if available] |
| Email | [poc_email] |
| Phone | [poc_phone] |
| Relationship | [role during contract] |

---

After all case studies, add:

**PAST PERFORMANCE SUMMARY TABLE**
| Project | Agency | Value | Period | Relevance Score | Key Outcomes |

Return as HTML with comprehensive tables. Each contract = 5 pages, total 25 pages.`
    }
}

// ============================================================================
// PROMPT 6: COMPLIANCE MATRIX
// ============================================================================

export function createComplianceMatrixPrompt(
    rfpData: RfpExtractionResult
): PromptResult {
    const volumesText = rfpData.sectionL?.volumes
        ?.map((v) => `${v.name}: ${v.pageLimit} pages`)
        .join('\n') || 'Not specified'

    const factorsText = rfpData.sectionM?.factors
        ?.map((f) => `${f.name}: ${f.weight}%`)
        .join('\n') || 'Not specified'

    const tasksText = rfpData.sectionC?.requirements
        ?.map((req, idx) => `Task ${idx + 1}: ${req}`)
        .join('\n') || 'Not specified'

    const clinsText = rfpData.sectionB?.clins
        ?.map((c) => `CLIN ${c.clin}: ${c.description} (Qty: ${c.quantity})`)
        .join('\n') || 'Not specified'

    return {
        system: `You are an expert at creating comprehensive compliance matrices for government proposals.`,
        userPrompt: `RFP REQUIREMENTS:

SECTION L - VOLUMES:
${volumesText}

SECTION L - FORMATTING:
Font: ${rfpData.sectionL?.formatting?.font || 'Times New Roman 12pt'}
Margins: ${rfpData.sectionL?.formatting?.margins || '1 inch all sides'}

SECTION M - EVALUATION FACTORS:
${factorsText}

SECTION C - REQUIREMENTS (All Tasks):
${tasksText}

SECTION B - CLINS:
${clinsText}

Generate comprehensive Compliance Matrix as HTML table.

Create large table with columns:
| RFP Section | Requirement ID | Requirement Description | Compliance Status | Proposal Section Reference | Page Number | Notes |

Include rows for:

**SECTION L REQUIREMENTS:**
- Volume I page limit | Fully Compliant | Volume I | Pages 1-50 | [actual pages]
- Volume II page limit | Fully Compliant | Volume II | Pages 51-80 | [actual pages]
- Volume III page limit | Fully Compliant | Volume III | Pages 81-105 | [actual pages]
- Volume IV page limit | Fully Compliant | Volume IV | Pages 106-110 | [actual pages]
- Font requirement | Fully Compliant | All volumes | All pages | [font used]
- Margins requirement | Fully Compliant | All volumes | All pages | [margins used]

**SECTION M REQUIREMENTS:**
For each evaluation factor:
- [Factor name] ([weight]%) | Fully Compliant | [Corresponding volume] | Pages [X-Y] | Comprehensive response provided

**SECTION C REQUIREMENTS:**
For each task:
- Task [X]: [Brief task description] | Fully Compliant | Volume I, Task [X] | Pages [X-Y] | Detailed technical approach, methodology, and relevant experience provided

**SECTION B REQUIREMENTS:**
For each CLIN:
- CLIN [number]: [description] | Fully Compliant | Volume II Staffing Plan + Volume IV Pricing | Pages [X-Y] | [Quantity] FTEs proposed, labor rates provided

**CROSS-REFERENCES:**
Add additional rows for any cross-cutting requirements:
- Security requirements | Fully Compliant | Volume I Task 6, Volume II Section 4 | Pages [X-Y] | FedRAMP authorization approach
- Past performance | Fully Compliant | Volume III | Pages [X-Y] | 5 relevant contracts provided
- Key personnel | Fully Compliant | Volume II Section 2.3 | Pages [X-Y] | 3 detailed resumes included

Use professional table formatting with borders, proper alignment, and alternating row colors for readability.

Return as HTML table only.`
    }
}

// ============================================================================
// PROMPT 7: COVER PAGE & TABLE OF CONTENTS
// ============================================================================

export function createCoverAndTocPrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData
): PromptResult {
    const { company, pastPerformance } = companyData

    const volumesText = rfpData.sectionL?.volumes
        ?.map((v) => `${v.name}: ${v.pageLimit} pages`)
        .join('\n') || 'Volume I: Technical, Volume II: Management, Volume III: Past Performance, Volume IV: Pricing'

    const projectNames = pastPerformance.map((pp) => pp.project_name)

    return {
        system: `You are an expert at creating professional government proposal cover pages and tables of contents.`,
        userPrompt: `RFP: ${rfpData.metadata.solicitationNum}
AGENCY: ${rfpData.metadata.agency}
DEADLINE: ${rfpData.metadata.deadline}

COMPANY:
Name: ${company.name}
Address: ${JSON.stringify(company.address)}
DUNS: ${company.duns}
CAGE Code: ${company.cage_code}
UEI: ${company.uei}
Business Type: ${company.business_type}

VOLUMES REQUIRED:
${volumesText}

PAST PERFORMANCE PROJECT NAMES:
${projectNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

Generate professional Cover Page and Table of Contents.

**COVER PAGE**
Create centered, professional layout:

[COMPANY LOGO PLACEHOLDER]

TECHNICAL PROPOSAL

IN RESPONSE TO

${rfpData.metadata.solicitationNum}
[Full RFP title if extractable]

FOR

${rfpData.metadata.agency}

SUBMITTED BY

${company.name}
${company.address.street}
${company.address.city}, ${company.address.state} ${company.address.zip}

DUNS: ${company.duns}
CAGE Code: ${company.cage_code}
UEI: ${company.uei}
Business Classification: ${company.business_type}

SUBMITTED: [Current date]
DEADLINE: ${rfpData.metadata.deadline}

**TABLE OF CONTENTS**

VOLUME I: TECHNICAL APPROACH

Executive Summary.............................1
1.0 Understanding of Requirements..............4
2.0 Technical Approach........................10
    2.1 Task 1: [Task Name]...................11
    2.2 Task 2: [Task Name]...................17
    2.3 Task 3: [Task Name]...................23
    2.4 Task 4: [Task Name]...................29
    2.5 Task 5: [Task Name]...................35
    2.6 Task 6: [Task Name]...................40
    2.7 Task 7: [Task Name]...................46
    2.8 Task 8: [Task Name]...................52
    2.9 Task 9: [Task Name]...................57

VOLUME II: MANAGEMENT APPROACH

3.0 Management Approach.......................63
    3.1 Project Management Methodology........64
    3.2 Organizational Structure & Staffing...70
    3.3 Risk Management......................78
    3.4 Quality Assurance....................83
    3.5 Communications & Reporting...........89

VOLUME III: PAST PERFORMANCE

4.0 Past Performance.........................95
${projectNames.map((name, idx) => `    4.${idx + 1} Contract ${idx + 1}: ${name}........${96 + idx * 5}`).join('\n')}
    4.6 Past Performance Summary Table.......121

VOLUME IV: PRICE PROPOSAL

5.0 Pricing..................................122
    5.1 Pricing Summary Table................123
    5.2 Labor Rates by Category..............124
    5.3 CLIN Breakdown.......................125
    5.4 Pricing Narrative....................127

APPENDICES

Appendix A: Compliance Matrix................128
Appendix B: Key Personnel Resumes............135
Appendix C: Company Certifications...........145

Return as HTML with professional styling.`
    }
}

// ============================================================================
// PROMPT 8: PRICING VOLUME
// ============================================================================

export function createPricingPrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData
): PromptResult {
    const { laborRates } = companyData

    const clinsText = rfpData.sectionB?.clins
        ?.map((c) => `CLIN ${c.clin}: ${c.description} (Qty: ${c.quantity})`)
        .join('\n') || 'CLINs not specified'

    const laborRatesText = laborRates
        .map((lr) => `${lr.category}: $${lr.hourly_rate}/hour`)
        .join('\n')

    return {
        system: `You are an expert at creating federal contract pricing proposals with accurate calculations.`,
        userPrompt: `CLINS FROM RFP:
${clinsText}

LABOR RATES:
${laborRatesText || 'Labor rates not specified - use industry standard rates'}

STAFFING REQUIREMENTS:
Based on Technical Approach, estimated staffing:
- Program Management: 2 FTEs
- Cloud Architecture: 4 FTEs
- Software Development: 6 FTEs
- Cybersecurity: 3 FTEs
- Data Engineering: 2 FTEs
- DevOps: 2 FTEs
- Training: 1 FTE

CONTRACT PERIOD: Base year + 4 option years (5 years total)
HOURS PER FTE: 2080 hours/year

Generate complete Pricing Volume (10-15 pages).

**1. PRICING SUMMARY (1 page)**

Total Contract Value Table:
| Period | Value | Cumulative |
|--------|-------|------------|
| Base Year | $[calculated] | $[calculated] |
| Option Year 1 | $[calculated] | $[calculated] |
| Option Year 2 | $[calculated] | $[calculated] |
| Option Year 3 | $[calculated] | $[calculated] |
| Option Year 4 | $[calculated] | $[calculated] |
| **TOTAL** | **$[total]** | - |

**2. LABOR RATES (2 pages)**

Fully Burdened Labor Rates Table:
| Labor Category | Base Hourly Rate | Fringe (30%) | Overhead (40%) | G&A (15%) | Profit (10%) | Fully Loaded Rate |
|----------------|------------------|--------------|----------------|-----------|--------------|-------------------|
| [category 1] | $[rate] | $[calc] | $[calc] | $[calc] | $[calc] | $[total] |
[...all labor categories]

Rate Escalation:
- Base Year: Rates as shown
- Option Years: 3% annual escalation

Escalation Table:
| Labor Category | Base | OY1 (+3%) | OY2 (+3%) | OY3 (+3%) | OY4 (+3%) |

**3. CLIN BREAKDOWN (4 pages)**

For each CLIN:

**CLIN [number]: [description]**

Staffing Table:
| Labor Category | FTEs | Hours/Year | Rate | Annual Cost |
|----------------|------|------------|------|-------------|
| [category] | [FTEs] | [hours] | $[rate] | $[cost] |
| **TOTAL** | **[total FTEs]** | **[total hours]** | - | **$[total]** |

5-Year Cost Table:
| Period | Hours | Avg Rate | Cost |
|--------|-------|----------|------|
| Base Year | [hours] | $[rate] | $[cost] |
| Option Year 1 | [hours] | $[rate+3%] | $[cost] |
| Option Year 2 | [hours] | $[rate+6%] | $[cost] |
| Option Year 3 | [hours] | $[rate+9%] | $[cost] |
| Option Year 4 | [hours] | $[rate+12%] | $[cost] |
| **TOTAL** | **[total]** | - | **$[total]** |

[Repeat for all CLINs]

**4. BASIS OF ESTIMATE (2 pages)**

Assumptions Table:
| Assumption | Value | Rationale |
|------------|-------|-----------|
| Work Year | 2080 hours | Standard government work year |
| Fringe Rate | 30% | Health, retirement, leave, taxes |
| Overhead | 40% | Facilities, equipment, indirect staff |
| G&A | 15% | Corporate management, admin |
| Profit | 10% | Industry standard for complexity |
| Escalation | 3% annual | Historical federal wage growth |

Staffing Rationale:
[Explain why each FTE count is appropriate based on technical approach]

**5. PRICING NARRATIVE (2 pages)**

Explain:
- Competitive pricing strategy
- Value proposition
- Cost control measures
- Why rates are fair and reasonable
- Comparison to GSA schedules or similar contracts (if applicable)

Cost Savings Approaches:
| Approach | Annual Savings | 5-Year Savings |
|----------|----------------|----------------|
| Automation | $[amount] | $[amount] |
| Process efficiency | $[amount] | $[amount] |
| Cloud optimization | $[amount] | $[amount] |
| **TOTAL** | **$[amount]** | **$[amount]** |

**6. SUMMARY TABLES**

Total Price by CLIN (All Years):
| CLIN | Description | Base | OY1 | OY2 | OY3 | OY4 | Total |

Total Price by Labor Category (All Years):
| Category | Total Hours | Avg Rate | Total Cost |

Return as HTML with extensive tables and clear calculations.`
    }
}

// ============================================================================
// PROMPT 9: APPENDICES (CERTIFICATIONS & REPRESENTATIONS)
// ============================================================================

export function createAppendicesPrompt(
    companyData: CompanyData
): PromptResult {
    const { company, pastPerformance } = companyData

    const pastPerfRefsText = pastPerformance
        .map(
            (pp) =>
                `| ${company.name} | ${pp.project_name} | ${pp.poc_name} | Contract POC | ${pp.poc_email} | ${pp.poc_phone} | $${pp.contract_value.toLocaleString()} | ${pp.start_date} - ${pp.end_date} |`
        )
        .join('\n')

    const naicsText = company.naics_codes
        ?.map(
            (n) => `| ${n.code} | ${n.description} | ${n.is_primary ? 'Primary' : 'Secondary'} |`
        )
        .join('\n') || '| Not specified | | |'

    return {
        system: `You are an expert at compiling proposal appendices with company documentation.`,
        userPrompt: `COMPANY DATA:
Name: ${company.name}
DUNS: ${company.duns}
CAGE Code: ${company.cage_code}
UEI: ${company.uei}
Business Type: ${company.business_type}
Certifications: ${company.certifications.join(', ')}
Founded: ${company.founded_year}
Employees: ${company.employee_count}
Annual Revenue: $${company.annual_revenue?.toLocaleString() || 'Not disclosed'}
Address: ${JSON.stringify(company.address)}
NAICS Codes: ${JSON.stringify(company.naics_codes)}

PAST PERFORMANCE REFERENCES:
${pastPerfRefsText}

Generate Appendices section (10-15 pages).

**APPENDIX A: COMPANY INFORMATION**

Company Profile Table:
| Field | Information |
|-------|-------------|
| Legal Name | ${company.name} |
| DBA | [if different] |
| DUNS Number | ${company.duns} |
| CAGE Code | ${company.cage_code} |
| UEI | ${company.uei} |
| Tax ID | [placeholder - to be provided] |
| Year Established | ${company.founded_year} |
| Employees | ${company.employee_count} |
| Annual Revenue | $${company.annual_revenue?.toLocaleString() || 'Not disclosed'} |

Business Classifications Table:
| Classification | Status | Certification Number | Expiration |
|----------------|--------|---------------------|------------|
| ${company.business_type} | Active | [if available] | [if available] |

Physical Address:
${company.address.street}
${company.address.city}, ${company.address.state} ${company.address.zip}

**APPENDIX B: CERTIFICATIONS**

${company.certifications.includes('ISO 9001') ? `ISO 9001:2015:
- Certification Number: [if available]
- Issue Date: [placeholder]
- Expiration: [placeholder]
- Scope: Quality management for IT services` : ''}

${company.certifications.some(c => c.includes('CMMI')) ? `CMMI Level 3:
- Appraisal Date: [placeholder]
- Lead Appraiser: [placeholder]
- Process Areas: Software Development, Project Management` : ''}

Create table summarizing all certifications:
| Certification | Issuing Body | Number | Issue Date | Expiration | Status |
${company.certifications.map(c => `| ${c} | [Issuing body] | [Number] | [Date] | [Expiration] | Active |`).join('\n')}

**APPENDIX C: NAICS CODES**

NAICS Codes Table:
| NAICS Code | Description | Primary/Secondary |
|------------|-------------|-------------------|
${naicsText}

**APPENDIX D: PAST PERFORMANCE REFERENCES**

Complete Reference Table:
| Company | Project | POC Name | POC Title | POC Email | POC Phone | Contract Value | Period |
|---------|---------|----------|-----------|-----------|-----------|----------------|--------|
${pastPerfRefsText}

**APPENDIX E: INSURANCE & BONDING**

Insurance Coverage Table:
| Type | Coverage Amount | Policy Number | Carrier | Expiration |
|------|----------------|---------------|---------|------------|
| General Liability | $1,000,000 | [placeholder] | [placeholder] | [placeholder] |
| Professional Liability | $2,000,000 | [placeholder] | [placeholder] | [placeholder] |
| Cyber Liability | $5,000,000 | [placeholder] | [placeholder] | [placeholder] |
| Workers Compensation | Per state requirements | [placeholder] | [placeholder] | [placeholder] |

Bonding Capacity:
- Bonding Company: [placeholder]
- Single Project Capacity: $10,000,000
- Aggregate Capacity: $25,000,000

**APPENDIX F: REPRESENTATIONS & CERTIFICATIONS**

Standard Form 1449/1442 Representations:
[Create checklist format]

${String(company.business_type || '').toLowerCase().includes('small') ? '☑' : '☐'} Small Business
${String(company.business_type || '').toLowerCase().includes('disadvantaged') ? '☑' : '☐'} Small Disadvantaged Business  
${String(company.business_type || '').toLowerCase().includes('women') ? '☑' : '☐'} Women-Owned Small Business
${String(company.business_type || '').toLowerCase().includes('veteran') ? '☑' : '☐'} Veteran-Owned Small Business
${String(company.business_type || '').toLowerCase().includes('service-disabled') ? '☑' : '☐'} Service-Disabled Veteran-Owned Small Business
${String(company.business_type || '').toLowerCase().includes('hubzone') ? '☑' : '☐'} HUBZone Small Business
${String(company.business_type || '').toLowerCase().includes('8(a)') ? '☑' : '☐'} 8(a) Program Participant

Additional Certifications:
☑ FAR 52.209-5 - Representation by Corporations Regarding Delinquent Tax Liability
☑ FAR 52.203-18 - Prohibition on Contracting with Entities Requiring Confidentiality Agreements
☑ FAR 52.204-26 - Covered Telecommunications Equipment or Services

Return as HTML with comprehensive tables.`
    }
}

// ============================================================================
// PROMPT 10: FINAL ASSEMBLY & FORMATTING
// ============================================================================

export function createFinalAssemblyPrompt(
    rfpData: RfpExtractionResult,
    companyData: CompanyData,
    sections: GeneratedSections
): PromptResult {
    const { company } = companyData

    const volumesText = rfpData.sectionL?.volumes
        ?.map((v) => `${v.name}: ${v.pageLimit} pages`)
        .join('\n') || 'Standard volumes'

    return {
        system: `You are an expert at assembling professional government proposals with proper formatting and styling.`,
        userPrompt: `You will receive all generated sections. Assemble them into single cohesive HTML document with professional styling.

FORMATTING REQUIREMENTS FROM RFP:
Font: ${rfpData.sectionL?.formatting?.font || 'Times New Roman, 12pt'}
Margins: ${rfpData.sectionL?.formatting?.margins || '1 inch all sides'}
Page Limits: 
${volumesText}

SECTIONS TO ASSEMBLE:
1. Cover Page & TOC
2. Executive Summary
3. Technical Approach (50 pages)
4. Management Approach (30 pages)
5. Past Performance (25 pages)
6. Pricing (15 pages)
7. Compliance Matrix
8. Appendices (15 pages)

GENERATED CONTENT:

--- COVER PAGE & TOC ---
${sections.coverAndToc}

--- EXECUTIVE SUMMARY ---
${sections.executiveSummary}

--- TECHNICAL APPROACH ---
${sections.technicalApproach}

--- MANAGEMENT APPROACH ---
${sections.managementApproach}

--- PAST PERFORMANCE ---
${sections.pastPerformanceVolume}

--- PRICING ---
${sections.pricing}

--- COMPLIANCE MATRIX ---
${sections.complianceMatrix}

--- APPENDICES ---
${sections.appendices}

Generate complete HTML document with this structure:

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Technical Proposal - ${rfpData.metadata.solicitationNum} - ${company.name}</title>
<style>
body {
  font-family: ${rfpData.sectionL?.formatting?.font?.split(',')[0] || 'Times New Roman'}, Arial, sans-serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #000;
  margin: 1in;
  max-width: 8.5in;
}

/* Headers */
h1 {
  font-size: 18pt;
  font-weight: bold;
  margin-top: 24pt;
  margin-bottom: 12pt;
  page-break-before: always;
  border-bottom: 2px solid #000;
  padding-bottom: 6pt;
}

h2 {
  font-size: 14pt;
  font-weight: bold;
  margin-top: 18pt;
  margin-bottom: 10pt;
  color: #1a1a1a;
}

h3 {
  font-size: 12pt;
  font-weight: bold;
  margin-top: 12pt;
  margin-bottom: 8pt;
  color: #333;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 12pt 0;
  font-size: 11pt;
}

th {
  background-color: #2c5282;
  color: white;
  font-weight: bold;
  padding: 8pt;
  text-align: left;
  border: 1px solid #1a365d;
}

td {
  padding: 6pt 8pt;
  border: 1px solid #ccc;
  vertical-align: top;
}

tr:nth-child(even) {
  background-color: #f7fafc;
}

/* Page breaks */
.page-break {
  page-break-after: always;
}

.volume-break {
  page-break-before: always;
  margin-top: 0;
}

/* Cover page */
.cover-page {
  text-align: center;
  margin-top: 100pt;
}

.cover-page h1 {
  border: none;
  font-size: 24pt;
  margin: 20pt 0;
}

/* Table of contents */
.toc {
  margin: 20pt 0;
}

.toc-entry {
  margin: 6pt 0;
  display: flex;
  justify-content: space-between;
}

.toc-dots {
  flex-grow: 1;
  border-bottom: 1px dotted #999;
  margin: 0 10pt;
}

/* Headers and footers */
.header {
  text-align: right;
  font-size: 10pt;
  color: #666;
  margin-bottom: 12pt;
  padding-bottom: 6pt;
  border-bottom: 1px solid #ccc;
}

.footer {
  text-align: center;
  font-size: 10pt;
  color: #666;
  margin-top: 24pt;
  padding-top: 6pt;
  border-top: 1px solid #ccc;
}

@media print {
  body { margin: 1in; }
  .page-break { page-break-after: always; }
  .volume-break { page-break-before: always; }
}
</style>
</head>
<body>

<!-- Insert Cover Page -->
[Cover Page HTML]

<div class="page-break"></div>

<!-- Insert Table of Contents -->
[TOC HTML]

<div class="page-break"></div>

<!-- Insert Executive Summary -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Executive Summary</div>
[Executive Summary HTML]
<div class="footer">Page 1-3</div>

<div class="page-break volume-break"></div>

<!-- Insert Technical Approach -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Volume I: Technical Approach</div>
<h1>VOLUME I: TECHNICAL APPROACH</h1>
[Technical Approach HTML]
<div class="footer">Pages 4-53</div>

<div class="page-break volume-break"></div>

<!-- Insert Management Approach -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Volume II: Management Approach</div>
<h1>VOLUME II: MANAGEMENT APPROACH</h1>
[Management Approach HTML]
<div class="footer">Pages 54-83</div>

<div class="page-break volume-break"></div>

<!-- Insert Past Performance -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Volume III: Past Performance</div>
<h1>VOLUME III: PAST PERFORMANCE</h1>
[Past Performance HTML]
<div class="footer">Pages 84-108</div>

<div class="page-break volume-break"></div>

<!-- Insert Pricing -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Volume IV: Price Proposal</div>
<h1>VOLUME IV: PRICE PROPOSAL</h1>
[Pricing HTML]
<div class="footer">Pages 109-123</div>

<div class="page-break volume-break"></div>

<!-- Insert Compliance Matrix -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Appendix A: Compliance Matrix</div>
<h1>APPENDIX A: COMPLIANCE MATRIX</h1>
[Compliance Matrix HTML]
<div class="footer">Pages 124-127</div>

<div class="page-break"></div>

<!-- Insert Appendices -->
<div class="header">${rfpData.metadata.solicitationNum} - ${company.name} - Appendices</div>
[Appendices HTML]
<div class="footer">Pages 128-142</div>

</body>
</html>

Ensure:
- All sections flow logically
- Page numbers are sequential
- Headers/footers on every page
- Tables are properly formatted
- Page breaks between major sections
- Professional appearance throughout
- Compliant with RFP formatting requirements

Return complete assembled HTML document.`
    }
}
