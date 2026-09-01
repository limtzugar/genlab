'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy,
  Loader2,
  Star,
  ExternalLink,
  FileCode,
  Scale,
  AlertCircle,
  TrendingUp,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { repoUrlToLabel, repoHostLabel } from '@/lib/repo-utils'

/* ------------------------------------------------------------------ *
 * Types — mirror API response
 * ------------------------------------------------------------------ */
type RankedGene = {
  id: string
  techName: string
  category: string
  role: string
  need: string
  githubUrl: string | null
  description: string | null
  language: string | null
  license: string | null
  stars: number | null
  ahiScore: number
  autonomy: number
  ethics: number
  decentral: number
  sessionId: string
  sessionPrompt: string
  sessionCreatedAt: string
}

type RankingResponse = {
  count: number
  avgAhi: number
  topAhi: number
  byCategory: Record<string, number>
  genes: RankedGene[]
}

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const CATEGORY_COLORS: Record<string, string> = {
  input: '#3b82f6',
  processing: '#8b5cf6',
  output: '#10b981',
  infrastructure: '#f59e0b',
  fusion: '#ec4899',
}

const ALL_CATEGORIES = ['input', 'processing', 'output', 'infrastructure', 'fusion']

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export function AhiRankingModule() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RankingResponse | null>(null)

  // Filters
  const [minAhi, setMinAhi] = useState(0)
  const [category, setCategory] = useState<string>('')
  const [limit, setLimit] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (minAhi > 0) params.set('minAhi', String(minAhi))
      if (category) params.set('category', category)
      const res = await fetch(`/api/explore/ahi-ranking?${params.toString()}`)
      const json: RankingResponse = await res.json()
      if (!res.ok) throw new Error((json as unknown as { error?: string }).error || 'Failed')
      setData(json)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(`Ranking AHI: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [minAhi, category, limit])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/30 px-6 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="flex items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
              Ranking AHI genów
            </h2>
          </motion.div>
          <span className="text-[11px] text-muted-foreground font-mono">
            · top {data?.count ?? 0} genów · z przeszłych sesji
          </span>
        </div>

        {/* Stats row */}
        {data && !loading && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Genów" value={String(data.count)} hint="w rankingu" />
            <StatCard label="Średnie AHI" value={data.avgAhi.toFixed(1)} hint="średnia ważona" />
            <StatCard label="Top AHI" value={data.topAhi.toFixed(1)} hint="najlepszy gen" />
            <StatCard
              label="Kategorie"
              value={String(Object.keys(data.byCategory).length)}
              hint="pokryte klasy"
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
            <Filter className="w-3 h-3" />
            Filtry:
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Min AHI:</span>
            <select
              value={minAhi}
              onChange={(e) => setMinAhi(Number(e.target.value))}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#f59e0b]/50"
            >
              <option value={0}>0</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={70}>70</option>
              <option value={80}>80</option>
              <option value={90}>90</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Kategoria:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#f59e0b]/50"
            >
              <option value="">Wszystkie</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Limit:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#f59e0b]/50"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Category distribution bar */}
        {data && !loading && data.count > 0 && (
          <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-muted">
            {ALL_CATEGORIES.map((c) => {
              const n = data.byCategory[c] || 0
              if (n === 0) return null
              const pct = (n / data.count) * 100
              return (
                <div
                  key={c}
                  title={`${c}: ${n}`}
                  style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[c] }}
                  className="h-full transition-all"
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Body — scrollable list */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-3 text-[var(--bad)]" />
            <p className="text-sm font-medium text-foreground mb-1">Błąd ładowania rankingu</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#f59e0b]" />
            <p className="text-xs font-mono">Pobieram geny z bazy...</p>
          </div>
        ) : !data || data.count === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Trophy className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Brak genów spełniających kryteria.</p>
            <p className="text-xs mt-1">Uruchom więcej sesji wynalazków, aby zbudować bazę.</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-2">
            {data.genes.map((g, i) => (
              <RankedGeneCard key={g.id} gene={g} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Stat card
 * ------------------------------------------------------------------ */
function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className="text-lg font-mono font-semibold text-foreground leading-tight">{value}</div>
      <div className="text-[9px] text-muted-foreground/60 font-mono">{hint}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Ranked gene card
 * ------------------------------------------------------------------ */
function RankedGeneCard({ gene, rank }: { gene: RankedGene; rank: number }) {
  const catColor = CATEGORY_COLORS[gene.category] || '#888'
  const ahiColor = gene.ahiScore >= 80 ? '#10b981' : gene.ahiScore >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.02, 0.3) }}
      className="rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors p-3 flex gap-3"
    >
      {/* Rank badge */}
      <div
        className="shrink-0 w-10 h-10 rounded-md flex flex-col items-center justify-center font-mono font-bold"
        style={{ backgroundColor: `${ahiColor}22`, color: ahiColor }}
      >
        <span className="text-[8px] uppercase tracking-wider opacity-70">#</span>
        <span className="text-sm leading-none">{rank}</span>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono font-semibold text-sm">{gene.techName}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono"
            style={{ backgroundColor: `${catColor}22`, color: catColor }}
          >
            {gene.category}
          </span>
          {gene.stars != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground">
              <Star className="w-2.5 h-2.5 text-[var(--warn)]" />
              {gene.stars.toLocaleString('en-US')}
            </span>
          )}
        </div>

        {gene.description && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{gene.description}</p>
        )}

        {/* Metadata grid */}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground flex-wrap">
          {gene.language && (
            <span className="inline-flex items-center gap-1">
              <FileCode className="w-2.5 h-2.5" />
              {gene.language}
            </span>
          )}
          {gene.license && (
            <span className="inline-flex items-center gap-1">
              <Scale className="w-2.5 h-2.5" />
              {gene.license}
            </span>
          )}
          {gene.githubUrl && (
            <a
              href={gene.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--ahi)] transition-colors"
              title={repoHostLabel(gene.githubUrl)}
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {repoUrlToLabel(gene.githubUrl)}
            </a>
          )}
        </div>

        {/* Session provenance */}
        <div className="text-[10px] text-muted-foreground/60 font-mono mt-1 line-clamp-1">
          <span className="opacity-70">z sesji:</span>{' '}
          <span className="italic">„{gene.sessionPrompt.slice(0, 80)}”</span>
        </div>
      </div>

      {/* AHI breakdown — right column */}
      <div className="shrink-0 w-32 flex flex-col items-end gap-1">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
            AHI
          </span>
          <span
            className="text-lg font-mono font-bold leading-none"
            style={{ color: ahiColor }}
          >
            {gene.ahiScore.toFixed(0)}
          </span>
        </div>
        <div className="w-full space-y-0.5">
          <AhiBar label="A" value={gene.autonomy} color="#3b82f6" />
          <AhiBar label="H" value={gene.ethics} color="#10b981" />
          <AhiBar label="D" value={gene.decentral} color="#f59e0b" />
        </div>
      </div>
    </motion.div>
  )
}

function AhiBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] font-mono text-muted-foreground w-2">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[8px] font-mono text-muted-foreground w-6 text-right">
        {value.toFixed(0)}
      </span>
    </div>
  )
}
