/**
 * GET /api/proposals/list
 * 
 * List proposal jobs with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status') // completed, processing, failed, etc.
        const limit = parseInt(searchParams.get('limit') || '50')

        let query = (supabase.from('proposal_jobs') as any).select('*')

        if (status) {
            query = query.eq('status', status)
        }

        query = query.order('created_at', { ascending: false }).limit(limit)

        const { data: proposals, error } = await query

        if (error) {
            console.error('Error fetching proposals:', error)
            return NextResponse.json(
                { error: 'Failed to fetch proposals' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            proposals: proposals || [],
            count: proposals?.length || 0,
        })
    } catch (error) {
        console.error('Error in /api/proposals/list:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}








