import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/sessions — list recent sessions (with gene + invention counts)
 * POST /api/sessions — create empty session (manual)
 *   body: { action: 'archive' | 'delete', id: string }
 *     archive  → soft delete (status='archived'), row stays in DB
 *     delete   → hard delete (db.session.delete), cascade wipes genes,
 *                inventions, hardware, schematics thanks to onDelete: Cascade
 *                in prisma/schema.prisma
 */
export async function GET() {
  const sessions = await db.session.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      _count: { select: { genes: true, inventions: true } },
    },
  })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const { action, id } = await req.json().catch(() => ({}))
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  if (action === 'archive') {
    await db.session.update({
      where: { id },
      data: { status: 'archived' },
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    // Hard delete — Prisma cascades through Gene, Invention, Hardware,
    // Schematic (all have onDelete: Cascade in schema.prisma). One call
    // wipes the whole session tree.
    try {
      await db.session.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    } catch (err) {
      // If the row doesn't exist (already deleted), Prisma throws
      // P2025 — treat as success so the client UI can clean up.
      const code = (err as { code?: string }).code
      if (code === 'P2025') return NextResponse.json({ ok: true })
      throw err
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
