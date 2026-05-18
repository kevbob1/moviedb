import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-static'

export async function GET() {
  try {
    const dbConnected = await prisma.$queryRaw`SELECT 1`

    const dbStatus = dbConnected ? 'ok' : 'error',

    return NextResponse.json({
      status: 'ok',
      database: dbStatus
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', database: 'error' },
      { status: 503 }
    )
  }
}