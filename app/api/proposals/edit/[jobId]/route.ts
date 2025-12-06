import { supabase } from '@/lib/supabase'
import { callClaude } from '@/lib/claude-client'
import { NextRequest, NextResponse } from 'next/server'

// Keywords that indicate a question vs an edit request
const QUESTION_INDICATORS = [
    'who is', 'who are', 'what is', 'what are', 'where is', 'where are',
    'when is', 'when are', 'why is', 'why are', 'how does', 'how do',
    'which is', 'which are', 'tell me about', 'list the', 'show me the',
    'find the', 'search for', 'look for', 'is there', 'are there',
    'does the', 'do we have', 'can you tell me', 'can you explain',
    'can you describe', 'can you summarize', 'summarize the', 'explain the',
    'describe the'
]

// Edit indicators - checked BEFORE question indicators
const EDIT_INDICATORS = [
    'change', 'update', 'modify', 'edit', 'replace', 'add', 'remove',
    'delete', 'fix', 'correct', 'improve', 'rewrite', 'make it',
    'shorten', 'expand', 'lengthen', 'reduce', 'increase', 'insert',
    'can you add', 'can you change', 'can you update', 'can you modify',
    'can you edit', 'can you replace', 'can you remove', 'can you delete',
    'can you fix', 'can you correct', 'can you improve', 'can you rewrite',
    'can you shorten', 'can you expand', 'please add', 'please change',
    'please update', 'please modify', 'please edit', 'please fix'
]

// =============================================================================
// CONTENT-BASED TARGETING - Find specific content the user referenced
// =============================================================================

interface ContentMatch {
    content: string      // The matched HTML containing the content
    startIndex: number   // Position in full HTML
    endIndex: number     // End position in full HTML  
    name: string         // Description of what was found
    type: 'content'      // Discriminator
}

function findContentInDocument(html: string, instruction: string): ContentMatch | null {
    // Check if instruction contains a colon followed by quoted/pasted content
    const colonIndex = instruction.indexOf(':')
    if (colonIndex === -1 || colonIndex > 100) return null
    
    const pastedContent = instruction.slice(colonIndex + 1).trim()
    if (pastedContent.length < 30) return null // Too short to be meaningful
    
    // Extract first 50 chars as search key (handles slight variations)
    const searchKey = pastedContent.slice(0, 50).replace(/[^\w\s]/g, '').trim()
    if (searchKey.length < 20) return null
    
    console.log(`[Edit API] Searching for content: "${searchKey.slice(0, 40)}..."`)
    
    // Find this content in the HTML
    const htmlText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const textIndex = htmlText.toLowerCase().indexOf(searchKey.toLowerCase().slice(0, 30))
    
    if (textIndex === -1) {
        console.log(`[Edit API] Content not found in document`)
        return null
    }
    
    // Find the paragraph/element containing this content
    // Look for <p> tags that contain this text
    const paragraphPattern = /<p[^>]*>[\s\S]*?<\/p>/gi
    let match
    while ((match = paragraphPattern.exec(html)) !== null) {
        const paragraphText = match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        if (paragraphText.toLowerCase().includes(searchKey.toLowerCase().slice(0, 30))) {
            console.log(`[Edit API] Found matching paragraph (${match[0].length} chars)`)
            return {
                content: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length,
                name: 'Specific Paragraph',
                type: 'content',
            }
        }
    }
    
    return null
}

// =============================================================================
// ELEMENT-LEVEL TARGETING - Fast edits for specific document elements
// =============================================================================

interface ElementMatch {
    element: string      // The matched HTML element
    startIndex: number   // Position in full HTML
    endIndex: number     // End position in full HTML
    name: string         // Human-readable name
    type: 'element'      // Discriminator
}

// Map user terms to specific HTML patterns in our generated document
const ELEMENT_PATTERNS: Array<{
    keywords: string[]
    name: string
    pattern: RegExp
}> = [
    // Cover page elements
    {
        keywords: ['title', 'proposal title', 'main title', 'document title'],
        name: 'Document Title',
        pattern: /<div class="cover-page">[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i,
    },
    {
        keywords: ['cover page', 'cover', 'front page'],
        name: 'Cover Page',
        pattern: /<div class="cover-page">([\s\S]*?)<\/div>\s*(?=<!--|\n<div class="toc">)/i,
    },
    {
        keywords: ['company info', 'company information', 'company details', 'our company', 'company address'],
        name: 'Company Information',
        pattern: /<div class="company-info">([\s\S]*?)<\/div>/i,
    },
    {
        keywords: ['submission date', 'submitted date', 'date submitted', 'deadline'],
        name: 'Submission Date',
        pattern: /<div class="date">([\s\S]*?)<\/div>/i,
    },
    {
        keywords: ['solicitation number', 'solicitation', 'rfp number', 'contract number'],
        name: 'Solicitation Number',
        pattern: /<div class="cover-page">[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i,
    },
    
    // Table of Contents
    {
        keywords: ['table of contents', 'toc', 'contents'],
        name: 'Table of Contents',
        pattern: /<div class="toc">([\s\S]*?)<\/div>/i,
    },
    
    // Agency name on cover
    {
        keywords: ['agency name', 'agency', 'submitted to'],
        name: 'Agency Name',
        pattern: /<div class="cover-page">[\s\S]*?<h2[^>]*>[\s\S]*?<\/h2>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i,
    },
    
    // Section headers/subheadings - h1 tags
    {
        keywords: ['section header', 'section title', 'section heading', 'main heading'],
        name: 'Section Header',
        pattern: /<h1[^>]*>[\s\S]*?<\/h1>/i,
    },
    
    // Subheadings - h2 tags (outside cover page)
    {
        keywords: ['subheading', 'sub heading', 'subsection', 'heading'],
        name: 'Subheading',
        pattern: /<h2[^>]*>[\s\S]*?<\/h2>/gi,
    },
    
    // Minor headings - h3 tags
    {
        keywords: ['minor heading', 'h3', 'small heading'],
        name: 'Minor Heading',
        pattern: /<h3[^>]*>[\s\S]*?<\/h3>/gi,
    },
    
    // Tables
    {
        keywords: ['table', 'data table', 'chart'],
        name: 'Table',
        pattern: /<table[^>]*>[\s\S]*?<\/table>/i,
    },
    
    // Lists
    {
        keywords: ['bullet list', 'bulleted list', 'list items', 'bullets'],
        name: 'Bullet List',
        pattern: /<ul[^>]*>[\s\S]*?<\/ul>/i,
    },
    {
        keywords: ['numbered list', 'ordered list'],
        name: 'Numbered List',
        pattern: /<ol[^>]*>[\s\S]*?<\/ol>/i,
    },
]

function findElement(html: string, instruction: string): ElementMatch | null {
    const lower = instruction.toLowerCase()
    
    console.log(`[Edit API] Checking element patterns for: "${lower.slice(0, 60)}..."`)
    
    for (const { keywords, name, pattern } of ELEMENT_PATTERNS) {
        // Check if any keyword matches
        const matchedKeyword = keywords.find(kw => lower.includes(kw))
        if (!matchedKeyword) continue
        
        console.log(`[Edit API] Keyword "${matchedKeyword}" matched -> trying ${name}`)
        
        // Try to find the element in HTML
        const match = html.match(pattern)
        if (match) {
            const fullMatch = match[0]
            const startIndex = html.indexOf(fullMatch)
            
            if (startIndex !== -1) {
                console.log(`[Edit API] ✓ Found element: ${name} (${fullMatch.length} chars)`)
                return {
                    element: fullMatch,
                    startIndex,
                    endIndex: startIndex + fullMatch.length,
                    name,
                    type: 'element',
                }
            }
        } else {
            console.log(`[Edit API] ✗ Pattern didn't match HTML for ${name}`)
        }
    }
    
    console.log(`[Edit API] No element patterns matched`)
    return null
}

// =============================================================================
// SECTION-LEVEL TARGETING - For larger content sections
// =============================================================================

interface SectionMatch {
    section: string
    startIndex: number
    endIndex: number
    name: string
    type: 'section'
}

function findRelevantSection(html: string, instruction: string): SectionMatch | null {
    const lower = instruction.toLowerCase()
    
    // Map keywords to sections - order matters (most specific first)
    const sectionKeywords: Record<string, string[]> = {
        'Executive Summary': ['executive summary', 'executive', 'summary section', 'intro section'],
        'Technical Approach': ['technical approach', 'technical section', 'technical', 'solution', 'methodology', 'technology', 'implementation'],
        'Management Approach': ['management approach', 'management section', 'management', 'organization', 'risk management', 'quality', 'team structure', 'org chart', 'staffing'],
        'Past Performance': ['past performance', 'experience section', 'experience', 'prior work', 'previous contracts', 'references'],
        'Pricing': ['pricing section', 'pricing summary', 'price', 'pricing', 'cost', 'budget', 'rates', 'labor rates'],
        'Compliance Matrix': ['compliance matrix', 'compliance section', 'compliance', 'matrix', 'requirements traceability'],
        'Key Personnel': ['key personnel', 'personnel section', 'resumes', 'staff', 'engineers', 'team members', 'employees', 'key people', 'bios'],
        'Appendices': ['appendix', 'appendices', 'certifications', 'supporting documents', 'attachments'],
    }
    
    // Find which section is being referenced
    let targetSection: string | null = null
    for (const [section, keywords] of Object.entries(sectionKeywords)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                console.log(`[Edit API] Section match: "${keyword}" -> ${section}`)
                targetSection = section
                break
            }
        }
        if (targetSection) break
    }
    
    if (!targetSection) {
        console.log(`[Edit API] No section keywords matched in: "${lower.slice(0, 100)}"`)
        return null
    }
    
    // Find section boundaries in HTML
    const sectionHeaders = [
        'Section 1.0 - EXECUTIVE SUMMARY',
        'Section 2.0 - TECHNICAL APPROACH', 
        'Section 3.0 - MANAGEMENT APPROACH',
        'Section 4.0 - PAST PERFORMANCE',
        'Section 5.0 - PRICING SUMMARY',
        'Section 6.0 - COMPLIANCE MATRIX',
        'Section 7.0 - KEY PERSONNEL RESUMES',
        'Section 8.0 - APPENDICES',
    ]
    
    const targetIndex = Object.keys(sectionKeywords).indexOf(targetSection)
    const startMarker = sectionHeaders[targetIndex]
    const endMarker = sectionHeaders[targetIndex + 1] || '</body>'
    
    console.log(`[Edit API] Looking for section "${startMarker}" (index ${targetIndex})`)
    
    // Try exact match first
    let startIndex = html.indexOf(startMarker)
    
    // If not found, try finding the h1 tag containing the section name
    if (startIndex === -1) {
        const sectionName = startMarker.split(' - ')[1] || startMarker
        const h1Pattern = new RegExp(`<h1[^>]*>[^<]*${sectionName}[^<]*</h1>`, 'i')
        const h1Match = html.match(h1Pattern)
        if (h1Match) {
            startIndex = html.indexOf(h1Match[0])
            console.log(`[Edit API] Found via h1 pattern: "${h1Match[0].slice(0, 50)}..."`)
        }
    }
    
    if (startIndex === -1) {
        console.log(`[Edit API] ✗ Section not found in HTML`)
        return null
    }
    
    // Find end marker
    let endIndex = -1
    if (targetIndex + 1 < sectionHeaders.length) {
        const nextMarker = sectionHeaders[targetIndex + 1]
        endIndex = html.indexOf(nextMarker, startIndex + 100)
        if (endIndex === -1) {
            // Try h1 pattern for next section
            const nextName = nextMarker.split(' - ')[1] || nextMarker
            const nextPattern = new RegExp(`<h1[^>]*>[^<]*${nextName}[^<]*</h1>`, 'i')
            const nextMatch = html.slice(startIndex + 100).match(nextPattern)
            if (nextMatch) {
                endIndex = startIndex + 100 + html.slice(startIndex + 100).indexOf(nextMatch[0])
            }
        }
    }
    if (endIndex === -1) {
        endIndex = html.indexOf('</body>', startIndex)
    }
    
    console.log(`[Edit API] ✓ Found section at index ${startIndex}-${endIndex} (${endIndex - startIndex} chars)`)
    
    const section = html.slice(startIndex, endIndex > startIndex ? endIndex : undefined)
    
    return { 
        section, 
        name: targetSection, 
        startIndex, 
        endIndex: endIndex > startIndex ? endIndex : html.length,
        type: 'section'
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isQuestion(instruction: string): boolean {
    const lower = instruction.toLowerCase()
    
    // Check EDIT indicators FIRST - these take priority
    for (const phrase of EDIT_INDICATORS) {
        if (lower.includes(phrase)) {
            console.log(`[Edit API] Detected as EDIT (matched: "${phrase}")`)
            return false
        }
    }
    
    // Only treat as question if it ends with ? AND doesn't have edit-like content
    if (lower.trim().endsWith('?') && !lower.includes(':')) {
        console.log(`[Edit API] Detected as QUESTION (ends with ?)`)
        return true
    }
    
    // Check question indicators
    for (const phrase of QUESTION_INDICATORS) {
        if (lower.startsWith(phrase) || lower.includes(` ${phrase}`)) {
            console.log(`[Edit API] Detected as QUESTION (matched: "${phrase}")`)
            return true
        }
    }
    
    // If instruction contains a colon followed by content, it's likely an edit with context
    if (lower.includes(':') && lower.length > 50) {
        console.log(`[Edit API] Detected as EDIT (contains colon with context)`)
        return false
    }
    
    // Default to edit mode for short instructions without clear indicators
    console.log(`[Edit API] Defaulting to EDIT mode`)
    return false
}

function extractTextFromHtml(html: string): string {
    let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<\/(p|div|h1|h2|h3|h4|tr|li)>/gi, '\n')
    text = text.replace(/<br\s*\/?>/gi, '\n')
    text = text.replace(/<td[^>]*>/gi, ' | ')
    text = text.replace(/<[^>]+>/g, ' ')
    text = text.replace(/\s+/g, ' ').trim()
    return text
}

function searchDocument(html: string, query: string): string {
    const text = extractTextFromHtml(html)
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    
    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 20)
    
    const scored = paragraphs.map(para => {
        const lower = para.toLowerCase()
        let score = 0
        for (const word of queryWords) {
            if (lower.includes(word)) score += 1
            if (lower.includes(query.toLowerCase())) score += 5
        }
        return { para, score }
    })
    
    const relevant = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(s => s.para)
    
    return relevant.join('\n\n')
}

// =============================================================================
// MAIN API HANDLER
// =============================================================================

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json()
        const { instruction, html, previewMode = false } = body

        if (!instruction || !html) {
            return NextResponse.json(
                { error: 'Missing required fields: instruction and html' },
                { status: 400 }
            )
        }

        const isQuestionMode = isQuestion(instruction)
        console.log(`[Edit API] Mode: ${isQuestionMode ? 'QUESTION' : 'EDIT'}${previewMode ? ' (preview)' : ''} for job ${jobId}`)
        console.log(`[Edit API] Instruction: ${instruction}`)

        // =================================================================
        // QUESTION MODE - Search locally, use Claude to format answer
        // =================================================================
        if (isQuestionMode) {
            const relevantText = searchDocument(html, instruction)
            
            if (!relevantText) {
                return NextResponse.json({
                    success: true,
                    answer: "I couldn't find information related to your question in the document.",
                    isQuestion: true,
                })
            }

            console.log(`[Edit API] Found ${relevantText.length} chars of relevant text`)

            const response = await callClaude({
                system: `You are a helpful assistant answering questions about a government proposal document. Be concise and direct. If listing items, use bullet points.`,
                userPrompt: `Based on this excerpt from the proposal, answer the question.

RELEVANT EXCERPT:
${relevantText.slice(0, 8000)}

QUESTION: ${instruction}

Answer concisely:`,
                maxTokens: 1000,
                temperature: 0.3,
            })

            return NextResponse.json({ 
                success: true,
                answer: response.trim(),
                isQuestion: true,
            })
        }

        // =================================================================
        // EDIT MODE - Try content, element, section, then fallback
        // =================================================================
        
        // 0. Try CONTENT-based targeting (user pasted specific text)
        const contentMatch = findContentInDocument(html, instruction)
        
        if (contentMatch) {
            console.log(`[Edit API] Content-based edit: ${contentMatch.name} (${contentMatch.content.length} chars)`)
            
            // Extract just the action part (before the colon)
            const actionPart = instruction.slice(0, instruction.indexOf(':')).trim()
            
            const response = await callClaude({
                system: `You are editing a specific paragraph in a government proposal document.
The user has provided the exact paragraph they want to edit.
Return ONLY the updated HTML paragraph - no explanations, no markdown.
Preserve the exact HTML structure (keep the <p> tags and any attributes).`,
                userPrompt: `Current paragraph:
${contentMatch.content}

ACTION: ${actionPart}

Return ONLY the updated <p>...</p> element:`,
                maxTokens: 2000,
                temperature: 0.3,
            })

            let updatedContent = response.trim()
            if (updatedContent.startsWith('```')) {
                updatedContent = updatedContent.replace(/^```html?\n?/, '').replace(/\n?```$/, '')
            }

            const updatedHtml = html.slice(0, contentMatch.startIndex) + 
                updatedContent + 
                html.slice(contentMatch.endIndex)

            const summary = `Edited the specific paragraph you referenced`
            
            // Log the before/after for debugging
            const originalText = contentMatch.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const updatedText = updatedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const charDiff = updatedText.length - originalText.length
            
            console.log(`[Edit API] ===== PROPOSED EDIT =====`)
            console.log(`[Edit API] ORIGINAL (${originalText.length} chars):`)
            console.log(`[Edit API] "${originalText.slice(0, 300)}${originalText.length > 300 ? '...' : ''}"`)
            console.log(`[Edit API] ---`)
            console.log(`[Edit API] UPDATED (${updatedText.length} chars, ${charDiff >= 0 ? '+' : ''}${charDiff} chars):`)
            console.log(`[Edit API] "${updatedText.slice(0, 300)}${updatedText.length > 300 ? '...' : ''}"`)
            
            // Show the new/different part if content was added
            if (charDiff > 0) {
                // Find what's new by looking at the end
                const newPart = updatedText.slice(-Math.min(charDiff + 50, 200))
                console.log(`[Edit API] ---`)
                console.log(`[Edit API] ADDED TEXT: "...${newPart}"`)
            }
            console.log(`[Edit API] ===========================`)

            if (previewMode) {
                return NextResponse.json({ 
                    success: true,
                    preview: {
                        original: contentMatch.content,
                        updated: updatedContent,
                        fullUpdatedHtml: updatedHtml,
                        sectionName: contentMatch.name,
                        summary,
                    },
                    isQuestion: false,
                })
            }

            return NextResponse.json({ 
                success: true,
                updatedHtml,
                message: summary,
                isQuestion: false,
            })
        }
        
        // 1. Try ELEMENT-level targeting (fastest - ~50-800 chars)
        const elementMatch = findElement(html, instruction)
        
        if (elementMatch) {
            console.log(`[Edit API] Element-level edit: ${elementMatch.name} (${elementMatch.element.length} chars)`)
            
            const response = await callClaude({
                system: `You are editing a specific element of a government proposal document.
Return ONLY the updated HTML element - no explanations, no markdown, no SUMMARY prefix.
Preserve the exact HTML structure and any class attributes.`,
                userPrompt: `Current element (${elementMatch.name}):
${elementMatch.element}

INSTRUCTION: ${instruction}

Return ONLY the updated HTML element:`,
                maxTokens: 1000,
                temperature: 0.3,
            })

            let updatedElement = response.trim()
            if (updatedElement.startsWith('```')) {
                updatedElement = updatedElement.replace(/^```html?\n?/, '').replace(/\n?```$/, '')
            }

            // Reconstruct full HTML
            const updatedHtml = html.slice(0, elementMatch.startIndex) + 
                updatedElement + 
                html.slice(elementMatch.endIndex)

            const summary = `Updated ${elementMatch.name}`
            
            // Log the before/after for debugging
            const origText = elementMatch.element.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const newText = updatedElement.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            console.log(`[Edit API] ===== PROPOSED EDIT (Element: ${elementMatch.name}) =====`)
            console.log(`[Edit API] BEFORE: "${origText}"`)
            console.log(`[Edit API] AFTER:  "${newText}"`)
            console.log(`[Edit API] ================================================`)

            if (previewMode) {
                return NextResponse.json({ 
                    success: true,
                    preview: {
                        original: elementMatch.element,
                        updated: updatedElement,
                        fullUpdatedHtml: updatedHtml,
                        sectionName: elementMatch.name,
                        summary,
                    },
                    isQuestion: false,
                })
            }

            return NextResponse.json({ 
                success: true,
                updatedHtml,
                message: summary,
                isQuestion: false,
            })
        }

        // 2. Try SECTION-level targeting (medium - 2-15K chars)
        const sectionMatch = findRelevantSection(html, instruction)
        
        if (sectionMatch) {
            console.log(`[Edit API] Section-level edit: ${sectionMatch.name} (${sectionMatch.section.length} chars)`)
            
            const response = await callClaude({
                system: `You are editing a specific section of a government proposal. 
First, provide a 1-sentence summary of what you're changing (prefix with "SUMMARY:").
Then on a new line, return ONLY the updated HTML for this section - no explanations, no markdown.
Preserve all existing HTML structure and styling.`,
                userPrompt: `Here is the "${sectionMatch.name}" section to edit:

${sectionMatch.section}

INSTRUCTION: ${instruction}

Respond with:
SUMMARY: <one sentence describing the change>
<updated HTML>`,
                maxTokens: 8000,
                temperature: 0.3,
            })

            let summary = 'Making requested changes'
            let updatedSection = response.trim()
            
            const summaryMatch = updatedSection.match(/^SUMMARY:\s*(.+?)(?:\n|$)/i)
            if (summaryMatch) {
                summary = summaryMatch[1].trim()
                updatedSection = updatedSection.slice(summaryMatch[0].length).trim()
            }
            
            if (updatedSection.startsWith('```')) {
                updatedSection = updatedSection.replace(/^```html?\n?/, '').replace(/\n?```$/, '')
            }

            const updatedHtml = html.slice(0, sectionMatch.startIndex) + 
                updatedSection + 
                html.slice(sectionMatch.endIndex)

            // Log summary for debugging
            console.log(`[Edit API] ===== PROPOSED EDIT (Section: ${sectionMatch.name}) =====`)
            console.log(`[Edit API] Summary: ${summary}`)
            console.log(`[Edit API] Original size: ${sectionMatch.section.length} chars`)
            console.log(`[Edit API] Updated size: ${updatedSection.length} chars`)
            console.log(`[Edit API] ================================================`)

            if (previewMode) {
                return NextResponse.json({ 
                    success: true,
                    preview: {
                        original: sectionMatch.section,
                        updated: updatedSection,
                        fullUpdatedHtml: updatedHtml,
                        sectionName: sectionMatch.name,
                        summary,
                    },
                    isQuestion: false,
                })
            }

            return NextResponse.json({ 
                success: true,
                updatedHtml,
                message: `Updated ${sectionMatch.name}: ${summary}`,
                isQuestion: false,
            })
        }

        // 3. FALLBACK - General edit with limited context
        console.log(`[Edit API] Fallback: No specific element/section found, using general edit`)
        
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
        const bodyContent = bodyMatch ? bodyMatch[1] : html
        const limitedContent = bodyContent.slice(0, 30000)
        
        const response = await callClaude({
            system: `You are editing a government proposal. 
First, provide a 1-sentence summary of what you're changing (prefix with "SUMMARY:").
Then make the requested change and return the updated content. Return ONLY HTML content after the summary.`,
            userPrompt: `Current content (partial):
${limitedContent}

INSTRUCTION: ${instruction}

Respond with:
SUMMARY: <one sentence describing the change>
<updated HTML>`,
            maxTokens: 8000,
            temperature: 0.3,
        })

        let summary = 'Making requested changes'
        let updatedContent = response.trim()
        
        const summaryMatch = updatedContent.match(/^SUMMARY:\s*(.+?)(?:\n|$)/i)
        if (summaryMatch) {
            summary = summaryMatch[1].trim()
            updatedContent = updatedContent.slice(summaryMatch[0].length).trim()
        }
        
        if (updatedContent.startsWith('```')) {
            updatedContent = updatedContent.replace(/^```html?\n?/, '').replace(/\n?```$/, '')
        }

        const headMatch = html.match(/<head[^>]*>[\s\S]*<\/head>/i)
        const head = headMatch ? headMatch[0] : ''
        const updatedHtml = `<!DOCTYPE html>\n<html lang="en">\n${head}\n<body>\n${updatedContent}\n</body>\n</html>`

        if (previewMode) {
            return NextResponse.json({ 
                success: true,
                preview: {
                    original: limitedContent.slice(0, 2000),
                    updated: updatedContent.slice(0, 2000),
                    fullUpdatedHtml: updatedHtml,
                    sectionName: 'Document',
                    summary,
                },
                isQuestion: false,
            })
        }

        return NextResponse.json({ 
            success: true,
            updatedHtml,
            message: summary,
            isQuestion: false,
        })

    } catch (error) {
        console.error('[Edit API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

// =============================================================================
// SAVE ENDPOINT
// =============================================================================

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json()
        const { html } = body

        if (!html) {
            return NextResponse.json(
                { error: 'Missing required field: html' },
                { status: 400 }
            )
        }

        console.log(`[Edit API] Saving document for job ${jobId}`)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase
            .from('proposal_jobs') as any)
            .update({ final_html: html })
            .eq('job_id', jobId)

        if (error) {
            console.error('[Edit API] Error saving document:', error)
            return NextResponse.json(
                { error: 'Failed to save document' },
                { status: 500 }
            )
        }

        return NextResponse.json({ 
            success: true,
            message: 'Document saved successfully'
        })

    } catch (error) {
        console.error('[Edit API] Error saving document:', error)
        return NextResponse.json(
            { error: 'Failed to save document' },
            { status: 500 }
        )
    }
}
