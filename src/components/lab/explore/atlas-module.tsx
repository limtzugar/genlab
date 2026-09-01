'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  Github,
  GitBranch,
  Star,
  ExternalLink,
  FileCode,
  Scale,
  Clock,
  SlidersHorizontal,
  X,
  AlertCircle,
  Network,
} from 'lucide-react'
import { toast } from 'sonner'
import { repoUrlToLabel } from '@/lib/repo-utils'

/* ------------------------------------------------------------------ *
 * Types — mirror the API response shape
 * ------------------------------------------------------------------ */
type Platform = 'github' | 'gitlab' | 'codeberg'

type RepoSearchResult = {
  platform: Platform
  url: string
  name: string
  description: string | null
  stars: number | null
  language: string | null
  license: string | null
  updatedAt: string | null
  topics?: string[]
}

type SearchResponse = {
  query: string
  results: RepoSearchResult[]
  perPlatform: Record<Platform, number>
  count: number
  error?: string
  message?: string
}

/* ------------------------------------------------------------------ *
 * Platform metadata — icon component + color + label
 * ------------------------------------------------------------------ */
const PLATFORM_META: Record<Platform, { label: string; color: string; icon: typeof Github }> = {
  github: { label: 'GitHub', color: '#ffffff', icon: Github },
  gitlab: { label: 'GitLab', color: '#fc6d26', icon: GitBranch },
  codeberg: { label: 'Codeberg', color: '#2185d0', icon: GitBranch },
}

const ALL_PLATFORMS: Platform[] = ['github', 'gitlab', 'codeberg']

// Platforms we tried but can't support — shown as disabled chips with tooltip
const UNSUPPORTED_PLATFORMS: Array<{ id: string; label: string; reason: string }> = [
  { id: 'bitbucket', label: 'Bitbucket', reason: 'API deprecated (410 Gone, kwiecień 2026) — wymaga OAuth' },
  { id: 'sourceforge', label: 'SourceForge', reason: 'Brak publicznego API JSON (tylko HTML)' },
  { id: 'codecommit', label: 'AWS CodeCommit', reason: 'Repozytoria zawsze prywatne (wymaga AWS auth)' },
]

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export function AtlasModule() {
  const [query, setQuery] = useState('')
  const [activePlatforms, setActivePlatforms] = useState<Set<Platform>>(new Set(ALL_PLATFORMS))
  const [results, setResults] = useState<RepoSearchResult[]>([])
  const [perPlatform, setPerPlatform] = useState<Record<Platform, number>>({
    github: 0,
    gitlab: 0,
    codeberg: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  // Language filter — populated from results. Empty string = no filter.
  const [languageFilter, setLanguageFilter] = useState<string>('')
  // Min stars filter — slider 0/100/1k/10k
  const [minStars, setMinStars] = useState(0)

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const platformsParam = Array.from(activePlatforms).join(',')
      const res = await fetch(
        `/api/explore/repos?q=${encodeURIComponent(q)}&platforms=${platformsParam}`
      )
      const data: SearchResponse = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Search failed')
      }
      setResults(data.results)
      setPerPlatform(data.perPlatform)
      setLanguageFilter('')
      setMinStars(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(`Wyszukiwanie nie powiodło się: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [query, activePlatforms])

  // Submit on Enter (but not while composing IME)
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void runSearch()
    }
  }

  const togglePlatform = (p: Platform) => {
    setActivePlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      // Don't allow empty selection — restore if user tries to remove the last one
      if (next.size === 0) {
        toast.warning('Co najmniej jedna platforma musi być aktywna')
        return prev
      }
      return next
    })
  }

  // Collect unique languages from results for the filter dropdown
  const availableLanguages = Array.from(
    new Set(results.map((r) => r.language).filter(Boolean) as string[])
  ).sort()

  // Apply client-side filters (language + min stars) to the raw results
  const filteredResults = results.filter((r) => {
    if (languageFilter && r.language !== languageFilter) return false
    if (r.stars != null && r.stars < minStars) return false
    if (r.stars == null && minStars > 0) return false // null stars excluded when min>0
    return true
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header — search bar + platform toggles */}
      <div className="border-b border-border bg-card/30 px-6 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="flex items-center gap-2"
          >
            <Network className="w-4 h-4 text-[var(--ahi)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
              Atlas repozytoriów
            </h2>
          </motion.div>
          <span className="text-[11px] text-muted-foreground font-mono">
            · {ALL_PLATFORMS.length} platformy · szukaj realnego DNA wynalazku
          </span>
        </div>

        {/* Search input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="np. federated learning, edge inference, voice cloning..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-card text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--ahi)]/50 focus:ring-1 focus:ring-[var(--ahi)]/30 transition-colors"
              autoFocus
            />
          </div>
          <button
            onClick={runSearch}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--ahi)] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-filter"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Szukaj
          </button>
        </div>

        {/* Platform toggles + per-platform counts. Supported platforms are
            clickable; unsupported ones are shown as disabled chips with a
            tooltip explaining why (Bitbucket API deprecated, SourceForge
            has no JSON API, CodeCommit is private-only). */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mr-1">
            Platformy:
          </span>
          {ALL_PLATFORMS.map((p) => {
            const meta = PLATFORM_META[p]
            const Icon = meta.icon
            const active = activePlatforms.has(p)
            const count = perPlatform[p] || 0
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono transition-colors ${
                  active
                    ? 'border-foreground/30 bg-foreground/5 text-foreground'
                    : 'border-border text-muted-foreground/50 hover:text-muted-foreground'
                }`}
                aria-pressed={active}
              >
                <Icon className="w-3 h-3" style={{ color: active ? meta.color : undefined }} />
                {meta.label}
                {hasSearched && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${
                      count > 0 ? 'bg-[var(--ahi)]/15 text-[var(--ahi)]' : 'bg-muted text-muted-foreground/60'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* Unsupported platforms — disabled chips with tooltip */}
          {UNSUPPORTED_PLATFORMS.map((p) => (
            <span
              key={p.id}
              title={p.reason}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-border text-[11px] font-mono text-muted-foreground/30 cursor-not-allowed"
            >
              <GitBranch className="w-3 h-3" />
              {p.label}
              <span className="text-[8px] uppercase opacity-60">niedostępne</span>
            </span>
          ))}
        </div>
      </div>

      {/* Filters bar — only shown after first search */}
      <AnimatePresence>
        {hasSearched && results.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-muted/20"
          >
            <div className="px-6 py-2 flex items-center gap-4 flex-wrap text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                <SlidersHorizontal className="w-3 h-3" />
                Filtry:
              </div>

              {/* Language filter */}
              {availableLanguages.length > 0 && (
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[var(--ahi)]/50"
                >
                  <option value="">Wszystkie języki</option>
                  {availableLanguages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}

              {/* Min stars filter */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono">Min ★:</span>
                <select
                  value={minStars}
                  onChange={(e) => setMinStars(Number(e.target.value))}
                  className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[var(--ahi)]/50"
                >
                  <option value={0}>0</option>
                  <option value={10}>10</option>
                  <option value={100}>100</option>
                  <option value={1000}>1k</option>
                  <option value={10000}>10k</option>
                </select>
              </div>

              <span className="ml-auto text-muted-foreground font-mono">
                {filteredResults.length} / {results.length} repozytoriów
              </span>

              {(languageFilter || minStars > 0) && (
                <button
                  onClick={() => {
                    setLanguageFilter('')
                    setMinStars(0)
                  }}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" />
                  Wyczyść
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results — scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-3 text-[var(--bad)]" />
            <p className="text-sm font-medium text-foreground mb-1">Błąd wyszukiwania</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--ahi)]" />
            <p className="text-xs font-mono">Szukam na {activePlatforms.size} platformach...</p>
          </div>
        ) : !hasSearched ? (
          <EmptyState />
        ) : filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">
              {results.length === 0
                ? 'Brak wyników. Spróbuj innej frazy.'
                : 'Brak repozytoriów spełniających filtry.'}
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredResults.map((r, i) => (
              <RepoCard key={`${r.platform}-${r.url}`} repo={r} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Empty state — shown before first search
 * ------------------------------------------------------------------ */
function EmptyState() {
  const SUGGESTIONS = [
    'federated learning',
    'edge inference',
    'voice cloning',
    'speech to text',
    'diffusion model',
    'vector database',
    'RAG framework',
    'autonomous agent',
  ]
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <Network className="w-12 h-12 text-[var(--ahi)]/60" />
      </motion.div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Atlas repozytoriów OSS</p>
        <p className="text-xs max-w-md">
          Szukaj realnych projektów open-source na 4 platformach jednocześnie.
          Każde repozytorium to potencjalny <span className="text-[var(--ahi)]">gen technologiczny</span> do
          Twojego następnego wynalazku.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center max-w-lg">
        {SUGGESTIONS.map((s) => (
          <span
            key={s}
            className="px-2.5 py-1 rounded-full bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Repo card — full info per result
 * ------------------------------------------------------------------ */
type RepoCardProps = {
  repo: RepoSearchResult
  index: number
}

function RepoCard({ repo, index }: RepoCardProps) {
  const meta = PLATFORM_META[repo.platform]
  const Icon = meta.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.25 }}
      className="rounded-lg border border-border bg-card hover:border-foreground/20 hover:bg-card/80 transition-all p-4 group"
    >
      {/* Header: platform badge + stars */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {meta.label}
          </span>
        </div>
        {typeof repo.stars === 'number' && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Star className="w-3 h-3 text-[var(--warn)]" />
            {repo.stars.toLocaleString('en-US')}
          </div>
        )}
      </div>

      {/* Repo name (clickable link) */}
      <a
        href={repo.url}
        target="_blank"
        rel="noreferrer"
        className="block font-mono text-sm font-semibold hover:text-[var(--ahi)] transition-colors break-words leading-tight mb-1.5"
      >
        {repo.name}
        <ExternalLink className="w-3 h-3 inline-block ml-1 opacity-40 group-hover:opacity-80" />
      </a>

      {/* Description */}
      {repo.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {repo.description}
        </p>
      )}

      {/* Metadata grid: language + license + updated */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        {repo.language && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <FileCode className="w-2.5 h-2.5" />
            {repo.language}
          </div>
        )}
        {repo.license && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Scale className="w-2.5 h-2.5" />
            {repo.license}
          </div>
        )}
        {repo.updatedAt && (
          <div className="flex items-center gap-1 text-muted-foreground col-span-2">
            <Clock className="w-2.5 h-2.5" />
            Aktualizacja: {new Date(repo.updatedAt).toLocaleDateString('pl-PL', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        )}
      </div>

      {/* Topics (chips) — if any */}
      {repo.topics && repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
          {repo.topics.slice(0, 5).map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted/60 text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Hidden helper: show compact URL label for accessibility */}
      <span className="sr-only">URL: {repoUrlToLabel(repo.url)}</span>
    </motion.div>
  )
}
