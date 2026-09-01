'use client'

import { motion } from 'framer-motion'
import {
  Dna,
  Shield,
  GitBranch,
  Brain,
  ArrowRight,
  FlaskConical,
  Scroll,
  Layers,
  BookOpen,
} from 'lucide-react'

const AGENTS = [
  {
    name: 'Problem Analyst',
    role: 'Warstwa teoretyczna',
    desc: 'Rozkłada problem użytkownika na domeny, punkty bólu i kryteria sukcesu. Teoria jest jedną z warstw krytycznych pipeline — ale nie jedyną.',
    color: '#16a34a',
  },
  {
    name: 'Gene Extractor',
    role: 'Repo-first discovery',
    desc: 'Szuka KONKRETNYCH, istniejących repozytoriów GitHub — nie teoretycznych abstrakcji. Każdy gen ma realnego ownera, realny README, realne issue.',
    color: '#ea580c',
  },
  {
    name: 'AHI Ethicist',
    role: 'Audyt etyczny genu',
    desc: 'Dla każdego genu ocenia autonomię, etykę i decentralizację na podstawie licencji, README i architektury. Geny z niskim AHI = obciążone dziedzictwo.',
    color: '#d97706',
  },
  {
    name: 'Fusion Strategist',
    role: 'Synteza wynalazku',
    desc: 'Łączy geny w nową jakość — wynalazek, którego żaden gen nie posiada samodzielnie. Tworzy patent claim z prior art.',
    color: '#8b5cf6',
  },
  {
    name: 'System Architect',
    role: 'Finalny audyt',
    desc: 'Ocenia cały system (nie pojedyncze geny) pod kątem AHI dla końcowego użytkownika. Decyduje czy wynalazek jest real-realizable.',
    color: '#0ea5e9',
  },
]

const PIPELINE_LAYERS = [
  {
    icon: BookOpen,
    title: 'Teoria',
    subtitle: 'Warstwa krytyczna #1',
    desc: 'Analiza problemu, domeny, kryteria sukcesu. Definiuje co budujemy i dlaczego — bez tego fuzja jest ślepa.',
    color: '#16a34a',
  },
  {
    icon: GitBranch,
    title: 'Repozytoria',
    subtitle: 'Warstwa krytyczna #2',
    desc: 'Realne, istniejące projekty open-source z GitHub. Konkretne implementacje, nie teoretyczne rysunki. To jest pierwsze koło napędowe Enter.',
    color: '#ea580c',
  },
  {
    icon: Dna,
    title: 'Geny',
    subtitle: 'Warstwa krytyczna #3',
    desc: 'Każde repo = gen z rolą w architekturze. Kategoria (input/processing/output/infrastructure), potrzebna zdolność, techniczna funkcja.',
    color: '#8b5cf6',
  },
  {
    icon: Shield,
    title: 'AHI',
    subtitle: 'Warstwa krytyczna #4',
    desc: 'Autonomiczność · Etyka · Decentralizacja. Filtr genetyczny — odrzuca DNA obciążone korporacyjnym lock-in, telemetrym lub centralizacją.',
    color: '#d97706',
  },
  {
    icon: FlaskConical,
    title: 'Fuzja',
    subtitle: 'Warstwa krytyczna #5',
    desc: 'Synteza nowej jakości z genów. Nie suma funkcji — emergentna zdolność, której żaden gen sam nie posiada.',
    color: '#0ea5e9',
  },
  {
    icon: Scroll,
    title: 'Patent',
    subtitle: 'Warstwa krytyczna #6',
    desc: 'Claim of novelty + prior art reference. Enter nie tylko generuje wynalazek — formułuje go w języku zdolnym do obrony IP.',
    color: '#dc2626',
  },
]

export function AboutView() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Dna className="w-6 h-6 text-[var(--ahi)]" />
            <h1 className="text-2xl font-semibold tracking-tight">Enter</h1>
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider border border-border rounded-full px-2 py-0.5">
              gene-driven
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter to silnik genetyczny wynalazków i patentów. Odkrywa DNA nowych rozwiązań
            szukając <strong className="text-foreground">konkretnych repozytoriów open-source</strong>{' '}
            na GitHub (nie teoretycznych abstrakcji), łączy je jak geny w nowe wynalazki,
            i formułuje patent claim. Teoria jest jedną z sześciu warstw krytycznych pipeline —
            nie jedyną.
          </p>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-4">
            <Layers className="w-4 h-4 text-[var(--ahi)]" />
            Sześć warstw krytycznych pipeline
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PIPELINE_LAYERS.map((l, i) => {
              const Icon = l.icon
              return (
                <div
                  key={l.title}
                  className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${l.color}20`, color: l.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-semibold">{l.title}</span>
                    </div>
                    <div
                      className="text-[10px] uppercase tracking-wider font-mono mb-1.5"
                      style={{ color: l.color }}
                    >
                      {l.subtitle}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{l.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-4">
            <Brain className="w-4 h-4 text-[var(--ahi)]" />
            Architektura multi-agentowa
          </h2>
          <div className="space-y-2">
            {AGENTS.map((a, i) => (
              <div
                key={a.name}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold shrink-0"
                  style={{ background: `${a.color}20`, color: a.color }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                      {a.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-4">
            <Shield className="w-4 h-4 text-[var(--ahi)]" />
            Framework AHI — filtr genetyczny
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                t: 'Autonomiczność',
                q: 'Czy użytkownik może to uruchomić sam?',
                d: 'Self-hosting, brak vendor lock-in, dane pod kontrolą użytkownika',
                color: 'var(--good)',
              },
              {
                t: 'Etyka',
                q: 'Czy system szanuje użytkownika?',
                d: 'Licencja open-source, brak telemetry, brak trackingu, transparentność',
                color: 'var(--ahi)',
              },
              {
                t: 'Decentralizacja',
                q: 'Czy władza jest rozproszona?',
                d: 'P2P, federacja, CRDT, brak centralnego punktu kontroli',
                color: 'var(--warn)',
              },
            ].map((d) => (
              <div key={d.t} className="rounded-lg border border-border bg-card p-4">
                <div className="w-2 h-2 rounded-full mb-2" style={{ background: d.color }} />
                <div className="text-sm font-semibold mb-1">{d.t}</div>
                <div className="text-[11px] text-muted-foreground/80 italic mb-2">{d.q}</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">{d.d}</div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-4">
            <GitBranch className="w-4 h-4 text-[var(--ahi)]" />
            Przepływ pipeline
          </h2>
          <div className="flex items-center flex-wrap gap-2">
            {['Problem', 'Teoria', 'Geny', 'GitHub', 'AHI', 'Fuzja', 'Patent'].map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-md border border-border bg-card text-xs font-mono">
                  {i + 1}. {s}
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70 italic mt-3 leading-relaxed">
            Enter jest pierwszym kołem napędowym realizacji wynalazku — nie ostatnim.
            Każdy krok produces konretny artefakt (analiza, gen, AHI score, fuzja, claim).
            Teoria jest jedną z warstw, ale ostatecznym wyjściem jest real-realizable projekt
            z realnych repozytoriów.
          </p>
        </motion.section>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[11px] text-muted-foreground/60 font-mono text-center pt-4 border-t border-border"
        >
          Enter · gene-driven · repo-first · patent-ready · multi-agent SSE · Prisma persistence
        </motion.div>
      </div>
    </div>
  )
}
