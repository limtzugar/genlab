'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Github, Star, ExternalLink, ChevronRight, X } from 'lucide-react'
import type { TechGene } from '@/lib/types'
import { repoUrlToLabel, repoHostLabel } from '@/lib/repo-utils'

const CATEGORY_COLORS: Record<string, string> = {
  input: 'var(--good)',
  processing: 'var(--ahi)',
  output: 'var(--warn)',
  infrastructure: '#8b5cf6',
  fusion: '#ec4899',
}

const CATEGORY_LABELS: Record<string, string> = {
  input: 'Wejście',
  processing: 'Przetwarzanie',
  output: 'Wyjście',
  infrastructure: 'Infrastruktura',
  fusion: 'Fuzja',
}

type Props = {
  gene: TechGene
  index: number
  selected?: boolean
  onSelect?: () => void
}

export function GeneCard({ gene, index, selected, onSelect }: Props) {
  const color = CATEGORY_COLORS[gene.category] || 'var(--muted-foreground)'
  const score = gene.ahiScore
  const scoreColor = score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--warn)' : 'var(--bad)'
  const cardRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number; place: 'above' | 'below' } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute where to put the rich popover: prefer above the card, fall back
  // below if there isn't enough room. Card rect measured on every hover-enter.
  const computePopoverPos = useCallback(() => {
    const el = cardRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const POPOVER_W = 380
    const POPOVER_H_EST = 460 // rough estimate for clamping; actual height varies
    // Center horizontally on the card, clamped to viewport with 16px margin
    let x = r.left + r.width / 2 - POPOVER_W / 2
    x = Math.max(16, Math.min(x, window.innerWidth - POPOVER_W - 16))
    // Prefer above; if not enough room, place below
    const roomAbove = r.top
    const place: 'above' | 'below' = roomAbove >= POPOVER_H_EST + 16 ? 'above' : 'below'
    const y = place === 'above' ? r.top - 16 : r.bottom + 16
    return { x, y, place }
  }, [])

  const handleEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      setHovered(true)
      setPopoverPos(computePopoverPos())
    }, 180) // 180ms delay — feels intentional, not jumpy
  }, [computePopoverPos])

  const handleLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHovered(false), 120) // small grace period so moving from card to popover doesn't flicker
  }, [])

  // Recompute on viewport resize while hovered
  useEffect(() => {
    if (!hovered) return
    const onScroll = () => setPopoverPos(computePopoverPos())
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [hovered, computePopoverPos])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    }
  }, [])

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className={`group relative rounded-lg border bg-card p-4 transition-all cursor-pointer ${
          selected
            ? 'border-[var(--ahi)] ring-1 ring-[var(--ahi)]/30'
            : 'border-border hover:border-foreground/20'
        } ${hovered ? 'border-[var(--ahi)]/50 ring-1 ring-[var(--ahi)]/20' : ''}`}
        onClick={onSelect}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect?.()
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {CATEGORY_LABELS[gene.category] || gene.category}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-semibold" style={{ color: scoreColor }}>
              {score}
            </span>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
          </div>
        </div>

        <h4 className="font-semibold text-sm mb-1 font-mono truncate">{gene.techName}</h4>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{gene.role}</p>

        {gene.githubUrl && (
          <a
            href={gene.githubUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <Github className="w-3 h-3" />
            <span className="font-mono truncate max-w-[180px]">
              {repoUrlToLabel(gene.githubUrl)}
            </span>
            <ExternalLink className="w-2.5 h-2.5 opacity-50" />
          </a>
        )}

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          {[
            { label: 'AUT', value: gene.autonomy },
            { label: 'ETH', value: gene.ethics },
            { label: 'DEC', value: gene.decentral },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-[9px] text-muted-foreground font-mono mb-0.5">{m.label}</div>
              <div className="text-xs font-mono font-medium">{Math.round(m.value)}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Rich hover popover — rendered via Portal so it escapes overflow containers.
          Shows full description, AHI reasoning, repo metadata, license, language,
          stars — everything the condensed card hides. */}
      {typeof document !== 'undefined' && hovered && popoverPos && (
        <RichGenePopover
          gene={gene}
          pos={popoverPos}
          color={color}
          categoryLabel={CATEGORY_LABELS[gene.category] || gene.category}
          scoreColor={scoreColor}
          onEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
          }}
          onLeave={handleLeave}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------
 * Rich hover popover — Portal-rendered at document.body level so it
 * survives any overflow:hidden / overflow-x:auto in the parent stack.
 * ------------------------------------------------------------------ */
type PopoverProps = {
  gene: TechGene
  pos: { x: number; y: number; place: 'above' | 'below' }
  color: string
  categoryLabel: string
  scoreColor: string
  onEnter: () => void
  onLeave: () => void
}

function RichGenePopover({
  gene,
  pos,
  color,
  categoryLabel,
  scoreColor,
  onEnter,
  onLeave,
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Position via fixed coords. We use transform + a small spring scale-in
  // for a polished feel. Width fixed at 380px, height auto.
  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    width: 380,
    zIndex: 1000,
    transformOrigin: pos.place === 'above' ? 'bottom center' : 'top center',
  }

  return createPortal(
    <motion.div
      ref={popoverRef}
      style={style}
      initial={{ opacity: 0, scale: 0.92, y: pos.place === 'above' ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      /* Solid background — `bg-popover` doesn't resolve because we never
         defined `--popover` in globals.css. Use explicit theme-aware colors:
         dark theme gets #1a1a1a (slightly lighter than --card #141414 so
         the popover is distinguishable from cards behind it); light theme
         gets pure white. backdrop-blur adds extra polish when the popover
         overlaps the DNA-helix or other content. */
      className="rounded-xl border border-[var(--ahi)]/40 bg-white dark:bg-[#1a1a1a] shadow-2xl backdrop-blur-sm p-4 text-left"
    >
      {/* Arrow pointer toward the card */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border bg-white dark:bg-[#1a1a1a]"
        style={
          pos.place === 'above'
            ? { bottom: -6, borderRight: '1px solid var(--ahi)', borderBottom: '1px solid var(--ahi)', borderTop: 'none', borderLeft: 'none' }
            : { top: -6, borderLeft: '1px solid var(--ahi)', borderTop: '1px solid var(--ahi)', borderRight: 'none', borderBottom: 'none' }
        }
      />

      {/* Header: category dot + label + close affordance (X) */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }}
          />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {categoryLabel}
          </span>
          {gene.need && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate">
              · potrzeb: {gene.need}
            </span>
          )}
        </div>
        <button
          onClick={onLeave}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Zamknij"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Tech name + AHI score */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-base font-mono leading-tight break-words">
          {gene.techName}
        </h4>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
            AHI
          </span>
          <span className="text-lg font-mono font-bold" style={{ color: scoreColor }}>
            {gene.ahiScore}
          </span>
        </div>
      </div>

      {/* Role (one line) */}
      <p className="text-xs text-foreground/90 mb-3 leading-relaxed">{gene.role}</p>

      {/* Full description (multiline) */}
      {gene.description && (
        <div className="mb-3">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
            Opis
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {gene.description}
          </p>
        </div>
      )}

      {/* Repo metadata grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
        {gene.language && (
          <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Język
            </div>
            <div className="font-mono">{gene.language}</div>
          </div>
        )}
        {gene.license && (
          <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Licencja
            </div>
            <div className="font-mono">{gene.license}</div>
          </div>
        )}
        {typeof gene.stars === 'number' && (
          <div className="rounded-md border border-border bg-card/60 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Gwiazdki
            </div>
            <div className="font-mono flex items-center gap-1">
              <Star className="w-3 h-3 text-[var(--warn)]" />
              {gene.stars.toLocaleString('en-US')}
            </div>
          </div>
        )}
        {gene.githubUrl && (
          <a
            href={gene.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border bg-card/60 px-2 py-1.5 hover:border-[var(--ahi)]/50 hover:bg-[var(--ahi-soft)] transition-colors"
          >
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              {repoHostLabel(gene.githubUrl)}
            </div>
            <div className="font-mono flex items-center gap-1 truncate">
              <Github className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {repoUrlToLabel(gene.githubUrl)}
              </span>
            </div>
          </a>
        )}
      </div>

      {/* AHI breakdown — 3 metrics with mini progress bars */}
      <div className="mb-3">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1.5">
          Profil AHI
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'Autonomia', value: gene.autonomy, color: 'var(--ahi)' },
            { label: 'Etyka', value: gene.ethics, color: 'var(--good)' },
            { label: 'Decentralizacja', value: gene.decentral, color: '#8b5cf6' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono w-28 shrink-0">
                {m.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(m.value))}%`, background: m.color }}
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
      {gene.reasoning && (
        <div className="border-t border-border pt-3">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
            Uzasadnienie AHI
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
            {gene.reasoning}
          </p>
        </div>
      )}
    </motion.div>,
    document.body
  )
}
