'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical,
  Beaker,
  TestTube,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ExternalLink,
  Shield,
  Database,
  Cpu,
  Activity,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'

/* ------------------------------------------------------------------ *
 * Sandbox — eksperymentalna przestrzeń GenLab
 * ------------------------------------------------------------------ *
 * W pełni odizolowana od produkcyjnego pipeline /lab:
 *  - nie wywołuje agentów
 *  - nie zapisuje do bazy (read-only na sessions, no writes)
 *  - własna przestrzeń nazw: /sandbox/* + /api/sandbox/*
 *  - własne API endpoints (sandbox/status, sandbox/experiments)
 *
 * Tu testujemy nowe algorytmy, UI, fuzje — zanim wejdą do /lab.
 * ------------------------------------------------------------------ */

type Status = {
  name: string
  version: string
  sandboxEnabled: boolean
  sandboxVersion: string
  environment: string
  timestamp: string
  experiments: Experiment[]
  activeCount: number
  plannedCount: number
  isolation: {
    database: string
    agents: string
    sessionsTable: string
    notes: string
  }
}

type Experiment = {
  id: string
  title: string
  description: string
  status: 'planned' | 'active' | 'archived'
  category: 'ui' | 'analysis' | 'synthesis' | 'output' | 'input'
  href?: string
  inspirations?: string[]
}

const CATEGORY_META: Record<
  Experiment['category'],
  { label: string; color: string; icon: LucideIcon }
> = {
  ui: { label: 'UI / UX', color: '#3b82f6', icon: FlaskConical },
  analysis: { label: 'Analiza', color: '#8b5cf6', icon: TestTube },
  synthesis: { label: 'Synteza', color: '#ec4899', icon: Beaker },
  output: { label: 'Output', color: '#10b981', icon: Activity },
  input: { label: 'Input', color: '#f59e0b', icon: Cpu },
}

const STATUS_META: Record<
  Experiment['status'],
  { label: string; color: string; icon: LucideIcon }
> = {
  planned: { label: 'Planowany', color: '#6b7280', icon: Clock },
  active: { label: 'Aktywny', color: '#10b981', icon: CheckCircle2 },
  archived: { label: 'Zarchiwizowany', color: '#9ca3af', icon: AlertTriangle },
}

export function SandboxDashboard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/sandbox/status', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Status
        if (!cancelled) {
          setStatus(data)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/60 glass">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/lab"
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Wróć do GenLab"
              title="Wróć do /lab"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div className="relative w-7 h-7 rounded-md bg-[var(--ahi)] flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-background" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">GenLab Sandbox</span>
                <AnimatePresence>
                  {status && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-[var(--ahi)]/40 bg-[var(--ahi)]/10 text-[var(--ahi)]"
                    >
                      NOWA WERSJA {status.sandboxVersion}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                experimental · isolated · no db writes
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--ahi)] animate-ping opacity-60" />
                  <span className="relative rounded-full bg-[var(--ahi)] w-1.5 h-1.5" />
                </span>
                <span className="font-mono">
                  sandbox v{status.sandboxVersion} · {status.environment}
                </span>
              </div>
            )}
            <a
              href="/api/sandbox/status"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="API status JSON"
              title="GET /api/sandbox/status"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground font-mono text-sm">
              ładowanie sandboxa…
            </div>
          </div>
        )}

        {error && (
          <div className="border border-red-500/40 bg-red-500/5 rounded-lg p-6 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-500 mb-1">
                  Nie można załadować sandboxa
                </h3>
                <p className="text-sm text-muted-foreground font-mono">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Endpoint <code className="font-mono">/api/sandbox/status</code> musi
                  odpowiadać 200. Sprawdź dev server.
                </p>
              </div>
            </div>
          </div>
        )}

        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-8"
          >
            {/* Hero */}
            <section className="border border-border rounded-xl p-8 bg-card/30 relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ background: 'var(--ahi)' }}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                    Tryb eksperymentalny · {status.name} v{status.version}
                  </span>
                </div>
                <h1 className="font-display text-5xl font-extrabold tracking-tight mb-3">
                  Sandbox nowej wersji
                </h1>
                <p className="text-muted-foreground max-w-2xl leading-relaxed">
                  Eksperymentalna przestrzeń GenLab, w której testujemy nowe algorytmy,
                  UI i koncepcje fuzji zanim wejdą do produkcyjnego pipeline{' '}
                  <code className="font-mono text-foreground/80">/lab</code>. Sandbox
                  jest w pełni odizolowany: nie wywołuje agentów, nie zapisuje do bazy,
                  nie dotyka sesji użytkownika. Wszystkie operacje są read-only lub
                  in-memory.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <Stat
                    icon={FlaskConical}
                    label="Eksperymenty"
                    value={String(status.experiments.length)}
                    accent="var(--ahi)"
                  />
                  <Stat
                    icon={CheckCircle2}
                    label="Aktywne"
                    value={String(status.activeCount)}
                    accent="#10b981"
                  />
                  <Stat
                    icon={Clock}
                    label="Planowane"
                    value={String(status.plannedCount)}
                    accent="#6b7280"
                  />
                  <Stat
                    icon={Shield}
                    label="Izolacja DB"
                    value="read-only"
                    accent="#3b82f6"
                  />
                </div>
              </div>
            </section>

            {/* Isolation panel */}
            <section className="border border-border rounded-xl p-6 bg-card/20">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-[var(--ahi)]" />
                <h2 className="text-sm font-semibold tracking-tight">
                  Gwarancja izolacji
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <IsolationCard
                  icon={Database}
                  title="Baza danych"
                  value={status.isolation.database}
                />
                <IsolationCard
                  icon={Cpu}
                  title="Agenci"
                  value={status.isolation.agents}
                />
                <IsolationCard
                  icon={Activity}
                  title="Tabela sesji"
                  value={status.isolation.sessionsTable}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-4 italic">
                {status.isolation.notes}
              </p>
            </section>

            {/* Experiments grid */}
            <section>
              <div className="flex items-baseline justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Beaker className="w-4 h-4 text-[var(--ahi)]" />
                  <h2 className="text-sm font-semibold tracking-tight">
                    Eksperymenty w kolejce
                  </h2>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                  {status.experiments.length} pozycji
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {status.experiments.map((exp, idx) => {
                  const cat = CATEGORY_META[exp.category]
                  const stat = STATUS_META[exp.status]
                  const CatIcon = cat.icon
                  const StatIcon = stat.icon
                  const isActive = exp.status === 'active' && exp.href
                  const CardTag = isActive ? 'a' : 'article'
                  return (
                    <motion.div
                      key={exp.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                      className={`border rounded-lg p-5 bg-card/30 transition-colors group ${
                        isActive
                          ? 'border-[var(--ahi)]/40 hover:bg-card/60 hover:border-[var(--ahi)] cursor-pointer'
                          : 'border-border hover:bg-card/50'
                      }`}
                    >
                      <CardTag
                        {...(isActive ? { href: exp.href } : {})}
                        className="block"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-md flex items-center justify-center"
                              style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                            >
                              <CatIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold tracking-tight">
                                {exp.title}
                              </h3>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {exp.id}
                              </span>
                            </div>
                          </div>
                          <span
                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded border"
                            style={{
                              borderColor: `${stat.color}40`,
                              backgroundColor: `${stat.color}10`,
                              color: stat.color,
                            }}
                          >
                            <StatIcon className="w-3 h-3" />
                            {stat.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {exp.description}
                        </p>
                        {exp.inspirations && exp.inspirations.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {exp.inspirations.map((insp) => (
                              <span
                                key={insp}
                                className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-muted/60 text-muted-foreground border border-border/60"
                              >
                                {insp}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${cat.color}1a`,
                              color: cat.color,
                            }}
                          >
                            {cat.label}
                          </span>
                          {isActive ? (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--ahi)] font-semibold">
                              Otwórz
                              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              dostępne wkrótce
                            </span>
                          )}
                        </div>
                      </CardTag>
                    </motion.div>
                  )
                })}
              </div>
            </section>

            {/* Footer */}
            <footer className="text-xs text-muted-foreground font-mono pt-6 border-t border-border">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <span>
                  sandbox v{status.sandboxVersion} · {new Date(status.timestamp).toLocaleString('pl-PL')}
                </span>
                <span>
                  <a href="/lab" className="hover:text-foreground transition-colors">
                    ← wróć do /lab
                  </a>
                </span>
              </div>
            </footer>
          </motion.div>
        )}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Subcomponents
 * ------------------------------------------------------------------ */

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-background/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3" style={{ color: accent }} />
        <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="text-xl font-semibold tracking-tight" style={{ color: accent }}>
        {value}
      </div>
    </div>
  )
}

function IsolationCard({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon
  title: string
  value: string
}) {
  return (
    <div className="border border-border rounded-lg p-4 bg-background/30">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          {title}
        </span>
      </div>
      <p className="text-sm font-mono">{value}</p>
    </div>
  )
}
