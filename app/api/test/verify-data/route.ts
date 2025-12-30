/**
 * API Route: Verify Test Data
 * 
 * GET /api/test/verify-data?companyId=xxx - Verifies all data was saved correctly
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const companyId = searchParams.get('companyId')

        if (!companyId) {
            return NextResponse.json(
                { error: 'companyId is required' },
                { status: 400 }
            )
        }

        console.log(`[API] Verifying data for company ${companyId}...`)

        // Fetch all related data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [companyResult, ppResult, personnelResult, ratesResult, intakeResult] = await Promise.all([
            (supabase.from('companies') as any).select('*').eq('id', companyId).single(),
            (supabase.from('past_performance') as any).select('*').eq('company_id', companyId),
            (supabase.from('personnel') as any).select('*').eq('company_id', companyId),
            (supabase.from('labor_rates') as any).select('*').eq('company_id', companyId),
            (supabase.from('client_intake') as any).select('*').eq('company_id', companyId).single(),
        ])

        const verification = {
            company: {
                found: !!companyResult.data,
                data: companyResult.data,
                error: companyResult.error?.message,
            },
            pastPerformance: {
                count: ppResult.data?.length || 0,
                data: ppResult.data,
                error: ppResult.error?.message,
            },
            personnel: {
                count: personnelResult.data?.length || 0,
                data: personnelResult.data,
                error: personnelResult.error?.message,
            },
            laborRates: {
                count: ratesResult.data?.length || 0,
                data: ratesResult.data,
                error: ratesResult.error?.message,
            },
            clientIntake: {
                found: !!intakeResult.data,
                data: intakeResult.data,
                error: intakeResult.error?.message,
            },
        }

        const summary = {
            companyId,
            companyName: companyResult.data?.name || 'Not found',
            isComplete: 
                verification.company.found &&
                verification.pastPerformance.count >= 3 &&
                verification.personnel.count >= 4 &&
                verification.laborRates.count >= 1 &&
                verification.clientIntake.found,
            counts: {
                pastPerformance: verification.pastPerformance.count,
                personnel: verification.personnel.count,
                laborRates: verification.laborRates.count,
            },
        }

        return NextResponse.json({
            success: true,
            summary,
            verification,
        })
    } catch (error) {
        console.error('[API] Verify error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to verify data' },
            { status: 500 }
        )
    }
}












