# CLIENT INTAKE FORM - FEATURE REQUIREMENTS

## OVERVIEW
Comprehensive intake form that collects ALL data needed by Agent 2 to validate completeness before proposal generation begins. Prevents placeholder data, missing certifications, and unverifiable claims.

---

## FORM STRUCTURE

### **SECTION 1: COMPANY IDENTIFIERS** (Required for compliance)

**Fields:**
- [ ] Legal Business Name (text, required)
- [ ] DBA/Trading Name (text, optional)
- [ ] SAM.gov UEI Number (text, 12 chars, required, validated format)
- [ ] CAGE Code (text, 5 chars, required)
- [ ] DUNS Number (text, 9 chars, optional - legacy)
- [ ] Tax ID / EIN (text, 9 chars, required, format: XX-XXXXXXX)
- [ ] Business Structure (dropdown: LLC, S-Corp, C-Corp, Partnership, Sole Proprietor)
- [ ] Years in Business (number, required)
- [ ] Number of Employees (number, required)
- [ ] Annual Revenue (currency, required)
- [ ] Primary NAICS Code (text, 6 digits, required)
- [ ] Secondary NAICS Codes (text, multi-entry, optional)

**Set-Aside Certifications:**
- [ ] Small Business (checkbox + cert upload)
- [ ] 8(a) Business Development (checkbox + expiration date + cert upload)
- [ ] SDVOSB (checkbox + expiration date + cert upload)
- [ ] WOSB (checkbox + expiration date + cert upload)
- [ ] HUBZone (checkbox + expiration date + cert upload)

**Validation Rules:**
- UEI must NOT be "ABC123DEF456GH" or similar placeholder
- CAGE must NOT be "1A2B3" or 5 identical digits
- If cert checkbox selected, expiration date + upload REQUIRED
- Flag if expiration date < 90 days from today

---

### **SECTION 2: SECURITY & COMPLIANCE CERTIFICATIONS**

**Fields:**
- [ ] CMMC Level (dropdown: None, Level 1, Level 2, Level 3)
- [ ] CMMC Certification Number (text, if applicable)
- [ ] CMMC Expiration Date (date, if applicable)
- [ ] CMMC Certificate Upload (file, PDF only, if applicable)
- [ ] ISO 9001 (checkbox + cert number + expiration + upload)
- [ ] ISO 27001 (checkbox + cert number + expiration + upload)
- [ ] ISO 20000 (checkbox + cert number + expiration + upload)
- [ ] FedRAMP Authorized (dropdown: None, Low, Moderate, High)
- [ ] StateRAMP Authorized (checkbox + level)
- [ ] Other Certifications (repeatable: name + cert # + expiration + upload)

**Validation Rules:**
- If CMMC selected, ALL fields (number, date, upload) REQUIRED
- Flag if any cert expires within 6 months
- Verify upload is PDF and < 5MB

---

### **SECTION 3: PAST PERFORMANCE** (3-5 contracts minimum)

**For Each Contract (repeatable section):**

**Contract Details:**
- [ ] Contract Number (text, required)
- [ ] Contract Title (text, required)
- [ ] Customer Agency (text, required, e.g., "Department of Defense")
- [ ] Customer Office/Division (text, optional)
- [ ] Contract Type (dropdown: FFP, T&M, Cost-Plus, IDIQ, BPA)
- [ ] Contract Value (currency, required)
- [ ] Period of Performance Start (date, required)
- [ ] Period of Performance End (date, required)

**Point of Contact:**
- [ ] POC Name (text, required)
- [ ] POC Title (text, required)
- [ ] POC Phone (tel, required, format: XXX-XXX-XXXX)
- [ ] POC Email (email, required)
- [ ] POC Last Verified Date (date, required)

**Performance Data:**
- [ ] Scope Description (textarea, 500 chars, required)
- [ ] Relevance Tags (multi-select: Cloud, DoD, IL5, DevSecOps, Migration, Security, AI/ML, Data Analytics, Cybersecurity, Infrastructure)
- [ ] CPARS Rating (dropdown: Exceptional, Very Good, Satisfactory, Marginal, Unsatisfactory, N/A)
- [ ] CPARS Document Upload (file, PDF, if applicable)
- [ ] Customer Testimonial (textarea, 1000 chars, if no CPARS)

**Quantified Outcomes (at least 2 required):**
- [ ] Outcome 1 Metric (text, e.g., "Uptime percentage")
- [ ] Outcome 1 Value (text, e.g., "99.95%")
- [ ] Outcome 2 Metric (text, e.g., "Budget performance")
- [ ] Outcome 2 Value (text, e.g., "Delivered 5% under budget")
- [ ] Outcome 3 Metric (optional)
- [ ] Outcome 3 Value (optional)

**Validation Rules:**
- Minimum 3 contracts required for submission
- POC verified date must be < 6 months old (flag warning if older)
- Must have EITHER CPARS rating OR customer testimonial
- Must have at least 2 quantified outcomes per contract
- Flag if contract value seems unrealistic (e.g., $1B for 5-person company)

---

### **SECTION 4: KEY PERSONNEL** (4-6 people minimum)

**For Each Person (repeatable section):**

**Basic Info:**
- [ ] Full Name (text, required)
- [ ] Proposed Role (dropdown: Program Manager, Technical Lead, Security Lead, DevSecOps Lead, Cloud Architect, QA Lead, Other)
- [ ] Years of Relevant Experience (number, required)
- [ ] Availability (dropdown: Full-time, Part-time 50%, Part-time 25%, As-needed)
- [ ] Commitment Letter (checkbox: "Willing to work if contract awarded")

**Security Clearance:**
- [ ] Clearance Level (dropdown: None, Secret, Top Secret, TS/SCI)
- [ ] Investigation Date (date, if applicable)
- [ ] Clearance Status (dropdown: Active, Current, Expired, In Progress)

**Certifications:**
- [ ] Cert 1 Name (text, e.g., "PMP")
- [ ] Cert 1 Number (text)
- [ ] Cert 1 Expiration (date)
- [ ] Cert 2 Name (text, e.g., "CISSP")
- [ ] Cert 2 Number (text)
- [ ] Cert 2 Expiration (date)
- [ ] Additional Certs (repeatable: name + number + expiration)

**Resume:**
- [ ] Resume Upload (file, PDF/DOCX, required, < 2MB)
- [ ] Resume Last Updated (date, auto-populated from file metadata if possible)

**Validation Rules:**
- Minimum 4 personnel required
- Resume must be uploaded for all personnel
- Flag if resume is > 6 months old
- Flag if clearance status is "Expired" or "In Progress" for roles requiring active clearance
- Flag if cert expires < 90 days from today
- Verify PM has 10+ years if RFP requires it (manual flag for now)

---

### **SECTION 5: TECHNICAL CAPABILITIES**

**Cloud Platforms:**
- [ ] AWS (checkbox + certification level dropdown: None, Associate, Professional, Specialty)
- [ ] Azure (checkbox + certification level)
- [ ] Google Cloud (checkbox + certification level)
- [ ] Oracle Cloud (checkbox)
- [ ] IBM Cloud (checkbox)
- [ ] Other (text)

**Tools & Technologies (multi-select checkboxes):**

**Infrastructure as Code:**
- [ ] Terraform
- [ ] CloudFormation
- [ ] ARM Templates
- [ ] Pulumi
- [ ] Other (text)

**Container/Orchestration:**
- [ ] Docker
- [ ] Kubernetes
- [ ] OpenShift
- [ ] ECS/EKS
- [ ] Other (text)

**CI/CD:**
- [ ] GitLab
- [ ] Jenkins
- [ ] GitHub Actions
- [ ] Azure DevOps
- [ ] CircleCI
- [ ] Other (text)

**Security:**
- [ ] SIEM Tools (text, list)
- [ ] Vulnerability Scanners (text, list)
- [ ] CMMC Controls (text, list)

**Methodologies:**
- [ ] Agile (checkbox)
- [ ] SAFe (checkbox)
- [ ] DevSecOps (checkbox)
- [ ] ITIL (checkbox)
- [ ] Custom Framework (text, describe)

**Proprietary Tools/Accelerators:**
- [ ] Tool Name (text)
- [ ] Tool Description (textarea, 500 chars)
- [ ] Tool Benefits (textarea, 500 chars)

---

### **SECTION 6: LABOR RATES & PRICING**

**For Each Labor Category (repeatable section):**
- [ ] Labor Category Name (text, required, e.g., "Program Manager")
- [ ] Year 1 Rate (currency, fully burdened, required)
- [ ] Year 2 Rate (currency, auto-calculated with escalation)
- [ ] Year 3 Rate (currency, auto-calculated)
- [ ] Year 4 Rate (currency, auto-calculated)
- [ ] Year 5 Rate (currency, auto-calculated)

**Pricing Assumptions:**
- [ ] Escalation Rate (percentage, default 3%, required)
- [ ] Overhead Rate (percentage, required)
- [ ] G&A Rate (percentage, required)
- [ ] Fee/Profit Margin (percentage, required)
- [ ] Fringe Benefits Rate (percentage, required)

**Basis of Rates:**
- [ ] Rate Source (dropdown: GSA Schedule 70, Market Research, Historical Rates, Competitive Analysis)
- [ ] GSA Schedule Number (text, if applicable)
- [ ] Rate Justification (textarea, 500 chars, required)

**ODC Estimates:**
- [ ] Travel Budget (currency, optional)
- [ ] License Costs (currency, optional)
- [ ] Hardware/Equipment (currency, optional)
- [ ] Cloud Costs (currency, optional)
- [ ] Other ODCs (text + currency, repeatable)

**Validation Rules:**
- Flag if any rate < $50/hr or > $500/hr (seems unrealistic)
- Flag if rates don't align with GSA Schedule (if GSA selected)
- Calculate fully-burdened rate breakdown automatically

---

### **SECTION 7: FACILITIES & SUBCONTRACTORS**

**Facilities:**
- [ ] Primary Office Location (address, required)
- [ ] Additional Locations (address, repeatable)
- [ ] Security Clearance Facility Rating (dropdown: None, FCL Confidential, FCL Secret, FCL Top Secret)
- [ ] Existing Infrastructure (textarea, describe cloud accounts, tools, licenses)

**Subcontractors (if applicable):**

**For Each Sub (repeatable):**
- [ ] Subcontractor Name (text)
- [ ] Subcontractor CAGE Code (text, 5 chars)
- [ ] Subcontractor UEI (text, 12 chars)
- [ ] Small Business Status (dropdown: Large, Small, 8(a), SDVOSB, WOSB, HUBZone)
- [ ] Scope of Work (textarea, 500 chars)
- [ ] Percentage of Contract Value (percentage)
- [ ] Teaming Agreement Upload (file, PDF, if applicable)

---

## FORM BEHAVIOR & VALIDATION

### **Save States:**
1. **Draft:** Auto-save every 30 seconds, can return later
2. **Complete:** All required fields filled, ready for Agent 2 validation
3. **Validated:** Agent 2 approved, ready for proposal generation

### **Validation Triggers:**

**On Field Blur:**
- Format validation (UEI, CAGE, phone, email)
- Required field check

**On Section Complete:**
- Cross-field validation (e.g., if cert selected, upload required)
- Business rule validation (e.g., min 3 past performance contracts)

**On Form Submit:**
- Run Agent 2 validation script
- Generate validation report
- Block submission if BLOCKERS exist
- Allow submission with WARNINGS (but flag them)

### **Agent 2 Integration:**

**Validation Report Output:**
```
CLIENT: [Company Name]
INTAKE DATE: [Date]
STATUS: [COMPLETE / INCOMPLETE / HAS BLOCKERS]

BLOCKERS (must fix):
❌ PM only has 8 years (RFP requires 10+)
❌ Missing CMMC certification upload
❌ Only 2 past performance contracts (need 3 minimum)

WARNINGS (should fix):
⚠️ CISSP expires in 2 months
⚠️ Past performance POC verified 8 months ago (should be <6 months)
⚠️ Labor rate for Cloud Architect ($120) seems low vs. GSA Schedule ($175)

RECOMMENDATIONS:
✅ Update Past Performance POC contacts
✅ Renew expiring certifications before proposal submission
✅ Add 1 more past performance reference

READY FOR PROPOSAL: ✗
```

---

## UI/UX REQUIREMENTS

### **Progress Indicator:**
- Show 7 sections with checkmarks as completed
- Display % complete (e.g., "45% Complete - 3 of 7 sections")
- Highlight current section

### **Smart Defaults:**
- Pre-fill company data if exists in database
- Auto-calculate Year 2-5 labor rates based on escalation
- Auto-populate "Last Verified Date" to today when POC entered

### **Inline Help:**
- Tooltip on every field with example (e.g., "UEI Example: AB1C2D3EF4GH")
- Link to "Where do I find this?" documentation
- Show character count for text areas

### **File Upload:**
- Drag-and-drop interface
- Show file name + size after upload
- Preview button for PDFs
- Delete/replace option

### **Data Persistence:**
- Auto-save draft every 30 seconds (show "Saving..." indicator)
- "Save & Continue Later" button visible at all times
- "Resume" button on dashboard if draft exists

### **Validation Feedback:**
- Inline error messages in red below field
- Warning messages in yellow
- Success checkmarks in green
- Summary of errors at top of section

---

## DATABASE SCHEMA UPDATES

### **New Table: `client_intake`**
```sql
client_intake (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES companies(id),
  created_at timestamp,
  updated_at timestamp,
  status enum('draft', 'complete', 'validated', 'approved'),
  submitted_at timestamp,
  validated_at timestamp,
  validated_by_agent boolean DEFAULT false,
  validation_report jsonb,
  
  -- Section 1: Company Identifiers
  legal_name text,
  dba_name text,
  uei text,
  cage_code text,
  duns text,
  ein text,
  business_structure text,
  years_in_business integer,
  employee_count integer,
  annual_revenue numeric,
  primary_naics text,
  secondary_naics text[],
  certifications jsonb, -- {type, cert_number, expiration, file_url}[]
  
  -- Section 2: Security Certs
  security_certifications jsonb,
  
  -- Sections 3-7 stored in existing tables via foreign keys
  -- past_performance_ids uuid[],
  -- personnel_ids uuid[],
  -- labor_rate_ids uuid[]
)
```

### **Update Existing Tables:**

**`companies` table:**
- Add `intake_complete` boolean
- Add `last_intake_date` timestamp

**`past_performance` table:**
- Add `poc_verified_date` date
- Add `relevance_tags` text[]
- Add `quantified_outcomes` jsonb

**`personnel` table:**
- Add `commitment_letter` boolean
- Add `resume_updated_date` date
- Add `clearance_status` text

**`labor_rates` table:**
- Add `basis_of_rates` text
- Add `rate_justification` text

---

## ACCEPTANCE CRITERIA

✅ Form collects ALL data needed by Agent 2
✅ No field allows placeholder data (validated)
✅ Auto-save prevents data loss
✅ Validation runs before submission
✅ Agent 2 validation report displays clearly
✅ User can fix blockers and resubmit
✅ Form data populates existing tables (companies, labor_rates, etc.)
✅ Mobile responsive (can fill on tablet minimum)
✅ Load time < 2 seconds
✅ Supports file uploads up to 5MB per file