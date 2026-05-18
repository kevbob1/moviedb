import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const response = NextResponse.json({ status: 'ok' })
  response.headers.set('Cache-Control', 'no-cache, private, no-store')

  return response
}