import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/explore/theory-map
 *
 * Maps "theories" (= user prompts, the user's inventive intent) to the
 * genes that were extracted for them. Returns clusters grouped by a
 * normalized form of the prompt:
 *
 *   {
 *     clusters: [
 *       {
 *         theoryHash: "abc123",
 *         representativePrompt: "federated learning for hospitals",
 *         sessionCount: 3,
 *         geneCount: 12,
 *         genes: [ { techName, category, ahiScore, sessionsSeen } ],
 *         avgAhi: 68.4,
 *         topCategory: "processing"
 *       },
 *       ...
 *     ]
 *   }
 *
 * The "theory" concept here = a normalized prompt stem. We strip
 * punctuation + lowercase + collapse spaces to group similar prompts
 * (e.g. "Federated learning for hospitals." and "federated learning
 * for hospitals" map to the same theory).
 *
 * Optional query params:
 *   - limit (default 20, max 50)
 *   - minGenes (default 2) — clusters with fewer genes are filtered out
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
    const minGenes = Math.max(Number(searchParams.get('minGenes') ?? '2'), 1)

    const sessions = await db.session.findMany({
      where: { status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        prompt: true,
        mode: true,
        createdAt: true,
        genes: {
          select: {
            id: true,
            techName: true,
            category: true,
            need: true,
            role: true,
            ahiScore: true,
            githubUrl: true,
          },
        },
      },
    })

    // Normalize function
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    // Group sessions by normalized prompt
    type Cluster = {
      theoryHash: string
      representativePrompt: string
      prompts: string[]
      sessionIds: string[]
      sessionCount: number
      genes: Map<string, {
        techName: string
        category: string
        need: string
        role: string
        githubUrl: string | null
        ahiSum: number
        ahiCount: number
        sessionsSeen: Set<string>
      }>
    }
    const clusters = new Map<string, Cluster>()

    for (const s of sessions) {
      const norm = normalize(s.prompt)
      if (!norm) continue
      const hash = norm // we use the normalized string itself as the hash
      let c = clusters.get(hash)
      if (!c) {
        c = {
          theoryHash: hash,
          representativePrompt: s.prompt,
          prompts: [],
          sessionIds: [],
          sessionCount: 0,
          genes: new Map(),
        }
        clusters.set(hash, c)
      }
      // Track prompts — keep first occurrence as representative, but
      // remember alternates so UI can show "also asked as: ..."
      if (!c.prompts.includes(s.prompt)) c.prompts.push(s.prompt)
      c.sessionIds.push(s.id)
      c.sessionCount += 1

      for (const g of s.genes) {
        const key = g.techName.trim().toLowerCase()
        if (!key) continue
        const prev = c.genes.get(key) ?? {
          techName: g.techName,
          category: g.category,
          need: g.need,
          role: g.role,
          githubUrl: g.githubUrl,
          ahiSum: 0,
          ahiCount: 0,
          sessionsSeen: new Set<string>(),
        }
        prev.ahiSum += g.ahiScore
        prev.ahiCount += 1
        prev.sessionsSeen.add(s.id)
        c.genes.set(key, prev)
      }
    }

    // Materialize clusters, compute stats, sort by geneCount desc
    const clusterList = Array.from(clusters.values())
      .filter((c) => c.genes.size >= minGenes)
      .map((c) => {
        const genesArr = Array.from(c.genes.values()).map((g) => ({
          techName: g.techName,
          category: g.category,
          need: g.need,
          role: g.role,
          githubUrl: g.githubUrl,
          avgAhi: Math.round((g.ahiSum / g.ahiCount) * 10) / 10,
          sessionsSeen: g.sessionsSeen.size,
        }))

        const totalAhi = genesArr.reduce((s, g) => s + g.avgAhi, 0)
        const avgAhi = genesArr.length > 0 ? totalAhi / genesArr.length : 0

        // Top category by frequency
        const catCount: Record<string, number> = {}
        for (const g of genesArr) {
          catCount[g.category] = (catCount[g.category] || 0) + 1
        }
        const topCategory =
          Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown'

        return {
          theoryHash: c.theoryHash,
          representativePrompt: c.representativePrompt,
          altPrompts: c.prompts.filter((p) => p !== c.representativePrompt).slice(0, 3),
          sessionCount: c.sessionCount,
          geneCount: genesArr.length,
          avgAhi: Math.round(avgAhi * 10) / 10,
          topCategory,
          sessionIds: c.sessionIds,
          genes: genesArr
            .sort((a, b) => b.avgAhi - a.avgAhi)
            .slice(0, 12), // top 12 genes per cluster
        }
      })
      .sort((a, b) => b.geneCount - a.geneCount || b.sessionCount - a.sessionCount)
      .slice(0, limit)

    return NextResponse.json({
      count: clusterList.length,
      totalSessionsScanned: sessions.length,
      clusters: clusterList,
    })
  } catch (err) {
    console.error('[/api/explore/theory-map] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
