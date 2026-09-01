'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Brain, GitBranch, Sparkles, ListTree, FlaskConical, Telescope, Beaker } from 'lucide-react'

type View = 'invent' | 'explore' | 'sessions' | 'graph' | 'about'

type Props = {
  view: View
  onViewChange: (v: View) => void
  recentSessions: Array<{ id: string; prompt: string; summary: string | null }>
  onPickSession: (id: string) => void
}

// About/Enter view removed from sidebar — accessed via TopBar icon button (top-right)
const NAV: Array<{ id: View; label: string; icon: typeof Brain; hint: string }> = [
  { id: 'invent', label: 'Invent', icon: FlaskConical, hint: 'Pipeline wynalazków' },
  { id: 'explore', label: 'Eksploruj', icon: Telescope, hint: 'Atlas repozytoriów' },
  { id: 'sessions', label: 'Sesje', icon: ListTree, hint: 'Historia i persystencja' },
  { id: 'graph', label: 'Graf genów', icon: GitBranch, hint: 'Network wszystkich genów' },
]

export function Sidebar({ view, onViewChange, recentSessions, onPickSession }: Props) {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card/30 flex flex-col">
      <nav className="flex flex-col gap-0.5 p-3">
        {NAV.map((n) => {
          const Icon = n.icon
          const active = view === n.id
          return (
            <button
              key={n.id}
              onClick={() => onViewChange(n.id)}
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--ahi)]' : ''}`} />
              <span className="flex-1 text-left font-medium">{n.label}</span>
              {active && (
                <motion.div
                  layoutId="nav-dot"
                  className="w-1 h-1 rounded-full bg-[var(--ahi)]"
                />
              )}
            </button>
          )
        })}

        {/* Sandbox — osobny route /sandbox, nie view w dashboardzie */}
        <a
          href="/sandbox"
          className="group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-1 border-t border-border/60 pt-3"
          title="Sandbox — eksperymentalna przestrzeń GenLab (nowa wersja 0.3.0)"
        >
          <Beaker className="w-4 h-4 shrink-0 text-[var(--ahi)]" />
          <span className="flex-1 text-left font-medium">Sandbox</span>
          <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded border border-[var(--ahi)]/40 bg-[var(--ahi)]/10 text-[var(--ahi)]">
            NEW
          </span>
        </a>
      </nav>

      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2 px-3 mb-2">
          <Sparkles className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Ostatnie sesje
          </span>
        </div>
        <div className="space-y-0.5 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout">
            {recentSessions.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground/60 italic">
                Brak sesji. Uruchom pipeline po lewej.
              </p>
            ) : (
              recentSessions.map((s) => (
                <motion.button
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => onPickSession(s.id)}
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-muted/60 transition-colors group"
                >
                  <div className="text-xs font-medium truncate group-hover:text-foreground text-muted-foreground">
                    {s.summary || s.prompt.slice(0, 40)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 font-mono truncate mt-0.5">
                    {s.prompt.slice(0, 40)}
                  </div>
                </motion.button>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  )
}
