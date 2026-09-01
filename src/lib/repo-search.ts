/**
 * Multi-platform repository search — server-side only.
 *
 * Searches GitHub, GitLab, and Codeberg via their public REST APIs.
 *
 * Platforms NOT supported and why:
 *   - Bitbucket     — public /repositories endpoint was deprecated and
 *                     removed (HTTP 410 Gone, sunset 2026-04-14). The
 *                     endpoint now requires OAuth authentication, which
 *                     we can't do from a public search UI.
 *   - SourceForge   — no JSON search API (HTML-only directory).
 *   - AWS CodeCommit — repos are always private (require AWS auth).
 *
 * Each platform returns results normalized to a common RepoSearchResult
 * shape so the UI doesn't care which host it came from.
 *
 * Rate limits (unauthenticated, public):
 *   GitHub    — 10 req/min  (we cap at 1 req per search)
 *   GitLab    — ~10 req/min (per-IP)
 *   Codeberg  — generous (Gitea default)
 *
 * All requests use a 10s timeout via AbortController so a slow/hanging
 * platform can't block the whole response.
 */

export type RepoSearchResult = {
  platform: 'github' | 'gitlab' | 'codeberg'
  url: string
  name: string // owner/repo (or just repo for SF)
  description: string | null
  stars: number | null
  language: string | null
  license: string | null
  updatedAt: string | null // ISO date
  topics?: string[]
}

type Platform = RepoSearchResult['platform']

const PLATFORMS: Platform[] = ['github', 'gitlab', 'codeberg']

const PLATFORM_META: Record<Platform, { label: string; color: string; host: string }> = {
  github: { label: 'GitHub', color: '#ffffff', host: 'github.com' },
  gitlab: { label: 'GitLab', color: '#fc6d26', host: 'gitlab.com' },
  codeberg: { label: 'Codeberg', color: '#2185d0', host: 'codeberg.org' },
}

export function platformMeta(p: Platform) {
  return PLATFORM_META[p]
}

export function allPlatforms(): Platform[] {
  return [...PLATFORMS]
}

/**
 * Platforms we WOULD have supported but can't due to API deprecation /
 * missing public search. Surfaced in the UI as disabled toggles so the
 * user knows we considered them.
 */
export const UNSUPPORTED_PLATFORMS: Array<{ id: string; label: string; reason: string }> = [
  { id: 'bitbucket', label: 'Bitbucket', reason: 'API deprecated (410 Gone, kwiecień 2026) — wymaga OAuth' },
  { id: 'sourceforge', label: 'SourceForge', reason: 'Brak publicznego API JSON (tylko HTML)' },
  { id: 'codecommit', label: 'AWS CodeCommit', reason: 'Repozytoria zawsze prywatne (wymaga AWS auth)' },
]

const TIMEOUT_MS = 10_000

async function fetchJSON(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'GenLab-explorer/1.0', ...headers },
      signal: ctrl.signal,
    })
    if (!res.ok) {
      // 403 / 429 — rate limited. Caller handles by treating as 0 results.
      return null
    }
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/* ------------------------------------------------------------------ *
 * GitHub
 * ------------------------------------------------------------------ */
async function searchGitHub(query: string): Promise<RepoSearchResult[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`
  const data = (await fetchJSON(url)) as {
    items?: Array<{
      html_url: string
      full_name: string
      description: string | null
      stargazers_count: number
      language: string | null
      license: { spdx_id: string | null } | null
      updated_at: string | null
      topics?: string[]
    }>
  } | null
  if (!data?.items) return []
  return data.items.slice(0, 10).map((r) => ({
    platform: 'github' as const,
    url: r.html_url,
    name: r.full_name,
    description: r.description,
    stars: r.stargazers_count,
    language: r.language,
    license: r.license?.spdx_id || null,
    updatedAt: r.updated_at,
    topics: r.topics,
  }))
}

/* ------------------------------------------------------------------ *
 * GitLab — /projects endpoint (public; the /search endpoint now
 * requires authentication as of 2024). Searches name + description.
 * ------------------------------------------------------------------ */
async function searchGitLab(query: string): Promise<RepoSearchResult[]> {
  const url = `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(query)}&order_by=star_count&sort=desc&per_page=10`
  const data = (await fetchJSON(url)) as
    | Array<{
        web_url: string
        path_with_namespace: string
        description: string | null
        star_count: number
        repository?: { languages?: string[] } | null
        last_activity_at: string | null
        topics?: string[]
      }>
    | null
  if (!Array.isArray(data)) return []
  return data.slice(0, 10).map((r) => ({
    platform: 'gitlab' as const,
    url: r.web_url,
    name: r.path_with_namespace,
    description: r.description,
    stars: r.star_count,
    language: r.repository?.languages?.[0] || null,
    license: null, // GitLab projects API doesn't return license in list view
    updatedAt: r.last_activity_at,
    topics: r.topics,
  }))
}

/* ------------------------------------------------------------------ *
 * Codeberg — Gitea API repos search
 * ------------------------------------------------------------------ */
async function searchCodeberg(query: string): Promise<RepoSearchResult[]> {
  const url = `https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(query)}&limit=10&sort=stars&order=desc`
  const data = (await fetchJSON(url)) as {
    data?: Array<{
      html_url: string
      full_name: string
      description: string | null
      stars_count: number
      language: string | null
      updated_at: string | null
      topics?: string[]
    }>
  } | null
  if (!data?.data) return []
  return data.data.slice(0, 10).map((r) => ({
    platform: 'codeberg' as const,
    url: r.html_url,
    name: r.full_name,
    description: r.description,
    stars: r.stars_count,
    language: r.language,
    license: null, // Gitea search doesn't include license in list view
    updatedAt: r.updated_at,
    topics: r.topics,
  }))
}

const SEARCHERS: Record<Platform, (q: string) => Promise<RepoSearchResult[]>> = {
  github: searchGitHub,
  gitlab: searchGitLab,
  codeberg: searchCodeberg,
}

/**
 * Search multiple platforms in parallel. Returns all results merged and
 * sorted by stars (desc). Platforms that rate-limit or fail are silently
 * dropped — the UI shows which platforms returned data.
 */
export async function searchRepos(
  query: string,
  platforms: Platform[] = PLATFORMS
): Promise<{ results: RepoSearchResult[]; perPlatform: Record<Platform, number> }> {
  const active = platforms.filter((p) => p in SEARCHERS)
  const searches = await Promise.all(
    active.map(async (p) => {
      try {
        const r = await SEARCHERS[p](query)
        return { platform: p, results: r }
      } catch {
        return { platform: p, results: [] as RepoSearchResult[] }
      }
    })
  )

  const perPlatform = {} as Record<Platform, number>
  for (const p of PLATFORMS) perPlatform[p] = 0
  let all: RepoSearchResult[] = []
  for (const { platform, results } of searches) {
    perPlatform[platform] = results.length
    all = all.concat(results)
  }

  // Sort by stars desc; nulls last
  all.sort((a, b) => {
    if (a.stars == null && b.stars == null) return 0
    if (a.stars == null) return 1
    if (b.stars == null) return -1
    return b.stars - a.stars
  })

  return { results: all, perPlatform }
}
