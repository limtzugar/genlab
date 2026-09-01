'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  GitBranch,
  Shield,
  Sparkles,
  Scroll,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  RefreshCw,
  Cpu,
  Camera,
  Printer,
  Wifi,
  Battery,
  HardDrive,
  Server,
  Image as ImageIcon,
  Star,
  AlertTriangle,
  Wallet,
  Zap,
  Crown,
} from 'lucide-react'
import { useInventionPipeline } from './use-invention-pipeline'
import { GeneCard } from './gene-card'
import { AhiGauge } from './ahi-gauge'
import { PatentExportButton } from './patent-export-button'
import { toast } from 'sonner'

const STAGES = [
  { id: 'analysis', label: 'Analiza', icon: Brain },
  { id: 'genes', label: 'Geny', icon: GitBranch },
  { id: 'ahi', label: 'AHI', icon: Shield },
  { id: 'fusion', label: 'Fuzja', icon: Sparkles },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
  { id: 'schematic-image', label: 'Schemat', icon: ImageIcon },
] as const

export function InventView({ mode }: { mode: string }) {
  const [prompt, setPrompt] = useState('')
  const { state, run, reset, regenerateSchematic, selectSolution } = useInventionPipeline()
  const isRunning = state.status === 'running'

  // Hardware components currently shown — filtered by selected solution.
  // If no solutions (legacy / skipped), show all hardware.
  const visibleHardware =
    state.solutions.length > 0
      ? state.hardware.filter((h) => h.solutionId === state.selectedSolutionId)
      : state.hardware
  const selectedSolution = state.solutions.find(
    (s) => s.solutionId === state.selectedSolutionId
  )

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error('Wpisz problem do rozwiązania')
      return
    }
    await run(prompt, mode)
  }

  const handleExport = async () => {
    if (!state.fusion?.inventionId) return
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventionId: state.fusion.inventionId }),
    })
    const { filename, content } = await res.json()
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Wyeksportowano do Markdown')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Results — top, scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Error */}
          {state.status === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-[var(--bad)]/30 bg-[var(--bad)]/5 p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-[var(--bad)] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-[var(--bad)]">Pipeline nie powiódł się</div>
                <div className="text-xs text-muted-foreground mt-1">{state.error}</div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleSubmit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Spróbuj ponownie
                  </button>
                  <button
                    onClick={reset}
                    className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    Wyczyść
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Analysis */}
          {state.analysis && (
            <Section title="Analiza problemu" icon={Brain}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                    Streszczenie
                  </div>
                  <p className="text-sm">{state.analysis.summary}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                      Domeny
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {state.analysis.domains.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 text-[11px] rounded-md bg-muted border border-border"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {state.analysis.painPoints.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                    Punkty bólu
                  </div>
                  <ul className="space-y-1 text-sm">
                    {state.analysis.painPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[var(--ahi)] mt-1.5 text-[10px]">●</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Genes */}
          {state.genes.length > 0 && (
            <Section
              title={`Geny technologiczne (${state.genes.length})`}
              icon={GitBranch}
              hint={isRunning && state.stage === 'ahi' ? 'oceniam AHI…' : undefined}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence mode="popLayout">
                  {state.genes.map((g, i) => (
                    <GeneCard key={g.id || i} gene={g} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            </Section>
          )}

          {/* Fusion result */}
          {state.fusion && (
            <>
              <Section title="Wynalazek" icon={Sparkles}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-[var(--ahi)]/30 bg-[var(--ahi-soft)] p-5"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">{state.fusion.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{state.fusion.definition}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Markdown
                      </button>
                      <PatentExportButton
                        inventionId={state.fusion.inventionId}
                        inventionName={state.fusion.name}
                        size="sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground/80 italic border-l-2 border-[var(--ahi)]/30 pl-3">
                    {state.fusion.fusionStrategy}
                  </p>
                </motion.div>
              </Section>

              <Section title="Architektura" icon={GitBranch}>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-muted/40 p-4 rounded-md border border-border">
                  {state.fusion.architecture}
                </pre>
              </Section>

              {state.fusion.patentClaim && (
                <Section title="Patent framing" icon={Scroll}>
                  <div className="space-y-4">
                    <div className="rounded-md border border-[var(--ahi)]/30 bg-[var(--ahi-soft)] p-4">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                        Claim of Novelty
                      </div>
                      <p className="text-sm leading-relaxed">{state.fusion.patentClaim}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md border border-border bg-card/60 p-4">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                          Prior Art
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {state.fusion.priorArt || 'Brak danych.'}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-card/60 p-4">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                          Novelty
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {state.fusion.novelty || 'Brak danych.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              <Section title="Audyt AHI" icon={Shield}>
                <div className="rounded-lg border border-border bg-card p-5">
                  <AhiGauge
                    autonomy={state.fusion.ahi.autonomy}
                    ethics={state.fusion.ahi.ethics}
                    decentral={state.fusion.ahi.decentral}
                    size="lg"
                  />
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">
                      Uzasadnienie audytora
                    </div>
                    <p className="text-sm leading-relaxed">{state.fusion.ahi.reasoning}</p>
                  </div>
                </div>
              </Section>

              {/* Stage 6: Hardware — with solution variant selector */}
              <Section
                title={`Hardware (${visibleHardware.length})`}
                icon={Cpu}
                hint={isRunning && state.stage === 'hardware' ? 'analizuję warianty…' : undefined}
              >
                {state.hardwareSkipped && state.solutions.length === 0 ? (
                  <div className="flex items-start gap-2 p-3 rounded-md border border-[var(--warn)]/30 bg-[var(--warn)]/5">
                    <AlertTriangle className="w-4 h-4 text-[var(--warn)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">Warstwa hardware pominięta</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{state.hardwareSkipped}</p>
                    </div>
                  </div>
                ) : state.hardware.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {isRunning && state.stage === 'hardware'
                      ? 'Wybieram konkretne warianty komponentów sprzętowych…'
                      : 'Brak propozycji hardware.'}
                  </div>
                ) : (
                  <>
                    {/* Solution variant selector — Budget / Performance / Pro */}
                    {state.solutions.length > 0 && (
                      <SolutionSelector
                        solutions={state.solutions}
                        selectedId={state.selectedSolutionId}
                        onSelect={selectSolution}
                        disabled={isRunning}
                      />
                    )}

                    {/* Selected solution's components */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      <AnimatePresence mode="popLayout">
                        {visibleHardware.map((h, i) => (
                          <HardwareCard key={h.id || `${state.selectedSolutionId}-${i}`} hw={h} />
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Total cost footer for the selected solution */}
                    {selectedSolution && selectedSolution.estimatedTotalCost && (
                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border pt-3">
                        <span>
                          {visibleHardware.length} komponentów · wariant:{' '}
                          <strong className="text-foreground">{selectedSolution.name}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted border border-border">
                          <Wallet className="w-3 h-3" />
                          Łącznie: <strong className="text-foreground">{selectedSolution.estimatedTotalCost}</strong>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* Stage 7: Schematic — with "Regenerate for this variant" button */}
              <Section
                title="Schemat urządzenia / mockup appki"
                icon={ImageIcon}
                hint={
                  isRunning && state.stage === 'schematic-prompt'
                    ? 'buduję prompt graficzny…'
                    : isRunning && state.stage === 'schematic-image'
                    ? 'generuję obraz…'
                    : state.schematicRegenerating
                    ? 'regeneruję dla wybranego wariantu…'
                    : undefined
                }
              >
                {state.schematicImage ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-border overflow-hidden bg-muted/30 relative">
                      <img
                        src={state.schematicImage.imageDataUrl}
                        alt={`Schemat: ${state.fusion?.name || ''}`}
                        className={`w-full h-auto block transition-opacity ${
                          state.schematicRegenerating ? 'opacity-30' : 'opacity-100'
                        }`}
                      />
                      {state.schematicRegenerating && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--ahi)]" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground flex-wrap">
                      <span>Typ: {state.schematicImage.kind}</span>
                      <span>·</span>
                      <span>{state.schematicImage.size}</span>
                      <span>·</span>
                      <span>{state.schematicImage.modelUsed}</span>
                      {state.schematicPrompt?.solutionName && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--ahi)]">
                            wariant: {state.schematicPrompt.solutionName}
                          </span>
                        </>
                      )}
                      <a
                        href={state.schematicImage.imageDataUrl}
                        download={`schemat-${state.fusion?.name || 'wynalazek'}.png`}
                        className="ml-auto inline-flex items-center gap-1 text-[var(--ahi)] hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        Pobierz PNG
                      </a>
                    </div>

                    {/* Regenerate schematic for the currently selected solution */}
                    {state.solutions.length > 1 && state.selectedSolutionId && (
                      <button
                        onClick={() => regenerateSchematic(state.selectedSolutionId!)}
                        disabled={
                          state.schematicRegenerating ||
                          state.schematicPrompt?.solutionId === state.selectedSolutionId
                        }
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-[var(--ahi)]/30 bg-[var(--ahi-soft)] hover:bg-[var(--ahi)]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={
                          state.schematicPrompt?.solutionId === state.selectedSolutionId
                            ? 'Schemat jest już wygenerowany dla tego wariantu'
                            : `Regeneruj schemat dla wariantu: ${selectedSolution?.name || ''}`
                        }
                      >
                        {state.schematicRegenerating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Regeneruj schemat dla wariantu:{' '}
                        <strong className="text-[var(--ahi)]">{selectedSolution?.name || ''}</strong>
                      </button>
                    )}

                    {state.schematicPrompt?.promptText && (
                      <details className="mt-2">
                        <summary className="text-[10px] font-mono text-muted-foreground cursor-pointer">
                          Pokaż prompt ({state.schematicPrompt.promptText.length} znaków)
                        </summary>
                        <pre className="mt-2 text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-muted/40 p-3 rounded-md border border-border max-h-48 overflow-y-auto">
                          {state.schematicPrompt.promptText}
                        </pre>
                      </details>
                    )}
                  </div>
                ) : state.schematicSkipped ? (
                  <div className="flex items-start gap-2 p-3 rounded-md border border-[var(--warn)]/30 bg-[var(--warn)]/5">
                    <AlertTriangle className="w-4 h-4 text-[var(--warn)] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium">Generowanie schematu pominięte</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{state.schematicSkipped}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {isRunning && (state.stage === 'schematic-prompt' || state.stage === 'schematic-image')
                      ? 'Tworzę szczegółowy prompt i generuję schemat urządzenia…'
                      : 'Schemat pojawi się po zakończeniu warstwy hardware.'}
                  </div>
                )}
              </Section>
            </>
          )}

          {/* Empty state removed per request — the input area below makes it
              obvious the user should type. No need for a redundant hint with
              an icon and a keyboard shortcut that varies by OS. */}
        </div>
      </div>

      {/* Pipeline visualization — just above input */}
      {state.status !== 'idle' && (
        <div className="border-t border-border px-6 py-3 bg-card/20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            {STAGES.map((s, i) => {
              const Icon = s.icon
              const stageIndex = STAGES.findIndex((x) => x.id === state.stage)
              const active = state.stage === s.id
              const done = stageIndex > i || state.status === 'done'
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                        active
                          ? 'border-[var(--ahi)] bg-[var(--ahi)] text-white'
                          : done
                          ? 'border-[var(--good)] bg-[var(--good)] text-white'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : active ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        active ? 'text-foreground' : done ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-3 ${
                        done ? 'bg-[var(--good)]' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
          {isRunning && state.stageLabel && (
            <motion.p
              key={state.stageLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] text-muted-foreground text-center mt-2 font-mono"
            >
              {state.stageLabel}
            </motion.p>
          )}
        </div>
      )}

      {/* Prompt input — fixed bottom. Label and placeholder removed per
          request — the textarea is enough on its own; the user knows what
          to type. Keeps the input area visually quieter. */}
      <div className="border-t border-border p-6 bg-card/30">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isRunning}
              rows={3}
              placeholder=""
              className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-32 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ahi)]/30 focus:border-[var(--ahi)]/50 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-2">
              {state.status === 'done' && (
                <button
                  onClick={reset}
                  className="px-3 py-1.5 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Od nowa
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isRunning || !prompt.trim()}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Pracuję…
                  </>
                ) : (
                  <>
                    Wymyśl
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  hint,
  children,
}: {
  title: string
  icon: typeof Brain
  hint?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-[var(--ahi)]" />
          {title}
        </h2>
        {hint && (
          <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            {hint}
          </span>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-5">{children}</div>
    </motion.section>
  )
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

/**
 * Picks an icon for a solution variant based on its name.
 * - "Budget" / "DIY" / "Tani" → Wallet
 * - "Performance" / "Szybki" / "Pro" → Zap
 * - "Pro Lab" / "Enterprise" / "Lab" → Crown
 * - default → Cpu
 */
function pickSolutionIcon(name: string): typeof Cpu {
  const n = name.toLowerCase()
  if (n.includes('budget') || n.includes('diy') || n.includes('tani') || n.includes('mini')) {
    return Wallet
  }
  if (n.includes('perform') || n.includes('szybki') || n.includes('fast') || n.includes('edge')) {
    return Zap
  }
  if (n.includes('pro') || n.includes('lab') || n.includes('enterprise') || n.includes('server')) {
    return Crown
  }
  return Cpu
}

function SolutionSelector({
  solutions,
  selectedId,
  onSelect,
  disabled,
}: {
  solutions: import('@/lib/types').HardwareSolution[]
  selectedId: string | null
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
        <Cpu className="w-2.5 h-2.5" />
        Wybierz wariant rozwiązania
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {solutions.map((sol) => {
          const isActive = sol.solutionId === selectedId
          const Icon = pickSolutionIcon(sol.name)
          return (
            <motion.button
              key={sol.solutionId}
              type="button"
              onClick={() => onSelect(sol.solutionId)}
              disabled={disabled}
              whileHover={!disabled ? { scale: 1.01 } : undefined}
              whileTap={!disabled ? { scale: 0.99 } : undefined}
              className={`relative text-left p-3 rounded-md border transition-all ${
                isActive
                  ? 'border-[var(--ahi)] bg-[var(--ahi-soft)] ring-1 ring-[var(--ahi)]/30'
                  : 'border-border bg-card hover:border-[var(--ahi)]/40 hover:bg-muted/40'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.div
                  layoutId="solution-active-dot"
                  className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--ahi)]"
                />
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center ${
                    isActive ? 'bg-[var(--ahi)] text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-xs font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {sol.name}
                </span>
              </div>
              {sol.estimatedTotalCost && (
                <div className="text-[10px] font-mono text-muted-foreground mb-1">
                  ~<strong className={isActive ? 'text-[var(--ahi)]' : 'text-foreground'}>{sol.estimatedTotalCost}</strong>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-2">
                {sol.pitch || `${sol.hardware.length} komponentów`}
              </p>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function HardwareCard({ hw }: { hw: import('@/lib/types').HardwareComponent }) {
  const meta = HW_CATEGORY_META[hw.category] || { icon: Server, label: hw.category, color: '#71717a' }
  const Icon = meta.icon
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-md border bg-card p-3 ${
        hw.recommended
          ? 'border-[var(--ahi)]/50 ring-1 ring-[var(--ahi)]/20'
          : 'border-border'
      }`}
    >
      {hw.recommended && (
        <div className="absolute -top-2 left-2 px-1.5 py-0.5 rounded-full bg-[var(--ahi)] text-white text-[9px] font-mono uppercase tracking-wider flex items-center gap-1">
          <Star className="w-2 h-2" />
          Kluczowy
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1">
            <Icon className="w-2.5 h-2.5" />
            {meta.label}
          </span>
        </div>
        {hw.estimatedCost && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {hw.estimatedCost}
          </span>
        )}
      </div>
      <h4 className="font-mono text-xs font-semibold mb-1 leading-tight">{hw.name}</h4>
      {hw.vendor && (
        <p className="text-[10px] text-muted-foreground mb-1.5">{hw.vendor}</p>
      )}
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{hw.role}</p>
      {hw.rationale && (
        <p className="text-[10px] text-muted-foreground/80 line-clamp-2 italic border-t border-border pt-2">
          {hw.rationale}
        </p>
      )}
      {hw.alternatives && (
        <p className="text-[9px] text-muted-foreground/60 mt-1.5">
          <strong>Alt:</strong> {hw.alternatives}
        </p>
      )}
    </motion.div>
  )
}
