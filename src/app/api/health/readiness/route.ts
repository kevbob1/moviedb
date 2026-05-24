import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkMoviesOnJellyfin } from '@/lib/jellyfin'

export const dynamic = 'force-static'

export async function GET() {
try {
const dbConnected = await prisma.$queryRaw`SELECT 1`
const dbStatus = dbConnected ? 'ok' : 'error'

let jellyfinStatus = 'not_configured'
try {
const jellyfinUrl = process.env.JELLYFIN_URL || ''
const jellyfinApiKey = process.env.JELLYFIN_API_KEY || ''

if (jellyfinUrl && jellyfinApiKey) {
const result = await checkMoviesOnJellyfin([])
jellyfinStatus = result.configured ? 'ok' : 'error'
}
} catch {
jellyfinStatus = 'error'
}

const overallStatus = dbStatus === 'ok' && jellyfinStatus !== 'error' ? 'ok' : 'error'

return NextResponse.json({
status: overallStatus,
database: dbStatus,
jellyfin: jellyfinStatus
}, {
status: overallStatus === 'ok' ? 200 : 503
})
} catch {
return NextResponse.json(
{ status: 'error', database: 'error', jellyfin: 'error' },
{ status: 503 }
)
}
}