import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/explore/gaps
 *
 * White-space analysis: identifies categories and "needs" that GenLab
 * has NOT yet explored (or has under-explored) across all past sessions.
 *
 * Strategy:
 *  1. Compute per-category gene counts across all non-archived sessions.
 *     A category with very few genes (= underrepresented) is a gap.
 *  2. Collect all unique `need` strings (the human-readable problem each
 *     gene solves). Group by need-stem (first 3 words normalized). Needs
 *     that appear with only ONE gene are "thin coverage" gaps.
 *  3. Cross-reference categories: e.g. if `infrastructure` has only 2
 *     genes total, that's a hard gap; if `output` has 50 but only 1 gene
 *     covers "voice synthesis", that's a soft gap.
 *
 * Returns:
 *   {
 *     categoryGaps: [{ category, geneCount, status: 'empty'|'thin'|'ok', suggestion }],
 *     needGaps:     [{ need, geneCount, onlyGene?, status: 'thin'|'single' }],
 *     uncoveredDomains: [string]  // categories with zero genes
 *     totalGenes, totalSessions
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? '30'), 100)

    const sessions = await db.session.findMany({
      where: { status: { not: 'archived' } },
      select: {
        id: true,
        prompt: true,
        genes: {
          select: {
            id: true,
            techName: true,
            category: true,
            need: true,
            ahiScore: true,
          },
        },
      },
    })

    // All canonical categories — even if zero genes, we want to surface them
    const ALL_CATEGORIES = ['input', 'processing', 'output', 'infrastructure', 'fusion']

    // 1. Category counts
    const catCount: Record<string, number> = {}
    for (const c of ALL_CATEGORIES) catCount[c] = 0
    for (const s of sessions) {
      for (const g of s.genes) {
        if (catCount[g.category] === undefined) catCount[g.category] = 0
        catCount[g.category] += 1
      }
    }
    const totalGenes = Object.values(catCount).reduce((a, b) => a + b, 0)

    const categoryGaps = ALL_CATEGORIES.map((cat) => {
      const n = catCount[cat] || 0
      let status: 'empty' | 'thin' | 'ok' = 'ok'
      let suggestion = ''
      if (n === 0) {
        status = 'empty'
        suggestion = `Brak genów w kategorii „${cat}” — dodaj komponenty tej klasy w kolejnym wynalazku.`
      } else if (n < 5) {
        status = 'thin'
        suggestion = `Tylko ${n} gen(ów) w „${cat}” — rozszerz bazę o kolejne implementacje.`
      } else {
        suggestion = `${n} genów — pokrycie wystarczające.`
      }
      return { category: cat, geneCount: n, status, suggestion }
    }).sort((a, b) => a.geneCount - b.geneCount)

    const uncoveredDomains = categoryGaps
      .filter((c) => c.status === 'empty')
      .map((c) => c.category)

    // 2. Need-stem grouping — group needs by first 3 normalized words
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const stemOf = (s: string) => {
      const parts = normalize(s).split(' ').slice(0, 3).join(' ')
      return parts
    }

    type NeedGroup = {
      stem: string
      representativeNeed: string
      genes: Array<{ techName: string; category: string; ahiScore: number; sessionId: string }>
      sessionIds: Set<string>
    }
    const needStems = new Map<string, NeedGroup>()

    for (const s of sessions) {
      for (const g of s.genes) {
        if (!g.need || !g.need.trim()) continue
        const stem = stemOf(g.need)
        if (!stem) continue
        let grp = needStems.get(stem)
        if (!grp) {
          grp = {
            stem,
            representativeNeed: g.need,
            genes: [],
            sessionIds: new Set(),
          }
          needStems.set(stem, grp)
        }
        grp.genes.push({
          techName: g.techName,
          category: g.category,
          ahiScore: g.ahiScore,
          sessionId: s.id,
        })
        grp.sessionIds.add(s.id)
      }
    }

    const needGaps = Array.from(needStems.values())
      .filter((g) => g.genes.length <= 2) // "thin" coverage
      .map((g) => ({
        stem: g.stem,
        representativeNeed: g.representativeNeed,
        geneCount: g.genes.length,
        sessionCount: g.sessionIds.size,
        status: g.genes.length === 1 ? 'single' : 'thin',
        genes: g.genes.slice(0, 5),
        suggestion:
          g.genes.length === 1
            ? `Tylko jedno rozwiązanie (${g.genes[0].techName}) pokrywa tę potrzebę — dodaj alternatywy.`
            : `Tylko ${g.genes.length} geny pokrywają tę potrzebę — rozważ więcej wariantów.`,
      }))
      .sort((a, b) => a.geneCount - b.geneCount || b.sessionCount - a.sessionCount)
      .slice(0, limit)

    return NextResponse.json({
      totalSessions: sessions.length,
      totalGenes,
      categoryGaps,
      uncoveredDomains,
      needGaps,
      needGapsCount: needGaps.length,
    })
  } catch (err) {
    console.error('[/api/explore/gaps] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
