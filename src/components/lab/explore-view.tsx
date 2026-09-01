'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network,
  Trophy,
  GitMerge,
  Lightbulb,
  Map as MapIcon,
  type LucideIcon,
} from 'lucide-react'
import { AtlasModule } from './explore/atlas-module'
import { AhiRankingModule } from './explore/ahi-ranking-module'
import { FusionsModule } from './explore/fusions-module'
import { TheoryMapModule } from './explore/theory-map-module'
import { GapsModule } from './explore/gaps-module'

/* ------------------------------------------------------------------ *
 * Module registry — each entry is one tab in the Explore sidebar
 * ------------------------------------------------------------------ */
type ModuleId = 'atlas' | 'ahi-ranking' | 'fusions' | 'theory-map' | 'gaps'

type ModuleMeta = {
  id: ModuleId
  label: string
  short: string
  icon: LucideIcon
  description: string
  accent: string
}

const MODULES: ModuleMeta[] = [
  {
    id: 'atlas',
    label: 'Atlas repozytoriów',
    short: 'Atlas',
    icon: Network,
    description: 'Wieloplatformowe wyszukiwanie repozytoriów OSS',
    accent: 'var(--ahi)',
  },
  {
    id: 'ahi-ranking',
    label: 'Ranking AHI genów',
    short: 'Ranking',
    icon: Trophy,
    description: 'Top geny z przeszłych sesji, sortowane po AHI',
    accent: '#f59e0b',
  },
  {
    id: 'fusions',
    label: 'Wzorce fuzji',
    short: 'Fuzje',
    icon: GitMerge,
    description: 'Pary genów pojawiające się razem w wynalazkach',
    accent: '#10b981',
  },
  {
    id: 'theory-map',
    label: 'Mapa teorii → genów',
    short: 'Teorie',
    icon: Lightbulb,
    description: 'Jakie teorie (prompty) generują jakie geny',
    accent: '#8b5cf6',
  },
  {
    id: 'gaps',
    label: 'Puste miejsca',
    short: 'Gaps',
    icon: MapIcon,
    description: 'Kategorie i potrzeby bez pokrycia w bazie genów',
    accent: '#ef4444',
  },
]

/* ------------------------------------------------------------------ *
 * Container — module switcher + active module viewport
 * ------------------------------------------------------------------ */
export function ExploreView() {
  const [active, setActive] = useState<ModuleId>('atlas')
  const meta = MODULES.find((m) => m.id === active)!

  return (
    <div className="flex h-full">
      {/* Vertical module switcher */}
      <nav className="shrink-0 w-48 border-r border-border bg-card/30 flex flex-col">
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            <Network className="w-3 h-3 text-[var(--ahi)]" />
            Eksploruj
          </div>
          <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono">
            {MODULES.length} moduły
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {MODULES.map((m) => {
            const Icon = m.icon
            const isActive = m.id === active
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`group w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-l-2 ${
                  isActive
                    ? 'bg-foreground/5 border-l-2'
                    : 'border-transparent hover:bg-muted/40'
                }`}
                style={isActive ? { borderColor: m.accent } : undefined}
              >
                <Icon
                  className="w-3.5 h-3.5 mt-0.5 shrink-0"
                  style={{ color: isActive ? m.accent : 'currentColor' }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-medium leading-tight ${
                      isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  >
                    {m.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5 leading-snug line-clamp-2">
                    {m.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Active module viewport */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex-1 overflow-hidden"
          >
            {active === 'atlas' && <AtlasModule />}
            {active === 'ahi-ranking' && <AhiRankingModule />}
            {active === 'fusions' && <FusionsModule />}
            {active === 'theory-map' && <TheoryMapModule />}
            {active === 'gaps' && <GapsModule />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
