'use client'

import React, { useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export interface PdfData {
    text: string
    fileName: string
    pageCount: number
}

interface UploadDropzoneProps {
    onPdfExtracted: (data: PdfData | null) => void
}

export default function UploadDropzone({ onPdfExtracted }: UploadDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [uploadedFile, setUploadedFile] = useState<PdfData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const extractText = useCallback(async (file: File) => {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const pageText = content.items
                .map((item: any) => item.str)
                .join(' ')
            fullText += pageText + '\n\n'
        }

        return {
            text: fullText,
            fileName: file.name,
            pageCount: pdf.numPages,
        }
    }, [])

    const handleFile = useCallback(async (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Please upload a PDF file')
            return
        }

        setError(null)
        setIsProcessing(true)

        try {
            const data = await extractText(file)
            setUploadedFile(data)
            onPdfExtracted(data)
        } catch (err) {
            console.error('Error processing PDF:', err)
            setError('Failed to process PDF. Please try again.')
            onPdfExtracted(null)
        } finally {
            setIsProcessing(false)
        }
    }, [extractText, onPdfExtracted])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }, [handleFile])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
    }, [handleFile])

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        setUploadedFile(null)
        onPdfExtracted(null)
    }, [onPdfExtracted])

    return (
        <div className="w-full max-w-[420px] aspect-square mx-auto">
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('pdf-upload')?.click()}
                className={`
                    relative w-full h-full rounded-lg border border-dashed transition-all duration-200 flex flex-col items-center justify-center cursor-pointer group
                    ${isDragging 
                        ? 'border-orange-500 bg-orange-500/5' 
                        : 'border-gray-700 bg-[#161616] hover:bg-[#1a1a1a] hover:border-gray-600'
                    }
                `}
            >
                <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileInput}
                    className="hidden"
                />

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                        <p className="text-sm text-gray-500 font-mono">Scanning PDF...</p>
                    </div>
                ) : uploadedFile ? (
                    <div className="flex flex-col items-center gap-4 p-8 w-full">
                        <div className="w-16 h-16 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        
                        <div className="text-center w-full">
                            <h3 className="text-sm font-medium text-white mb-1 truncate px-4">
                                {uploadedFile.fileName}
                            </h3>
                            <p className="text-xs text-gray-500 font-mono mb-4">
                                {uploadedFile.pageCount} PAGES • {Math.round(uploadedFile.text.length / 1024)}KB
                            </p>
                            
                            <button
                                onClick={handleRemove}
                                className="px-4 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                            >
                                Remove File
                            </button>
                        </div>
                        
                        <div className="absolute top-4 right-4">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6 p-8">
                        <div className={`
                            w-12 h-12 rounded-lg border border-gray-700 flex items-center justify-center transition-all duration-200
                            ${isDragging ? 'bg-orange-500/10 border-orange-500/50' : 'bg-gray-800/50 group-hover:bg-gray-800 group-hover:border-gray-600'}
                        `}>
                            <svg className={`w-5 h-5 ${isDragging ? 'text-orange-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </div>

                        <div className="text-center space-y-2">
                            <p className="text-sm font-medium text-white group-hover:text-orange-400 transition-colors">
                                Click to upload <span className="text-gray-500 font-normal">or drag and drop</span>
                            </p>
                            <p className="text-xs text-gray-600 font-mono uppercase tracking-wide">
                                PDF Files Only
                            </p>
                        </div>
                    </div>
                )}
            </div>
            
            {error && (
                <div className="absolute bottom-full left-0 right-0 mb-4 text-center">
                    <span className="px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                        {error}
                    </span>
                </div>
            )}
        </div>
    )
}
