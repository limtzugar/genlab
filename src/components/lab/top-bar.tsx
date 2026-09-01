'use client'

import { motion } from 'framer-motion'
import { Dna, Moon, Sun, Github, Activity, Info, PanelLeft } from 'lucide-react'
import { useTheme } from './theme-provider'

type View = 'invent' | 'explore' | 'sessions' | 'graph' | 'about'

type Props = {
  mode: string
  onModeChange: (m: string) => void
  view?: View
  onViewChange?: (v: View) => void
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}

const MODES = [
  { id: 'invent', label: 'Wymyśl', hint: 'Pełny pipeline' },
  { id: 'explore', label: 'Eksploruj', hint: 'Atlas repozytoriów' },
  { id: 'analyze', label: 'Analizuj', hint: 'Głęboki audyt' },
]

export function TopBar({ mode, onModeChange, view, onViewChange, sidebarOpen, onToggleSidebar }: Props) {
  const { theme, toggle } = useTheme()
  const isAboutActive = view === 'about'

  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-card/50 glass">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-md transition-colors ${
              sidebarOpen
                ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                : 'text-foreground bg-muted'
            }`}
            aria-label={sidebarOpen ? 'Ukryj menu boczne' : 'Pokaż menu boczne'}
            aria-pressed={!sidebarOpen}
            title={sidebarOpen ? 'Ukryj menu' : 'Pokaż menu'}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <div className="relative w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
          <Dna className="w-4 h-4 text-background" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">GenLab</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            gene-driven · repo-first · patent-ready
          </span>
        </div>
      </div>

      <nav className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
        {MODES.map((m) => {
          // Map mode → view. 'analyze' falls back to 'invent' for now (TODO).
          const targetView: View = m.id === 'analyze' ? 'invent' : (m.id as View)
          const active = view === targetView
          return (
            <button
              key={m.id}
              onClick={() => {
                onModeChange(m.id)
                onViewChange?.(targetView)
              }}
              className="relative px-3 py-1.5 text-xs font-medium transition-colors rounded-md"
              aria-pressed={active}
              title={m.hint}
            >
              {active && (
                <motion.div
                  layoutId="mode-bg"
                  className="absolute inset-0 rounded-md bg-background shadow-sm border border-border"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-10 ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {m.label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-3">
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="GitHub"
        >
          <Github className="w-4 h-4" />
        </a>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[var(--good)] animate-ping opacity-60" />
            <span className="relative rounded-full bg-[var(--good)] w-1.5 h-1.5" />
          </span>
          <Activity className="w-3 h-3" />
          <span className="font-mono">online</span>
        </div>
        <button
          onClick={toggle}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Przełącz motyw"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {onViewChange && (
          <button
            onClick={() => onViewChange(isAboutActive ? 'invent' : 'about')}
            className={`p-1.5 rounded-md transition-colors ${
              isAboutActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label="O GenLab — jak działa silnik genetyczny"
            aria-pressed={isAboutActive}
            title="O GenLab"
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  )
}
