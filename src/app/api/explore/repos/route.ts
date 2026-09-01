import { NextRequest, NextResponse } from 'next/server'
import { searchRepos, allPlatforms, type RepoSearchResult } from '@/lib/repo-search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/explore/repos?q=<query>&platforms=github,gitlab,...
 *
 * Searches multiple code-hosting platforms in parallel and returns merged
 * results sorted by stars (desc). Used by the ExploreView component.
 *
 * Query params:
 *   q          — required search query (e.g. "federated learning")
 *   platforms  — optional comma-separated list; defaults to all 4 supported
 *
 * Response:
 *   { results: RepoSearchResult[], perPlatform: Record<Platform, number> }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  if (!q) {
    return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 })
  }

  const platformsParam = url.searchParams.get('platforms')
  const requested = platformsParam
    ? (platformsParam.split(',').map((s) => s.trim()).filter(Boolean) as RepoSearchResult['platform'][])
    : allPlatforms()

  // Validate platform names — silently drop unknown ones
  const valid = allPlatforms()
  const platforms = requested.filter((p) => valid.includes(p))
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'No valid platforms requested' }, { status: 400 })
  }

  try {
    const { results, perPlatform } = await searchRepos(q, platforms)
    return NextResponse.json({
      query: q,
      results,
      perPlatform,
      count: results.length,
    })
  } catch (err) {
    console.error('[explore/repos] search failed:', err)
    return NextResponse.json(
      { error: 'Search failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
