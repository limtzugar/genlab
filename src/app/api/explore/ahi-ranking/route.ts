import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/explore/ahi-ranking
 *
 * Returns all genes from non-archived sessions, ranked by AHI score
 * (descending). Each row includes the parent session's prompt so the UI
 * can show "this gene came from session X".
 *
 * Optional query params:
 *   - limit  (default 50, max 200)
 *   - minAhi (default 0)  — only genes with ahiScore >= minAhi
 *   - category (optional) — filter by gene category (input|processing|output|infrastructure|fusion)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
    const minAhi = Number(searchParams.get('minAhi') ?? '0')
    const category = searchParams.get('category')?.trim() || null

    const genes = await db.gene.findMany({
      where: {
        session: { status: { not: 'archived' } },
        ahiScore: { gte: minAhi },
        ...(category ? { category } : {}),
      },
      orderBy: { ahiScore: 'desc' },
      take: limit,
      include: {
        session: {
          select: { id: true, prompt: true, createdAt: true },
        },
      },
    })

    // Aggregate stats for the UI header
    const total = genes.length
    const avgAhi = total > 0 ? genes.reduce((s, g) => s + g.ahiScore, 0) / total : 0
    const topAhi = total > 0 ? genes[0].ahiScore : 0
    const byCategory: Record<string, number> = {}
    for (const g of genes) {
      byCategory[g.category] = (byCategory[g.category] || 0) + 1
    }

    return NextResponse.json({
      count: total,
      avgAhi: Math.round(avgAhi * 10) / 10,
      topAhi: Math.round(topAhi * 10) / 10,
      byCategory,
      genes: genes.map((g) => ({
        id: g.id,
        techName: g.techName,
        category: g.category,
        role: g.role,
        need: g.need,
        githubUrl: g.githubUrl,
        description: g.description,
        language: g.language,
        license: g.license,
        stars: g.stars,
        ahiScore: g.ahiScore,
        autonomy: g.autonomy,
        ethics: g.ethics,
        decentral: g.decentral,
        sessionId: g.session.id,
        sessionPrompt: g.session.prompt,
        sessionCreatedAt: g.session.createdAt,
      })),
    })
  } catch (err) {
    console.error('[/api/explore/ahi-ranking] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
