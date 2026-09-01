'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Map as MapIcon,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Target,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
type CategoryGap = {
  category: string
  geneCount: number
  status: 'empty' | 'thin' | 'ok'
  suggestion: string
}

type NeedGap = {
  stem: string
  representativeNeed: string
  geneCount: number
  sessionCount: number
  status: 'single' | 'thin'
  genes: Array<{ techName: string; category: string; ahiScore: number; sessionId: string }>
  suggestion: string
}

type GapsResponse = {
  totalSessions: number
  totalGenes: number
  categoryGaps: CategoryGap[]
  uncoveredDomains: string[]
  needGaps: NeedGap[]
  needGapsCount: number
}

const CATEGORY_COLORS: Record<string, string> = {
  input: '#3b82f6',
  processing: '#8b5cf6',
  output: '#10b981',
  infrastructure: '#f59e0b',
  fusion: '#ec4899',
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export function GapsModule() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GapsResponse | null>(null)
  const [needLimit, setNeedLimit] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(needLimit))
      const res = await fetch(`/api/explore/gaps?${params.toString()}`)
      const json: GapsResponse = await res.json()
      if (!res.ok) throw new Error((json as unknown as { error?: string }).error || 'Failed')
      setData(json)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(`Puste miejsca: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [needLimit])

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
            <MapIcon className="w-4 h-4 text-[#ef4444]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
              Puste miejsca
            </h2>
          </motion.div>
          <span className="text-[11px] text-muted-foreground font-mono">
            · {data?.totalGenes ?? 0} genów · {data?.totalSessions ?? 0} sesji
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground max-w-3xl leading-relaxed">
          Analiza białych plam: które <span className="text-[#ef4444] font-medium">kategorie</span>{' '}
          genów są niedoreprezentowane i które{' '}
          <span className="text-[#ef4444] font-medium">potrzeby technologiczne</span> mają
          tylko jedno rozwiązanie. Tu leżą okazje do kolejnych wynalazków.
        </p>

        {data && !loading && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Genów" value={String(data.totalGenes)} hint="w bazie" />
            <StatCard label="Sesji" value={String(data.totalSessions)} hint="przeskanowano" />
            <StatCard
              label="Pustych kategorii"
              value={String(data.uncoveredDomains.length)}
              hint="zero genów"
              alert={data.uncoveredDomains.length > 0}
            />
            <StatCard
              label="Cienkich potrzeb"
              value={String(data.needGapsCount)}
              hint="≤ 2 geny"
              alert={data.needGapsCount > 0}
            />
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <span className="text-muted-foreground font-mono">Limit potrzeb:</span>
          <select
            value={needLimit}
            onChange={(e) => setNeedLimit(Number(e.target.value))}
            className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#ef4444]/50"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-3 text-[var(--bad)]" />
            <p className="text-sm font-medium text-foreground mb-1">Błąd analizy gap</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#ef4444]" />
            <p className="text-xs font-mono">Szukam białych plam...</p>
          </div>
        ) : !data ? null : (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category gaps */}
            <section>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-3">
                <Layers className="w-3 h-3" />
                Pokrycie kategorii
              </div>
              <div className="space-y-2">
                {data.categoryGaps.map((c, i) => (
                  <CategoryGapCard key={c.category} gap={c} index={i} />
                ))}
              </div>
            </section>

            {/* Need gaps */}
            <section>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-3">
                <Target className="w-3 h-3" />
                Potrzeby z cienkim pokryciem ({data.needGaps.length})
              </div>
              {data.needGaps.length === 0 ? (
                <div className="rounded-md border border-border bg-card/50 p-6 text-center text-muted-foreground">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-[#10b981]" />
                  <p className="text-xs">
                    Wszystkie pokryte potrzeby mają ≥ 3 geny. Baza dobrze zbalansowana.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.needGaps.map((g, i) => (
                    <NeedGapCard key={g.stem} gap={g} index={i} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Stat card
 * ------------------------------------------------------------------ */
function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string
  hint: string
  alert?: boolean
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        alert ? 'border-[#ef4444]/40 bg-[#ef4444]/5' : 'border-border bg-card/60'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div
        className={`text-lg font-mono font-semibold leading-tight ${
          alert ? 'text-[#ef4444]' : 'text-foreground'
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground/60 font-mono">{hint}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Category gap card
 * ------------------------------------------------------------------ */
function CategoryGapCard({ gap, index }: { gap: CategoryGap; index: number }) {
  const catColor = CATEGORY_COLORS[gap.category] || '#888'
  const statusIcon =
    gap.status === 'empty' ? (
      <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]" />
    ) : gap.status === 'thin' ? (
      <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b]" />
    ) : (
      <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
    )

  const statusColor =
    gap.status === 'empty'
      ? '#ef4444'
      : gap.status === 'thin'
      ? '#f59e0b'
      : '#10b981'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: catColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">
              {gap.category}
            </span>
            {statusIcon}
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-lg font-mono font-bold leading-none"
            style={{ color: statusColor }}
          >
            {gap.geneCount}
          </div>
          <div className="text-[9px] text-muted-foreground font-mono">genów</div>
        </div>
      </div>

      {/* Coverage bar */}
      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, (gap.geneCount / 20) * 100)}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed flex items-start gap-1">
        <Info className="w-2.5 h-2.5 mt-0.5 shrink-0 opacity-60" />
        {gap.suggestion}
      </p>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ *
 * Need gap card
 * ------------------------------------------------------------------ */
function NeedGapCard({ gap, index }: { gap: NeedGap; index: number }) {
  const statusColor = gap.status === 'single' ? '#ef4444' : '#f59e0b'
  const statusLabel = gap.status === 'single' ? 'JEDNO ROZWIĄZANIE' : 'CIENKIE POKRYCIE'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-lg border border-border bg-card p-3"
      style={{ borderLeftColor: statusColor, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-wider font-mono mb-0.5" style={{ color: statusColor }}>
            {statusLabel}
          </div>
          <p className="text-xs text-foreground line-clamp-2 leading-snug">
            {gap.representativeNeed}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-sm font-mono font-bold leading-none"
            style={{ color: statusColor }}
          >
            {gap.geneCount}
          </div>
          <div className="text-[8px] text-muted-foreground font-mono uppercase">genów</div>
        </div>
      </div>

      {/* Gene chips */}
      {gap.genes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
          {gap.genes.map((g) => {
            const catColor = CATEGORY_COLORS[g.category] || '#888'
            return (
              <span
                key={`${g.techName}-${g.sessionId}`}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono border"
                style={{
                  borderColor: `${catColor}40`,
                  backgroundColor: `${catColor}10`,
                  color: catColor,
                }}
                title={`AHI ${g.ahiScore.toFixed(0)}`}
              >
                {g.techName}
              </span>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed flex items-start gap-1">
        <Info className="w-2.5 h-2.5 mt-0.5 shrink-0 opacity-60" />
        {gap.suggestion}
      </p>
    </motion.div>
  )
}
