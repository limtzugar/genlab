import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/sessions/[id] — full session with genes + inventions + hardware + schematics
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await db.session.findUnique({
    where: { id },
    include: {
      genes: true,
      inventions: true,
      hardware: { orderBy: { createdAt: 'asc' } },
      schematics: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ session })
}
