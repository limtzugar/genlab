'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitMerge,
  Loader2,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Star,
  Network,
  List,
} from 'lucide-react'
import { toast } from 'sonner'
import { FusionGraph, type GraphPair, type GraphGeneMeta } from './fusion-graph'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
type SessionLite = {
  id: string
  prompt: string
  createdAt: string
}

type PairRow = {
  geneA: string
  geneB: string
  coOccur: number
  avgAhi: number
  sessions: SessionLite[]
}

type HubGene = {
  name: string
  partners: number
  appearances: number
  avgAhi: number
  category: string
}

type GeneMeta = {
  category: string
  partners: number
  appearances: number
  avgAhi: number
}

type FusionsResponse = {
  totalPairs: number
  scannedSessions: number
  scannedGenes: number
  pairs: PairRow[]
  hubGenes: HubGene[]
  geneMeta?: Record<string, GeneMeta>
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
export function FusionsModule() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FusionsResponse | null>(null)

  const [minCoOccur, setMinCoOccur] = useState(2)
  const [limit, setLimit] = useState(30)
  const [expandedPair, setExpandedPair] = useState<string | null>(null)
  const [view, setView] = useState<'graph' | 'list'>('graph')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('minCoOccur', String(minCoOccur))
      params.set('limit', String(limit))
      const res = await fetch(`/api/explore/fusions?${params.toString()}`)
      const json: FusionsResponse = await res.json()
      if (!res.ok) throw new Error((json as unknown as { error?: string }).error || 'Failed')
      setData(json)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error(`Wzorce fuzji: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [minCoOccur, limit])

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
            <GitMerge className="w-4 h-4 text-[#10b981]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono">
              Wzorce fuzji
            </h2>
          </motion.div>
          <span className="text-[11px] text-muted-foreground font-mono">
            · {data?.totalPairs ?? 0} par · {data?.scannedSessions ?? 0} sesji ·{' '}
            {data?.scannedGenes ?? 0} unikalnych genów
          </span>
        </div>

        {data && !loading && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Par fuzji" value={String(data.totalPairs)} hint="znaleziono" />
            <StatCard
              label="Sesji"
              value={String(data.scannedSessions)}
              hint="przeskanowano"
            />
            <StatCard
              label="Unikalnych genów"
              value={String(data.scannedGenes)}
              hint="w bazie"
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
            <span className="text-muted-foreground font-mono">Min współwystępowanie:</span>
            <select
              value={minCoOccur}
              onChange={(e) => setMinCoOccur(Number(e.target.value))}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#10b981]/50"
            >
              <option value={1}>1+ (wszystkie)</option>
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={5}>5+</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono">Limit par:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-card border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-[#10b981]/50"
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* View toggle — graph vs list */}
          <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-card/60">
            <button
              onClick={() => setView('graph')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                view === 'graph'
                  ? 'bg-[#10b981]/15 text-[#10b981]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Widok grafowy"
            >
              <Network className="w-3 h-3" />
              Graf
            </button>
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                view === 'list'
                  ? 'bg-[#10b981]/15 text-[#10b981]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Widok listy"
            >
              <List className="w-3 h-3" />
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
          <AlertCircle className="w-10 h-10 mb-3 text-[var(--bad)]" />
          <p className="text-sm font-medium text-foreground mb-1">Błąd ładowania fuzji</p>
          <p className="text-xs">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#10b981]" />
          <p className="text-xs font-mono">Analizuję współwystępowanie genów...</p>
        </div>
      ) : !data || data.pairs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <GitMerge className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Brak par fuzji spełniających kryteria.</p>
          <p className="text-xs mt-1">
            Obniż próg współwystępowania lub zbuduj więcej sesji z tymi samymi genami.
          </p>
        </div>
      ) : view === 'graph' ? (
        <FusionGraph
          pairs={data.pairs as GraphPair[]}
          geneMeta={(data.geneMeta ?? {}) as Record<string, GraphGeneMeta>}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pairs list — 2 cols */}
            <div className="lg:col-span-2 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1">
                <GitMerge className="w-3 h-3" />
                Top pary genów
              </div>
              {data.pairs.map((p, i) => {
                const key = `${p.geneA}|||${p.geneB}`
                const isOpen = expandedPair === key
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedPair(isOpen ? null : key)}
                      className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}

                      {/* Gene pair visualization */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <GeneChip name={p.geneA} />
                        <GitMerge className="w-3 h-3 text-[#10b981] shrink-0" />
                        <GeneChip name={p.geneB} />
                      </div>

                      {/* Stats */}
                      <div className="shrink-0 flex items-center gap-3 text-[10px] font-mono">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">×{p.coOccur}</span>
                        </div>
                        <div
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor:
                              p.avgAhi >= 70
                                ? 'rgba(16,185,129,0.15)'
                                : p.avgAhi >= 50
                                ? 'rgba(245,158,11,0.15)'
                                : 'rgba(239,68,68,0.15)',
                            color:
                              p.avgAhi >= 70
                                ? '#10b981'
                                : p.avgAhi >= 50
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          AHI {p.avgAhi.toFixed(0)}
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-border bg-muted/20"
                        >
                          <div className="px-3 py-2.5 space-y-1.5">
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                              Sesje ({p.sessions.length}{p.coOccur > p.sessions.length ? '+' : ''}):
                            </div>
                            {p.sessions.map((s) => (
                              <a
                                key={s.id}
                                href={`/lab?session=${s.id}`}
                                className="block px-2 py-1.5 rounded hover:bg-card/60 transition-colors group"
                              >
                                <div className="flex items-start gap-2">
                                  <ExternalLink className="w-2.5 h-2.5 mt-0.5 text-muted-foreground group-hover:text-[var(--ahi)]" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-mono text-foreground line-clamp-1">
                                      {s.prompt}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground font-mono">
                                      {new Date(s.createdAt).toLocaleDateString('pl-PL', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>

            {/* Hub genes — 1 col */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1">
                <Star className="w-3 h-3" />
                Hub geny (najwięcej partnerstw)
              </div>
              {data.hubGenes.map((h, i) => {
                const catColor = CATEGORY_COLORS[h.category] || '#888'
                return (
                  <motion.div
                    key={h.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="rounded-md border border-border bg-card p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: catColor }}
                        title={h.category}
                      />
                      <span className="text-xs font-mono font-medium flex-1 truncate">
                        {h.name}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        ×{h.partners}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-muted-foreground">
                      <span>{h.appearances} wystąpień</span>
                      <span
                        style={{
                          color:
                            h.avgAhi >= 70
                              ? '#10b981'
                              : h.avgAhi >= 50
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        AHI {h.avgAhi.toFixed(0)}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Helpers
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

function GeneChip({ name }: { name: string }) {
  return (
    <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border text-[11px] font-mono truncate">
      {name}
    </span>
  )
}
