/**
 * API Route: Seed Test Company
 * 
 * POST /api/test/seed-company - Creates a test company with full intake data
 * DELETE /api/test/seed-company - Deletes a test company by ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { seedTestCompany, deleteTestCompany } from '@/lib/test-data/seed-test-company'

export async function POST() {
    try {
        console.log('[API] Seeding test company...')
        const result = await seedTestCompany()

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            companyId: result.companyId,
            intakeId: result.intakeId,
            message: 'Test company created successfully',
            links: {
                intake: `/intake/${result.companyId}`,
                company: `/api/companies/${result.companyId}`,
            },
        })
    } catch (error) {
        console.error('[API] Seed error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to seed test company' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const companyId = searchParams.get('companyId')

        if (!companyId) {
            return NextResponse.json(
                { error: 'companyId is required' },
                { status: 400 }
            )
        }

        console.log(`[API] Deleting test company ${companyId}...`)
        const result = await deleteTestCompany(companyId)

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Test company deleted successfully',
        })
    } catch (error) {
        console.error('[API] Delete error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete test company' },
            { status: 500 }
        )
    }
}












