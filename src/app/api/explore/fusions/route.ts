import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/explore/fusions
 *
 * Finds gene "fusion patterns" — pairs (or triples) of genes that appear
 * together in the same session. Sessions with more fusion genes get higher
 * pattern weight. We also compute:
 *   - coOccur: how many sessions contain both genes
 *   - avgAhi: mean AHI across those co-occurring genes
 *   - sessions: array of { id, prompt } for drill-down
 *
 * Only genes from non-archived sessions are considered.
 *
 * Optional query params:
 *   - minCoOccur (default 2) — pairs appearing in at least N sessions
 *   - limit      (default 30, max 100)
 */
type SessionLite = { id: string; prompt: string; createdAt: Date }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const minCoOccur = Math.max(Number(searchParams.get('minCoOccur') ?? '2'), 1)
    const limit = Math.min(Number(searchParams.get('limit') ?? '30'), 100)

    // Pull all genes from non-archived sessions, grouped by session
    const sessions = await db.session.findMany({
      where: { status: { not: 'archived' } },
      select: {
        id: true,
        prompt: true,
        createdAt: true,
        genes: {
          select: {
            id: true,
            techName: true,
            category: true,
            ahiScore: true,
          },
        },
      },
    })

    // Build a map: geneName -> { category, totalAhi, count } for global stats
    const geneGlobal = new Map<
      string,
      { category: string; totalAhi: number; count: number }
    >()

    // Build pair co-occurrence map: "techA|||techB" -> { count, sumAhi, sessions[] }
    // We use techName as the identity (case-insensitive normalized) — not gene.id,
    // because the same library (e.g. "FFmpeg") can appear in many sessions as
    // distinct gene rows but represents the SAME gene.
    const pairKey = (a: string, b: string) => {
      const na = a.trim().toLowerCase()
      const nb = b.trim().toLowerCase()
      return na < nb ? `${na}|||${nb}` : `${nb}|||${na}`
    }

    const pairs = new Map<
      string,
      {
        a: string
        b: string
        count: number
        sumAhi: number
        sessions: SessionLite[]
      }
    >()

    for (const s of sessions) {
      // Aggregate global gene stats
      for (const g of s.genes) {
        const key = g.techName.trim().toLowerCase()
        if (!key) continue
        const prev = geneGlobal.get(key) ?? { category: g.category, totalAhi: 0, count: 0 }
        prev.totalAhi += g.ahiScore
        prev.count += 1
        geneGlobal.set(key, prev)
      }

      // Emit all unique pairs within this session
      const genes = s.genes
        .map((g) => ({ name: g.techName.trim(), category: g.category, ahi: g.ahiScore }))
        .filter((g) => g.name.length > 0)
      // Dedupe within a single session in case the same gene appears twice
      const seen = new Set<string>()
      const uniqueGenes = genes.filter((g) => {
        const k = g.name.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      for (let i = 0; i < uniqueGenes.length; i++) {
        for (let j = i + 1; j < uniqueGenes.length; j++) {
          const a = uniqueGenes[i]
          const b = uniqueGenes[j]
          const k = pairKey(a.name, b.name)
          const prev = pairs.get(k) ?? {
            a: a.name,
            b: b.name,
            count: 0,
            sumAhi: 0,
            sessions: [],
          }
          prev.count += 1
          prev.sumAhi += (a.ahi + b.ahi) / 2
          // Only store first 5 session refs for UI brevity
          if (prev.sessions.length < 5) {
            prev.sessions.push({ id: s.id, prompt: s.prompt, createdAt: s.createdAt })
          }
          pairs.set(k, prev)
        }
      }
    }

    // Filter by minCoOccur and sort by count desc, then avgAhi desc
    const pairList = Array.from(pairs.values())
      .filter((p) => p.count >= minCoOccur)
      .map((p) => ({
        geneA: p.a,
        geneB: p.b,
        coOccur: p.count,
        avgAhi: Math.round((p.sumAhi / p.count) * 10) / 10,
        sessions: p.sessions,
      }))
      .sort((a, b) => b.coOccur - a.coOccur || b.avgAhi - a.avgAhi)
      .slice(0, limit)

    // Build a list of "hub genes" — genes that pair with the most other genes
    const partnerCount = new Map<string, number>()
    for (const p of pairList) {
      partnerCount.set(p.geneA, (partnerCount.get(p.geneA) ?? 0) + 1)
      partnerCount.set(p.geneB, (partnerCount.get(p.geneB) ?? 0) + 1)
    }
    const hubGenes = Array.from(partnerCount.entries())
      .map(([name, n]) => {
        const g = geneGlobal.get(name.toLowerCase())
        return {
          name,
          partners: n,
          appearances: g?.count ?? 0,
          avgAhi: g ? Math.round((g.totalAhi / g.count) * 10) / 10 : 0,
          category: g?.category ?? 'unknown',
        }
      })
      .sort((a, b) => b.partners - a.partners || b.appearances - a.appearances)
      .slice(0, 15)

    // geneMeta — metadata for ALL genes appearing in pairs (used by the
    // graph view to color nodes by category, size by partner count).
    // Different from hubGenes: hubGenes is top 15, geneMeta is everyone.
    const geneMeta: Record<
      string,
      { category: string; partners: number; appearances: number; avgAhi: number }
    > = {}
    for (const [name, partners] of partnerCount.entries()) {
      const g = geneGlobal.get(name.toLowerCase())
      geneMeta[name] = {
        category: g?.category ?? 'unknown',
        partners,
        appearances: g?.count ?? 0,
        avgAhi: g ? Math.round((g.totalAhi / g.count) * 10) / 10 : 0,
      }
    }

    return NextResponse.json({
      totalPairs: pairList.length,
      scannedSessions: sessions.length,
      scannedGenes: geneGlobal.size,
      pairs: pairList,
      hubGenes,
      geneMeta,
    })
  } catch (err) {
    console.error('[/api/explore/fusions] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
