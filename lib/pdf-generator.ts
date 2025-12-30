/**
 * PDF Generator using Puppeteer
 * Converts HTML proposals to professionally formatted PDF documents
 * 
 * Uses @sparticuz/chromium for Vercel compatibility
 * NOTE: Dynamic imports required for serverless environments
 */

import type { Browser } from 'puppeteer-core'

export interface PdfOptions {
    format?: 'Letter' | 'A4'
    margin?: {
        top: string
        right: string
        bottom: string
        left: string
    }
    displayHeaderFooter?: boolean
    headerTemplate?: string
    footerTemplate?: string
}

/**
 * Get browser instance - handles both local and Vercel environments
 */
async function getBrowser(): Promise<Browser> {
    // Dynamic imports to prevent build issues
    const puppeteer = (await import('puppeteer-core')).default
    
    // Check if running on Vercel/AWS Lambda
    const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION
    
    if (isVercel) {
        console.log('[PDF Generator] Running on Vercel - using @sparticuz/chromium')
        const chromium = (await import('@sparticuz/chromium')).default
        
        return puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
        })
    } else {
        console.log('[PDF Generator] Running locally - using local Chrome')
        // For local development, try to find Chrome
        const possiblePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
        ]
        
        let executablePath: string | undefined
        const fs = await import('fs')
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                executablePath = path
                break
            }
        }
        
        if (!executablePath) {
            throw new Error('Could not find Chrome. Please install Google Chrome for local PDF generation.')
        }
        
        return puppeteer.launch({
            executablePath,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        })
    }
}

/**
 * Generate a PDF from HTML content
 * @param html - The complete HTML document to convert
 * @param options - PDF generation options
 * @returns Buffer containing the PDF data
 */
export async function generatePdfFromHtml(
    html: string,
    options: PdfOptions = {}
): Promise<Buffer> {
    console.log('[PDF Generator] Launching browser...')
    
    const browser = await getBrowser()
    
    try {
        console.log('[PDF Generator] Creating page...')
        const page = await browser.newPage()
        
        // Set content with longer timeout for complex documents
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        })
        
        console.log('[PDF Generator] Generating PDF...')
        
        // Default styling for headers/footers
        const headerFooterStyle = `
            font-family: Arial, sans-serif;
            font-size: 9px;
            color: #666;
            width: 100%;
            padding: 0 0.75in;
        `
        
        // Generate PDF with proper margins
        const pdfBuffer = await page.pdf({
            format: options.format || 'Letter',
            margin: options.margin || {
                top: '0.75in',
                right: '0.75in',
                bottom: '0.75in',
                left: '0.75in',
            },
            displayHeaderFooter: options.displayHeaderFooter ?? true,
            headerTemplate: options.headerTemplate || `
                <div style="${headerFooterStyle} display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <span></span>
                    <span></span>
                </div>
            `,
            footerTemplate: options.footerTemplate || `
                <div style="${headerFooterStyle} display: flex; justify-content: center; border-top: 1px solid #ddd; padding-top: 5px;">
                    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                </div>
            `,
            printBackground: true,
            preferCSSPageSize: false,
        })
        
        console.log(`[PDF Generator] PDF generated successfully (${pdfBuffer.length} bytes)`)
        
        return Buffer.from(pdfBuffer)
        
    } finally {
        await browser.close()
        console.log('[PDF Generator] Browser closed')
    }
}

/**
 * Generate PDF with custom header showing solicitation number
 * 
 * NOTE: Puppeteer header/footer templates have specific requirements:
 * - Must include full HTML styling inline
 * - Uses special classes: pageNumber, totalPages, title, url, date
 * - Height is controlled by margin, not template content
 */
export async function generateProposalPdf(
    html: string,
    solicitationNum: string,
    companyName: string
): Promise<Buffer> {
    // Escape special characters for HTML
    const safeSolNum = solicitationNum.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const safeCompany = companyName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    
    return generatePdfFromHtml(html, {
        format: 'Letter',
        margin: {
            top: '1in',      // Room for header
            right: '0.75in',
            bottom: '1in',   // Room for footer
            left: '0.75in',
        },
        displayHeaderFooter: true,
        headerTemplate: `
            <div style="width: 100%; font-family: Arial, sans-serif; font-size: 9px; padding: 0 0.75in; margin-top: 0.35in;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 5px; border-bottom: 1px solid #ccc;">
                    <span style="color: #333;">Proposal</span>
                    <span style="color: #555;">${safeSolNum} | ${safeCompany}</span>
                </div>
            </div>
        `,
        footerTemplate: `
            <div style="width: 100%; font-family: Arial, sans-serif; font-size: 9px; padding: 0 0.75in; margin-bottom: 0.35in;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px; border-top: 1px solid #ccc;">
                    <span style="color: #666; font-size: 8px;">CONFIDENTIAL - FOR OFFICIAL USE ONLY</span>
                    <span style="color: #333;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    <span style="color: #666; font-size: 8px;">${safeCompany} PROPRIETARY</span>
                </div>
            </div>
        `,
    })
}
