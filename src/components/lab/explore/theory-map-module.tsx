'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  Loader2,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Dna,
} from 'lucide-react'
import { toast } from 'sonner'
import { repoUrlToLabel } from '@/lib/repo-utils'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
type TheoryGene = {
  techName: string
  category: string
  need: string
  role: string
  githubUrl: string | null
  avgAhi: number
  sessionsSeen: number
}

type TheoryCluster = {
  theoryHash: string
  representativePrompt: string
  altPrompts: string[]
  sessionCount: number
  geneCount: number
  avgAhi: number
  topCategory: string
  sessionIds: string[]
  genes: TheoryGene[]
}

type TheoryMapResponse = {
  count: number
  totalSessionsScanned: number
  clusters: TheoryCluster[]
}

const CATEGORY_COLORS: Record<string, string> = {
  input: '#3b82f6',
  processing: '#8b5cf6',
  output: '#10b981',
  infrastructure: '#f59e0b',
  fusion: '#ec4899',
  unknown: '#888888',
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export function TheoryMapModule() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TheoryMapResponse | null>(null)

  const [minGenes, setMinGenes] = useState(2)
  const [limit, setLimit] = useState(20)
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('minGenes', String(minGenes))
      params.set('limit', String(limit))
      const res = await fetch(`/api/explore/theory-map?${params.toString()}`)
      const json: TheoryMapResponse = await res.json()
      if (!res.ok) throw new Error((json as unknown as { error?: string }).error || 'Failed')
      setData(json)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(`Mapa teorii: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [minGenes, limit])

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
            <Lightbulb className="w-4 h-4 text-[#8b5cf6]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
              Mapa teorii → genów
            </h2>
          </motion.div>
          <span className="text-[11px] text-muted-foreground font-mono">
            · {data?.count ?? 0} teorii · {data?.totalSessionsScanned ?? 0} sesji
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground max-w-3xl leading-relaxed">
          Teoria = unikalny zamiar wynalazczy (znormalizowany prompt). Mapa pokazuje, jakie{' '}
          <span className="text-[var(--ahi)] font-medium">geny technologiczne</span> wyłoniły
          się dla każdej teorii — i które z nich powracają w wielu iteracjach.
        </p>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
            <Filter className="w-3 h-3" />
            Filtry:
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Min genów w teorii:</span>
            <select
              value={minGenes}
              onChange={(e) => setMinGenes(Number(e.target.value))}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#8b5cf6]/50"
            >
              <option value={1}>1+</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Limit teorii:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#8b5cf6]/50"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-3 text-[var(--bad)]" />
            <p className="text-sm font-medium text-foreground mb-1">Błąd ładowania mapy</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#8b5cf6]" />
            <p className="text-xs font-mono">Grupuję sesje w teorie...</p>
          </div>
        ) : !data || data.clusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Lightbulb className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Brak teorii z wystarczającą liczbą genów.</p>
            <p className="text-xs mt-1">
              Obniż próg „min genów” lub zbuduj więcej sesji wynalazków.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-2">
            {data.clusters.map((c, i) => {
              const isOpen = expandedCluster === c.theoryHash
              return (
                <motion.div
                  key={c.theoryHash}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors overflow-hidden"
                >
                  {/* Cluster header */}
                  <button
                    onClick={() => setExpandedCluster(isOpen ? null : c.theoryHash)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                          Teoria #{i + 1}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider"
                          style={{
                            backgroundColor: `${CATEGORY_COLORS[c.topCategory] || '#888'}22`,
                            color: CATEGORY_COLORS[c.topCategory] || '#888',
                          }}
                        >
                          {c.topCategory}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-foreground line-clamp-1">
                        „{c.representativePrompt}”
                      </p>
                      {c.altPrompts.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                          też jako: {c.altPrompts.slice(0, 2).map((p) => `„${p}”`).join(', ')}
                          {c.altPrompts.length > 2 && ` +${c.altPrompts.length - 2}`}
                        </p>
                      )}
                    </div>

                    {/* Stats badges */}
                    <div className="shrink-0 flex items-center gap-2">
                      <Stat label="sesji" value={c.sessionCount} />
                      <Stat label="genów" value={c.geneCount} />
                      <div
                        className="px-2 py-1 rounded text-[10px] font-mono"
                        style={{
                          backgroundColor:
                            c.avgAhi >= 70
                              ? 'rgba(16,185,129,0.15)'
                              : c.avgAhi >= 50
                              ? 'rgba(245,158,11,0.15)'
                              : 'rgba(239,68,68,0.15)',
                          color:
                            c.avgAhi >= 70
                              ? '#10b981'
                              : c.avgAhi >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        AHI {c.avgAhi.toFixed(0)}
                      </div>
                    </div>
                  </button>

                  {/* Expanded genes */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border bg-muted/20"
                      >
                        <div className="px-4 py-3">
                          {/* Flow visualization: theory → genes */}
                          <div className="flex items-start gap-3 mb-3 pb-3 border-b border-border">
                            <div className="shrink-0 px-3 py-2 rounded-md bg-[#8b5cf6]/10 border border-[#8b5cf6]/30">
                              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[#8b5cf6] font-mono mb-0.5">
                                <Lightbulb className="w-2.5 h-2.5" />
                                Teoria
                              </div>
                              <div className="text-[11px] font-mono text-foreground max-w-xs line-clamp-2">
                                {c.representativePrompt}
                              </div>
                            </div>

                            <div className="flex items-center self-center text-[#8b5cf6]">
                              <ArrowRight className="w-4 h-4" />
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                                <Dna className="w-2.5 h-2.5" />
                                Geny ({c.genes.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {c.genes.map((g) => {
                                  const catColor = CATEGORY_COLORS[g.category] || '#888'
                                  return (
                                    <span
                                      key={g.techName}
                                      title={`${g.role}\n${g.need}\nAHI ${g.avgAhi}`}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                                      style={{
                                        borderColor: `${catColor}40`,
                                        backgroundColor: `${catColor}10`,
                                        color: catColor,
                                      }}
                                    >
                                      {g.techName}
                                      <span className="ml-1 opacity-60 text-[8px]">
                                        ×{g.sessionsSeen}
                                      </span>
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Detailed gene list */}
                          <div className="space-y-1.5">
                            {c.genes.map((g) => (
                              <div
                                key={g.techName}
                                className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-card/40 transition-colors"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                                  style={{
                                    backgroundColor: CATEGORY_COLORS[g.category] || '#888',
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono font-medium">
                                      {g.techName}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground font-mono">
                                      {g.category}
                                    </span>
                                    {g.githubUrl && (
                                      <a
                                        href={g.githubUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[9px] text-muted-foreground hover:text-[var(--ahi)] font-mono inline-flex items-center gap-0.5"
                                      >
                                        <ExternalLink className="w-2 h-2" />
                                        {repoUrlToLabel(g.githubUrl)}
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                    {g.need} — {g.role}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div
                                    className="text-[10px] font-mono font-bold"
                                    style={{
                                      color:
                                        g.avgAhi >= 70
                                          ? '#10b981'
                                          : g.avgAhi >= 50
                                          ? '#f59e0b'
                                          : '#ef4444',
                                    }}
                                  >
                                    AHI {g.avgAhi.toFixed(0)}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground font-mono">
                                    ×{g.sessionsSeen} sesji
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center px-2 py-1 rounded bg-muted/40">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono leading-tight">
        {label}
      </div>
      <div className="text-xs font-mono font-semibold text-foreground leading-tight">{value}</div>
    </div>
  )
}
