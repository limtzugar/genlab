'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  GitBranch,
  Loader2,
  FileText,
  Trash2,
  Network,
  Cpu,
  Camera,
  Printer,
  Wifi,
  Battery,
  HardDrive,
  Server,
  Image as ImageIcon,
  Star,
  Download,
  Github,
  ExternalLink,
  FileCode,
  Scale,
} from 'lucide-react'
import type { SessionMeta } from '@/lib/types'
import { toast } from 'sonner'
import { SessionGeneGraph, type SessionMini } from './session-gene-graph'
import { PatentExportButton } from './patent-export-button'
import { repoUrlToLabel, repoHostLabel } from '@/lib/repo-utils'

// Full gene record as returned by /api/sessions/[id]. The DB row includes
// description / language / license / stars / githubUrl / need / reasoning —
// we surface all of them in the session detail view so the user sees the
// complete picture of every repository that fed into the invention.
type SessionGene = {
  id: string
  techName: string
  category: string
  role: string
  need: string
  description: string | null
  githubUrl: string | null
  language: string | null
  license: string | null
  stars: number | null
  autonomy: number
  ethics: number
  decentral: number
  ahiScore: number
  reasoning: string | null
}

type FullSession = {
  id: string
  prompt: string
  mode: string
  status: string
  summary: string | null
  createdAt: string
  genes: SessionGene[]
  inventions: Array<{
    id: string
    name: string
    definition: string
    autonomy: number
    ethics: number
    decentral: number
    ahiscore: number
    reasoning: string
    architecture: string
    patentClaim: string
    priorArt: string
    novelty: string
  }>
  hardware?: Array<{
    id: string
    name: string
    category: string
    vendor: string | null
    role: string
    rationale: string
    estimatedCost: string | null
    alternatives: string | null
    recommended: boolean
  }>
  schematics?: Array<{
    id: string
    kind: string
    size: string
    modelUsed: string
    imageDataUrl: string
    promptText: string
  }>
}

const HW_CATEGORY_META: Record<string, { icon: typeof Cpu; label: string; color: string }> = {
  compute: { icon: Cpu, label: 'Compute', color: '#0ea5e9' },
  sensing: { icon: Camera, label: 'Sensing', color: '#16a34a' },
  actuation: { icon: Cpu, label: 'Actuation', color: '#ea580c' },
  fabrication: { icon: Printer, label: 'Fabrication', color: '#8b5cf6' },
  connectivity: { icon: Wifi, label: 'Connectivity', color: '#d97706' },
  power: { icon: Battery, label: 'Power', color: '#dc2626' },
  storage: { icon: HardDrive, label: 'Storage', color: '#0891b2' },
}

// Color + label map for gene categories — mirrors the GeneCard component
// to keep visual language consistent across the pipeline view and the session
// detail view.
const GENE_CATEGORY_META: Record<string, { label: string; color: string }> = {
  input: { label: 'Wejście', color: 'var(--good)' },
  processing: { label: 'Przetwarzanie', color: 'var(--ahi)' },
  output: { label: 'Wyjście', color: 'var(--warn)' },
  infrastructure: { label: 'Infrastruktura', color: '#8b5cf6' },
  fusion: { label: 'Fuzja', color: '#ec4899' },
}

type Props = {
  /**
   * Session id picked from the sidebar's "Ostatnie sesje" list. When this
   * prop changes (and is non-null), SessionsView auto-loads that session's
   * full record so the detail panel opens immediately — instead of leaving
   * the user staring at the empty state.
   */
  pickedId?: string | null
  /** Called after SessionsView consumes `pickedId`, so the parent can clear
   *  its state and a subsequent click on the same session fires again. */
  onConsumed?: () => void
}

export function SessionsView({ pickedId, onConsumed }: Props) {
  const [selected, setSelected] = useState<FullSession | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Mini-graphs strip state
  const [miniGraphs, setMiniGraphs] = useState<SessionMini[]>([])
  const [loadingGraphs, setLoadingGraphs] = useState(true)
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null)

  // Inline two-step confirmation for the "Usuń" button. We track the id
  // of the session currently in confirm-mode; clicking "Usuń" the first
  // time flips the button to "Potwierdź?" (red), clicking again fires the
  // actual DELETE. Clicking anywhere else or picking another session resets
  // it. This avoids a window.confirm() popup while still being safe.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    const r = await fetch('/api/sessions')
    const d = await r.json()
    return (d.sessions || []) as SessionMeta[]
  }, [])

  // Load full gene data for each session, build mini-graph cards
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const list = await fetchSessions()
        // Only sessions that have at least one gene are useful for the graph strip
        const withGenes = list.filter((s) => s._count.genes > 0)
        const results = await Promise.all(
          withGenes.map(async (s) => {
            try {
              const res = await fetch(`/api/sessions/${s.id}`)
              const data = await res.json()
              const sess = data.session
              if (!sess) return null
              return {
                id: sess.id,
                summary: sess.summary,
                prompt: sess.prompt,
                createdAt: sess.createdAt,
                // Pass full gene info so the mini-graph popover can show repo details
                genes: (sess.genes || []).map((g: {
                  id: string
                  techName: string
                  category: string
                  ahiScore: number
                  githubUrl: string | null
                  description: string | null
                  stars: number | null
                  language: string | null
                  license: string | null
                  role: string
                  need: string
                }) => ({
                  id: g.id,
                  techName: g.techName,
                  category: g.category,
                  ahiScore: g.ahiScore,
                  githubUrl: g.githubUrl,
                  description: g.description,
                  stars: g.stars,
                  language: g.language,
                  license: g.license,
                  role: g.role,
                  need: g.need,
                })),
                inventions: (sess.inventions || []).map((i: { id: string; name: string; ahiscore: number }) => ({
                  id: i.id,
                  name: i.name,
                  ahiscore: i.ahiscore,
                })),
                _count: s._count,
              } as SessionMini
            } catch {
              return null
            }
          })
        )
        if (!mounted) return
        const filtered = results.filter(Boolean) as SessionMini[]
        setMiniGraphs(filtered)
        setLoadingGraphs(false)
      } catch {
        if (mounted) setLoadingGraphs(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [fetchSessions])

  const pick = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setSelected(null)
    setActiveGraphId(id)
    // Reset any pending delete-confirmation from a previously viewed session
    // so the new session doesn't inherit a stale "Potwierdź?" state.
    setConfirmDeleteId(null)
    try {
      const res = await fetch(`/api/sessions/${id}`)
      const data = await res.json()
      setSelected(data.session)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // Consume the pickedId prop — when the parent passes a new id (because the
  // user clicked a session in the sidebar), load it. Also scroll the mini-graph
  // strip into view so the active graph is visible.
  useEffect(() => {
    if (!pickedId) return
    void pick(pickedId)
    onConsumed?.()
  }, [pickedId, pick, onConsumed])

  const archive = async (id: string) => {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', id }),
    })
    setMiniGraphs((s) => s.filter((x) => x.id !== id))
    if (selected?.id === id) setSelected(null)
    if (activeGraphId === id) setActiveGraphId(null)
    toast.success('Sesja zarchiwizowana')
  }

  // Hard delete — wipes the session and all its children (genes, inventions,
  // hardware, schematics) via Prisma cascade. UI updates optimistically and
  // a toast confirms; on failure we surface the error and reload the list.
  const remove = async (id: string) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      if (!res.ok) throw new Error('delete failed')
      setMiniGraphs((s) => s.filter((x) => x.id !== id))
      if (selected?.id === id) setSelected(null)
      if (activeGraphId === id) setActiveGraphId(null)
      setConfirmDeleteId(null)
      toast.success('Sesja usunięta')
    } catch {
      setConfirmDeleteId(null)
      toast.error('Nie udało się usunąć sesji')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Gene-graphs strip — one mini-graph per session, at the very top.
          The whole strip fades up smoothly when the Sessions tab is enabled,
          then each graph springs in with a stagger for a "floating open" feel. */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-border bg-card/30"
      >
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 320, damping: 18 }}
            className="flex items-center gap-2"
          >
            <Network className="w-3.5 h-3.5 text-[var(--ahi)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider font-mono">
              Grafy genów
            </h2>
          </motion.div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-[10px] text-muted-foreground font-mono"
          >
            · {miniGraphs.length} {miniGraphs.length === 1 ? 'sesja' : 'sesji'} · kliknij kółko, by zobaczyć repo
          </motion.span>
        </div>
        <div className="px-4 pb-3 pt-1 overflow-x-auto">
          {loadingGraphs ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-6">
              <Loader2 className="w-3 h-3 animate-spin" />
              Ładowanie grafów…
            </div>
          ) : miniGraphs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Network className="w-6 h-6 opacity-40 mb-1" />
              <p className="text-[11px]">Brak sesji z genami. Uruchom pipeline, aby zobaczyć grafy.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.06,
                    delayChildren: 0.18,
                  },
                },
              }}
              className="flex gap-3 pb-1"
            >
              {miniGraphs.map((s) => (
                <motion.div
                  key={s.id}
                  variants={{
                    hidden: { opacity: 0, y: 24, scale: 0.88 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: 'spring', stiffness: 180, damping: 20 },
                    },
                  }}
                >
                  <SessionGeneGraph
                    session={s}
                    active={activeGraphId === s.id}
                    onPick={pick}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Detail panel — full width (the textual "Historia sesji" list was removed
          because it duplicated the sidebar's "Ostatnie sesje" list. Session
          selection now happens via the mini-graphs strip above or the sidebar.) */}
      <div className="flex-1 overflow-y-auto p-6">
        {loadingDetail ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Wybierz sesję z grafu powyżej lub z paska bocznego, aby zobaczyć detale</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto space-y-6"
          >
            {/* Session header — created date + actions (archive + delete).
                Delete uses inline two-step confirmation: first click reveals
                a red "Potwierdź?" button, second click fires the DELETE.
                AnimatePresence gives a smooth swap between the two states. */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                <Clock className="w-2.5 h-2.5" />
                {new Date(selected.createdAt).toLocaleString('pl-PL', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => archive(selected.id)}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-[var(--bad)] transition-colors"
                  aria-label="Archiwizuj sesję"
                >
                  <Trash2 className="w-3 h-3" />
                  Archiwizuj
                </button>

                <span className="text-muted-foreground/30 text-[10px]">·</span>

                <AnimatePresence mode="wait" initial={false}>
                  {confirmDeleteId === selected.id ? (
                    <motion.button
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => remove(selected.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--bad)] text-white hover:brightness-110 transition-filter"
                      aria-label="Potwierdź usunięcie sesji"
                    >
                      <Trash2 className="w-3 h-3" />
                      Potwierdź?
                    </motion.button>
                  ) : (
                    <motion.button
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      onBlur={() => setConfirmDeleteId(null)}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-[var(--bad)] transition-colors"
                      aria-label="Usuń sesję na stałe"
                      title="Usuń sesję na stałe (razem z genami, wynalazkami i schematami)"
                    >
                      <Trash2 className="w-3 h-3" />
                      Usuń
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                Oryginalny problem
              </div>
              <p className="text-sm">{selected.prompt}</p>
            </div>

            {selected.inventions.map((inv) => (
              <div key={inv.id} className="rounded-lg border border-[var(--ahi)]/30 bg-[var(--ahi-soft)] p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold">{inv.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{inv.definition}</p>
                  </div>
                  <PatentExportButton
                    inventionId={inv.id}
                    inventionName={inv.name}
                    size="sm"
                  />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {[
                    ['AHI', inv.ahiscore],
                    ['AUT', inv.autonomy],
                    ['ETH', inv.ethics],
                    ['DEC', inv.decentral],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                        {l}
                      </div>
                      <div className="text-xl font-mono font-semibold">{v as number}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                    Audyt
                  </div>
                  <p className="text-sm">{inv.reasoning}</p>
                </div>
                {inv.patentClaim && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                      Patent Claim
                    </div>
                    <p className="text-sm">{inv.patentClaim}</p>
                    {inv.novelty && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        <strong>Novelty:</strong> {inv.novelty}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {selected.genes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[var(--ahi)]" />
                  Geny ({selected.genes.length})
                </h3>
                <div className="space-y-3">
                  {selected.genes.map((g, gi) => {
                    const catMeta = GENE_CATEGORY_META[g.category] || {
                      label: g.category,
                      color: 'var(--muted-foreground)',
                    }
                    const scoreColor =
                      g.ahiScore >= 80
                        ? 'var(--good)'
                        : g.ahiScore >= 60
                          ? 'var(--warn)'
                          : 'var(--bad)'
                    return (
                      <motion.div
                        key={g.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.04, duration: 0.25 }}
                        className="rounded-lg border border-border bg-card overflow-hidden"
                      >
                        {/* Header row: category dot + label + need (left), AHI score (right) */}
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                background: catMeta.color,
                                boxShadow: `0 0 0 3px ${catMeta.color}22`,
                              }}
                            />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                              {catMeta.label}
                            </span>
                            {g.need && (
                              <span className="text-[10px] text-muted-foreground/60 font-mono truncate">
                                · potrzeb: {g.need}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                              AHI
                            </span>
                            <span
                              className="text-base font-mono font-bold"
                              style={{ color: scoreColor }}
                            >
                              {g.ahiScore}
                            </span>
                          </div>
                        </div>

                        {/* Body: tech name, role, description, repo, AHI breakdown */}
                        <div className="p-4 space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm font-mono leading-tight break-words">
                              {g.techName}
                            </h4>
                            <p className="text-xs text-foreground/90 mt-1 leading-relaxed">
                              {g.role}
                            </p>
                          </div>

                          {g.description && (
                            <div>
                              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                                Opis
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {g.description}
                              </p>
                            </div>
                          )}

                          {/* Repository metadata — link + language + license + stars.
                              All four are optional in the schema, so we only render
                              the cells that have data. The repo link is always first
                              and most prominent when present. */}
                          {(g.githubUrl || g.language || g.license || typeof g.stars === 'number') && (
                            <div className="grid grid-cols-2 gap-2">
                              {g.githubUrl && (
                                <a
                                  href={g.githubUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border border-border bg-card/60 px-2.5 py-1.5 hover:border-[var(--ahi)]/50 hover:bg-[var(--ahi-soft)] transition-colors group"
                                >
                                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
                                    {repoHostLabel(g.githubUrl)}
                                  </div>
                                  <div className="font-mono text-[11px] flex items-center gap-1 truncate group-hover:text-[var(--ahi)]">
                                    <Github className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{repoUrlToLabel(g.githubUrl)}</span>
                                    <ExternalLink className="w-2.5 h-2.5 opacity-50 shrink-0" />
                                  </div>
                                </a>
                              )}
                              {g.language && (
                                <div className="rounded-md border border-border bg-card/60 px-2.5 py-1.5">
                                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
                                    Język
                                  </div>
                                  <div className="font-mono text-[11px] flex items-center gap-1.5">
                                    <FileCode className="w-3 h-3 text-muted-foreground" />
                                    {g.language}
                                  </div>
                                </div>
                              )}
                              {g.license && (
                                <div className="rounded-md border border-border bg-card/60 px-2.5 py-1.5">
                                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
                                    Licencja
                                  </div>
                                  <div className="font-mono text-[11px] flex items-center gap-1.5">
                                    <Scale className="w-3 h-3 text-muted-foreground" />
                                    {g.license}
                                  </div>
                                </div>
                              )}
                              {typeof g.stars === 'number' && (
                                <div className="rounded-md border border-border bg-card/60 px-2.5 py-1.5">
                                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
                                    Gwiazdki
                                  </div>
                                  <div className="font-mono text-[11px] flex items-center gap-1.5">
                                    <Star className="w-3 h-3 text-[var(--warn)]" />
                                    {g.stars.toLocaleString('en-US')}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* AHI breakdown — three mini progress bars */}
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
                              Profil AHI
                            </div>
                            <div className="space-y-1.5">
                              {[
                                { label: 'Autonomia', value: g.autonomy, color: 'var(--ahi)' },
                                { label: 'Etyka', value: g.ethics, color: 'var(--good)' },
                                { label: 'Decentralizacja', value: g.decentral, color: '#8b5cf6' },
                              ].map((m) => (
                                <div key={m.label} className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground font-mono w-28 shrink-0">
                                    {m.label}
                                  </span>
                                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, Math.round(m.value))}%`,
                                        background: m.color,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono font-medium w-8 text-right">
                                    {Math.round(m.value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* AHI reasoning — full audit explanation */}
                          {g.reasoning && (
                            <div className="border-t border-border pt-2.5">
                              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                                Uzasadnienie AHI
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                                {g.reasoning}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}

            {selected.hardware && selected.hardware.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[var(--ahi)]" />
                  Hardware ({selected.hardware.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selected.hardware.map((h) => {
                    const meta = HW_CATEGORY_META[h.category] || {
                      icon: Server,
                      label: h.category,
                      color: '#71717a',
                    }
                    const Icon = meta.icon
                    return (
                      <div
                        key={h.id}
                        className={`relative rounded-md border bg-card p-3 ${
                          h.recommended
                            ? 'border-[var(--ahi)]/50 ring-1 ring-[var(--ahi)]/20'
                            : 'border-border'
                        }`}
                      >
                        {h.recommended && (
                          <div className="absolute -top-2 left-2 px-1.5 py-0.5 rounded-full bg-[var(--ahi)] text-white text-[9px] font-mono uppercase tracking-wider flex items-center gap-1">
                            <Star className="w-2 h-2" />
                            Kluczowy
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: meta.color }}
                            />
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
                              <Icon className="w-2.5 h-2.5" />
                              {meta.label}
                            </span>
                          </div>
                          {h.estimatedCost && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {h.estimatedCost}
                            </span>
                          )}
                        </div>
                        <h4 className="font-mono text-xs font-semibold mb-0.5 leading-tight">
                          {h.name}
                        </h4>
                        {h.vendor && (
                          <p className="text-[10px] text-muted-foreground mb-1">{h.vendor}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-1.5">
                          {h.role}
                        </p>
                        {h.rationale && (
                          <p className="text-[10px] text-muted-foreground/80 line-clamp-3 italic border-t border-border pt-1.5">
                            {h.rationale}
                          </p>
                        )}
                        {h.alternatives && (
                          <p className="text-[9px] text-muted-foreground/60 mt-1">
                            <strong>Alt:</strong> {h.alternatives}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {selected.schematics && selected.schematics.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[var(--ahi)]" />
                  Schematy ({selected.schematics.length})
                </h3>
                <div className="space-y-3">
                  {selected.schematics.map((sc) => (
                    <div
                      key={sc.id}
                      className="rounded-md border border-border overflow-hidden bg-card"
                    >
                      <div className="bg-muted/30">
                        <img
                          src={sc.imageDataUrl}
                          alt={`Schemat: ${sc.kind}`}
                          className="w-full h-auto block"
                        />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-2">
                          <span className="uppercase tracking-wider">{sc.kind}</span>
                          <span>·</span>
                          <span>{sc.size}</span>
                          <span>·</span>
                          <span>{sc.modelUsed}</span>
                          <a
                            href={sc.imageDataUrl}
                            download={`schemat-${selected.id}.png`}
                            className="ml-auto inline-flex items-center gap-1 text-[var(--ahi)] hover:underline"
                          >
                            <Download className="w-3 h-3" />
                            Pobierz PNG
                          </a>
                        </div>
                        <details>
                          <summary className="text-[10px] font-mono text-muted-foreground cursor-pointer">
                            Pokaż prompt ({sc.promptText.length} znaków)
                          </summary>
                          <pre className="mt-2 text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-muted/40 p-2 rounded-md border border-border max-h-40 overflow-y-auto">
                            {sc.promptText}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
