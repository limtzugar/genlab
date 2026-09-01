'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Star, ExternalLink, X, Cpu, FileText } from 'lucide-react'
import { repoUrlToLabel, repoHostLabel } from '@/lib/repo-utils'

type GeneLite = {
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
}

type SessionMini = {
  id: string
  summary: string | null
  prompt: string
  createdAt: string
  genes: GeneLite[]
  inventions: Array<{ id: string; name: string; ahiscore: number }>
  _count: { genes: number; inventions: number }
}

const CATEGORY_COLORS: Record<string, string> = {
  input: '#16a34a',
  processing: '#ea580c',
  output: '#d97706',
  infrastructure: '#8b5cf6',
  fusion: '#0ea5e9',
}

const CATEGORY_LABELS: Record<string, string> = {
  input: 'Wejście',
  processing: 'Przetwarzanie',
  output: 'Wyjście',
  infrastructure: 'Infrastruktura',
  fusion: 'Fuzja',
}

const CARD_W = 260
const SVG_W = 260
const SVG_H = 150
const CENTER_X = SVG_W / 2
const CENTER_Y = SVG_H / 2

const POPOVER_W = 280
const POPOVER_H = 320

type Props = {
  session: SessionMini
  active: boolean
  onPick: (id: string) => void
}

export function SessionGeneGraph({ session, active, onPick }: Props) {
  const [selectedGene, setSelectedGene] = useState<GeneLite | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Arrange gene nodes on a circle around the center.
  const layout = useMemo(() => {
    const genes = session.genes
    const n = genes.length
    if (n === 0) return []
    const radius = Math.min(SVG_W, SVG_H) * 0.4
    return genes.map((g, i) => {
      const angle = n === 1 ? Math.PI / 2 : (i / n) * 2 * Math.PI - Math.PI / 2
      return {
        gene: g,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
      }
    })
  }, [session.genes])

  const invention = session.inventions?.[0]
  const centerColor = invention ? CATEGORY_COLORS.fusion : '#71717a'
  const centerRadius = invention ? 14 : 9
  const title = session.summary || session.prompt.slice(0, 60)
  const date = new Date(session.createdAt).toLocaleString('pl-PL', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const openGenePopover = useCallback((gene: GeneLite, clientX: number, clientY: number) => {
    // Clamp popover position so it stays inside the viewport
    const padding = 12
    const x = Math.min(
      Math.max(padding, clientX - POPOVER_W / 2),
      window.innerWidth - POPOVER_W - padding
    )
    // Prefer above the click point; if not enough room, place below
    const aboveSpace = clientY - padding
    const belowSpace = window.innerHeight - clientY - padding
    let y: number
    if (aboveSpace >= POPOVER_H + 8) {
      y = clientY - POPOVER_H - 8
    } else if (belowSpace >= POPOVER_H + 8) {
      y = clientY + 8
    } else {
      // Not enough room either side — center vertically and clamp
      y = Math.max(padding, Math.min(window.innerHeight - POPOVER_H - padding, clientY - POPOVER_H / 2))
    }
    setPopoverPos({ x, y })
    setSelectedGene((cur) => (cur?.id === gene.id ? null : gene))
  }, [])

  // Close popover on Escape
  useEffect(() => {
    if (!selectedGene) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGene(null)
        setPopoverPos(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedGene])

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      whileHover={{ y: -3 }}
      className={`relative shrink-0 rounded-lg border bg-card text-left overflow-visible transition-colors ${
        active
          ? 'border-[var(--ahi)] ring-1 ring-[var(--ahi)]/40'
          : 'border-border hover:border-[var(--ahi)]/40'
      }`}
      style={{ width: CARD_W }}
    >
      {/* Header strip — clickable to open session */}
      <button
        type="button"
        onClick={() => onPick(session.id)}
        className="w-full px-2.5 pt-2 pb-1 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
        aria-label={`Otwórz sesję: ${title}`}
      >
        <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
          {date}
        </span>
        <span className="text-[10px] font-mono text-[var(--ahi)]">
          {session._count.genes} genów
        </span>
      </button>

      {/* SVG graph */}
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="block w-full"
      >
        {/* Edges first (under nodes) */}
        {layout.map(({ gene, x, y }) => (
          <line
            key={`edge-${gene.id}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={x}
            y2={y}
            stroke={CATEGORY_COLORS[gene.category] || '#71717a'}
            strokeOpacity={hoveredId && hoveredId !== gene.id ? 0.1 : 0.35}
            strokeWidth={hoveredId === gene.id ? 1.8 : 1}
            style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
          />
        ))}

        {/* Gene nodes — interactive */}
        {layout.map(({ gene, x, y }) => {
          const color = CATEGORY_COLORS[gene.category] || '#71717a'
          const r = 5 + (gene.ahiScore / 100) * 5
          const isSelected = selectedGene?.id === gene.id
          const isHovered = hoveredId === gene.id
          return (
            <g
              key={`node-${gene.id}`}
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement | null)?.getBoundingClientRect()
                const cx = rect ? rect.left + (x / SVG_W) * rect.width : e.clientX
                const cy = rect ? rect.top + (y / SVG_H) * rect.height : e.clientY
                openGenePopover(gene, cx, cy)
              }}
              onMouseEnter={() => setHoveredId(gene.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`Gen: ${gene.techName}`}
            >
              {/* hover ring */}
              {(isHovered || isSelected) && (
                <circle
                  cx={x}
                  cy={y}
                  r={r + 4}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  className="pointer-events-none"
                >
                  <animate
                    attributeName="r"
                    values={`${r + 3};${r + 6};${r + 3}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={color}
                opacity={hoveredId && hoveredId !== gene.id ? 0.4 : 1}
                style={{ transition: 'opacity 0.2s' }}
              />
              {layout.length <= 8 && (
                <text
                  x={x}
                  y={y + r + 9}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  fill="currentColor"
                  className="text-muted-foreground pointer-events-none"
                >
                  {gene.techName.slice(0, 16)}
                </text>
              )}
            </g>
          )
        })}

        {/* Center node (session / invention) — also clickable to open session */}
        <g
          onClick={(e) => {
            e.stopPropagation()
            onPick(session.id)
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          aria-label={`Otwórz sesję: ${title}`}
        >
          {invention && (
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={centerRadius + 5}
              fill="none"
              stroke={centerColor}
              strokeOpacity={0.2}
              strokeWidth={1}
              className="pointer-events-none"
            >
              <animate
                attributeName="r"
                values={`${centerRadius + 4};${centerRadius + 8};${centerRadius + 4}`}
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.2;0.05;0.2"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={centerRadius}
            fill={centerColor}
            stroke="white"
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
          {invention && (
            <text
              x={CENTER_X}
              y={CENTER_Y + centerRadius + 12}
              textAnchor="middle"
              fontSize={8}
              fontWeight={600}
              fontFamily="ui-sans-serif, system-ui"
              fill="currentColor"
              className="pointer-events-none"
            >
              {invention.name.slice(0, 24)}
            </text>
          )}
        </g>
      </svg>

      {/* Footer — clickable to open session */}
      <button
        type="button"
        onClick={() => onPick(session.id)}
        className="w-full px-2.5 pb-2 pt-1 text-left hover:bg-muted/40 transition-colors"
        aria-label={`Otwórz sesję: ${title}`}
      >
        <p className="text-[11px] font-medium leading-tight line-clamp-2">
          {title}
        </p>
        {invention && (
          <p className="text-[10px] font-mono text-[var(--ahi)] mt-0.5">
            AHI {invention.ahiscore}
          </p>
        )}
      </button>

      {/* Gene detail popover — rendered via Portal so it escapes overflow containers */}
      {typeof document !== 'undefined' && selectedGene && popoverPos && (
        <GenePopover
          gene={selectedGene}
          position={popoverPos}
          onClose={() => {
            setSelectedGene(null)
            setPopoverPos(null)
          }}
        />
      )}
    </motion.div>
  )
}

/**
 * Floating popover that renders via React Portal at document.body level.
 * Escapes all overflow containers. Includes click-outside-to-close.
 */
function GenePopover({
  gene,
  position,
  onClose,
}: {
  gene: GeneLite
  position: { x: number; y: number }
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.92, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: -6 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: POPOVER_W,
          zIndex: 1000,
        }}
        className="rounded-md border border-[var(--ahi)]/50 bg-white dark:bg-[#1a1a1a] shadow-2xl backdrop-blur-sm p-3 text-left"
      >
        {/* Subtle pointer arrow on top — only when popover is below the click point */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: CATEGORY_COLORS[gene.category] || '#71717a' }}
            />
            <span className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground">
              {CATEGORY_LABELS[gene.category] || gene.category}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="text-muted-foreground/60 hover:text-foreground shrink-0"
            aria-label="Zamknij"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <h4 className="font-mono text-xs font-semibold mb-1 truncate">
          {gene.techName}
        </h4>
        <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">
          {gene.role}
        </p>

        {gene.githubUrl && (
          <a
            href={gene.githubUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-[var(--ahi)] hover:underline mb-2 font-mono"
          >
            <Github className="w-2.5 h-2.5" />
            {repoUrlToLabel(gene.githubUrl)}
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </a>
        )}

        {gene.description && (
          <div className="mb-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Opis
            </div>
            <p className="text-[10px] leading-relaxed line-clamp-3">
              {gene.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border">
          <RepoMetric
            icon={<Star className="w-2.5 h-2.5" />}
            label="Gwiazdki"
            value={
              gene.stars != null
                ? gene.stars > 1000
                  ? `${(gene.stars / 1000).toFixed(1)}k`
                  : String(gene.stars)
                : '—'
            }
          />
          <RepoMetric
            icon={<Cpu className="w-2.5 h-2.5" />}
            label="Język"
            value={gene.language || '—'}
          />
          <RepoMetric
            icon={<FileText className="w-2.5 h-2.5" />}
            label="Licencja"
            value={gene.license || '—'}
          />
        </div>

        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px] font-mono">
          <span className="text-muted-foreground">AHI</span>
          <span className="font-semibold text-[var(--ahi)]">
            {Math.round(gene.ahiScore)}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

function RepoMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[8px] uppercase tracking-wider font-mono">{label}</span>
      </div>
      <span className="text-[10px] font-mono truncate" title={value}>
        {value}
      </span>
    </div>
  )
}

export type { SessionMini, GeneLite }
