import { NextRequest, NextResponse } from 'next/server'
import { searchKmart } from '@/lib/kmart-scraper'

export async function POST(req: NextRequest) {
  const body = await req.json() as { query?: string }
  const { query } = body
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }
  const products = await searchKmart(query)
  return NextResponse.json({ products })
}
