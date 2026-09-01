'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PanelLeft } from 'lucide-react'
import { TopBar } from './top-bar'
import { Sidebar } from './sidebar'
import { InventView } from './invent-view'
import { ExploreView } from './explore-view'
import { SessionsView } from './sessions-view'
import { GraphView } from './graph-view'
import { AboutView } from './about-view'
import type { SessionMeta } from '@/lib/types'

type View = 'invent' | 'explore' | 'sessions' | 'graph' | 'about'

export function InnovationLabDashboard() {
  const [view, setView] = useState<View>('invent')
  const [mode, setMode] = useState('invent')
  const [recentSessions, setRecentSessions] = useState<SessionMeta[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // When the user clicks a session in the sidebar's "Ostatnie sesje" list,
  // we store its id here and pass it down to SessionsView. SessionsView
  // consumes it (calls /api/sessions/[id]) and then clears it via onConsumed.
  // This is what makes clicking a sidebar session actually open its details.
  const [pickedSessionId, setPickedSessionId] = useState<string | null>(null)

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json()
      setRecentSessions(data.sessions || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    refreshSessions()
    const interval = setInterval(refreshSessions, 5000)
    return () => clearInterval(interval)
  }, [refreshSessions])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        view={view}
        onViewChange={setView}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0 overflow-hidden"
            >
              <Sidebar
                view={view}
                onViewChange={setView}
                recentSessions={recentSessions}
                onPickSession={(id) => {
                  setView('sessions')
                  setPickedSessionId(id)
                }}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Floating reopen button — visible only when the sidebar is hidden,
            so the user always has a way back without going to the top bar. */}
        <AnimatePresence>
          {!sidebarOpen && (
            <motion.button
              key="reopen"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              onClick={() => setSidebarOpen(true)}
              className="absolute top-3 left-3 z-20 p-1.5 rounded-md border border-border bg-card/80 glass hover:bg-muted hover:border-[var(--ahi)]/40 transition-colors"
              aria-label="Pokaż menu boczne"
              title="Pokaż menu"
            >
              <PanelLeft className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-hidden bg-background">
          {view === 'invent' && <InventView mode={mode} />}
          {view === 'explore' && <ExploreView />}
          {view === 'sessions' && (
            <SessionsView
              pickedId={pickedSessionId}
              onConsumed={() => setPickedSessionId(null)}
            />
          )}
          {view === 'graph' && <GraphView />}
          {view === 'about' && <AboutView />}
        </main>
      </div>
    </div>
  )
}
