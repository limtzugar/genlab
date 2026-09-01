'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { ExternalLink, Star, X, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { repoUrlToLabel } from '@/lib/repo-utils'

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
export type GraphGeneMeta = {
  category: string
  partners: number
  appearances: number
  avgAhi: number
}

export type GraphPair = {
  geneA: string
  geneB: string
  coOccur: number
  avgAhi: number
  sessions: Array<{ id: string; prompt: string; createdAt: string }>
}

type SimNode = SimulationNodeDatum & {
  id: string
  name: string
  category: string
  partners: number
  appearances: number
  avgAhi: number
}

type SimLink = {
  source: SimNode | string
  target: SimNode | string
  coOccur: number
  avgAhi: number
}

const CATEGORY_COLORS: Record<string, string> = {
  input: '#3b82f6',
  processing: '#8b5cf6',
  output: '#10b981',
  infrastructure: '#f59e0b',
  fusion: '#ec4899',
  unknown: '#6b7280',
}

const CATEGORY_LABELS: Record<string, string> = {
  input: 'Input',
  processing: 'Processing',
  output: 'Output',
  infrastructure: 'Infra',
  fusion: 'Fusion',
  unknown: 'Other',
}

/* ------------------------------------------------------------------ *
 * Force-directed graph component
 * ------------------------------------------------------------------ */
type FusionGraphProps = {
  pairs: GraphPair[]
  geneMeta: Record<string, GraphGeneMeta>
}

export function FusionGraph({ pairs, geneMeta }: FusionGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])

  const [tick, setTick] = useState(0) // bump to trigger SVG redraw
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Track container size for responsive SVG
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        setDimensions({ width: Math.max(400, width), height: Math.max(300, height) })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Build nodes + links from API data
  const { initialNodes, initialLinks } = useMemo(() => {
    const nodeMap = new Map<string, SimNode>()
    for (const p of pairs) {
      if (!nodeMap.has(p.geneA)) {
        const meta = geneMeta[p.geneA] ?? {
          category: 'unknown',
          partners: 0,
          appearances: 0,
          avgAhi: p.avgAhi,
        }
        nodeMap.set(p.geneA, {
          id: p.geneA,
          name: p.geneA,
          category: meta.category,
          partners: meta.partners,
          appearances: meta.appearances,
          avgAhi: meta.avgAhi,
        })
      }
      if (!nodeMap.has(p.geneB)) {
        const meta = geneMeta[p.geneB] ?? {
          category: 'unknown',
          partners: 0,
          appearances: 0,
          avgAhi: p.avgAhi,
        }
        nodeMap.set(p.geneB, {
          id: p.geneB,
          name: p.geneB,
          category: meta.category,
          partners: meta.partners,
          appearances: meta.appearances,
          avgAhi: meta.avgAhi,
        })
      }
    }
    const nodes = Array.from(nodeMap.values())
    // Initialize positions in a circle for stable startup
    const cx = dimensions.width / 2
    const cy = dimensions.height / 2
    const r = Math.min(dimensions.width, dimensions.height) * 0.35
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      n.x = cx + r * Math.cos(angle)
      n.y = cy + r * Math.sin(angle)
      n.vx = 0
      n.vy = 0
    })
    const links: SimLink[] = pairs.map((p) => ({
      source: p.geneA,
      target: p.geneB,
      coOccur: p.coOccur,
      avgAhi: p.avgAhi,
    }))
    return { initialNodes: nodes, initialLinks: links }
  }, [pairs, geneMeta], dimensions.width, dimensions.height])

  // Initialize / re-init simulation when data or dimensions change
  useEffect(() => {
    if (initialNodes.length === 0) return

    // Deep copy nodes so we don't mutate the memoized originals
    const nodes: SimNode[] = initialNodes.map((n) => ({ ...n }))
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const links: SimLink[] = initialLinks.map((l) => ({
      source: l.source,
      target: l.target,
      coOccur: l.coOccur,
      avgAhi: l.avgAhi,
    }))

    nodesRef.current = nodes
    linksRef.current = links

    // Compute max coOccur for link strength scaling
    const maxCo = Math.max(...links.map((l) => l.coOccur), 1)
    const maxPartners = Math.max(...nodes.map((n) => n.partners), 1)

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => (typeof d === 'string' ? d : d.id))
          .distance((l) => 80 - (l.coOccur / maxCo) * 50) // closer for stronger pairs
          .strength((l) => 0.15 + (l.coOccur / maxCo) * 0.5)
      )
      .force(
        'charge',
        forceManyBody<SimNode>().strength((d) => -120 - (d.partners / maxPartners) * 200)
      )
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4)
      )
      .alpha(1)
      .alphaDecay(0.025)
      .velocityDecay(0.35)

    sim.on('tick', () => {
      // Resolve link source/target to actual node objects after sim init
      // (d3 mutates them into node references on first tick)
      setTick((t) => (t + 1) % 1000000)
    })

    simulationRef.current = sim

    return () => {
      sim.stop()
      simulationRef.current = null
    }
  }, [initialNodes, initialLinks, dimensions.width, dimensions.height])

  // Re-heat simulation when filters change (just for nice UX)
  const reheat = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.8).restart()
    }
  }, [])

  // Dragging a node pins it
  const dragNode = useRef<SimNode | null>(null)
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const onNodePointerDown = (e: React.PointerEvent, node: SimNode) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragNode.current = node
    const svg = svgRef.current
    if (svg) {
      const rect = svg.getBoundingClientRect()
      dragOffset.current = {
        x: e.clientX - rect.left - (node.x ?? 0),
        y: e.clientY - rect.top - (node.y ?? 0),
      }
    }
    node.fx = node.x
    node.fy = node.y
    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0.3).restart()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragNode.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - dragOffset.current.x
    const y = e.clientY - rect.top - dragOffset.current.y
    dragNode.current.fx = x
    dragNode.current.fy = y
    setTick((t) => (t + 1) % 1000000)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragNode.current) {
      dragNode.current.fx = null
      dragNode.current.fy = null
      dragNode.current = null
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0)
      }
    }
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)))
  }

  // Pan
  const panRef = useRef<{ x: number; y: number } | null>(null)
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    panRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setSelectedNode(null)
  }
  const onBackgroundPointerMove = (e: React.PointerEvent) => {
    if (!panRef.current) return
    setPan({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y })
  }
  const onBackgroundPointerUp = (e: React.PointerEvent) => {
    panRef.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  // Resolve link endpoints to node refs (d3-force does this internally, but
  // we need it for rendering)
  const resolvedLinks = linksRef.current.map((l) => {
    const source = typeof l.source === 'string' ? nodesRef.current.find((n) => n.id === l.source) : l.source
    const target = typeof l.target === 'string' ? nodesRef.current.find((n) => n.id === l.target) : l.target
    return { ...l, source, target }
  })

  // Highlight neighbors when hovering a node
  const neighborSet = useMemo(() => {
    if (!hoveredNode && !selectedNode) return null
    const focus = selectedNode ?? hoveredNode
    if (!focus) return null
    const neighbors = new Set<string>([focus])
    for (const l of resolvedLinks) {
      const s = typeof l.source === 'string' ? l.source : (l.source as SimNode)?.id
      const t = typeof l.target === 'string' ? l.target : (l.target as SimNode)?.id
      if (s === focus && t) neighbors.add(t)
      if (t === focus && s) neighbors.add(s)
    }
    return neighbors
  }, [hoveredNode, selectedNode, tick]) 

  // Selected node detail
  const selectedNodeData = selectedNode
    ? nodesRef.current.find((n) => n.id === selectedNode) ?? null
    : null
  const selectedNodePairs = selectedNode
    ? pairs
        .filter((p) => p.geneA === selectedNode || p.geneB === selectedNode)
        .sort((a, b) => b.coOccur - a.coOccur)
    : []

  if (initialNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-xs">Brak par do wyrysowania grafu.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-card/20">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z * 0.85))}
          className="p-1.5 rounded-md border border-border bg-card/80 backdrop-blur-sm hover:bg-card transition-colors"
          title="Pomniejsz"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-muted-foreground w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(3, z * 1.15))}
          className="p-1.5 rounded-md border border-border bg-card/80 backdrop-blur-sm hover:bg-card transition-colors"
          title="Powiększ"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
            reheat()
          }}
          className="p-1.5 rounded-md border border-border bg-card/80 backdrop-blur-sm hover:bg-card transition-colors"
          title="Reset pozycji"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 px-3 py-2 rounded-md border border-border bg-card/80 backdrop-blur-sm">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
          Kategorie
        </div>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
          const count = nodesRef.current.filter((n) => n.category === cat).length
          if (count === 0) return null
          return (
            <div key={cat} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
              <span className="text-muted-foreground/50 ml-auto">{count}</span>
            </div>
          )
        })}
      </div>

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 touch-none"
        style={{ cursor: panRef.current ? 'grabbing' : 'grab' }}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={(e) => {
          onPointerMove(e)
          onBackgroundPointerMove(e)
        }}
        onPointerUp={(e) => {
          onPointerUp(e)
          onBackgroundPointerUp(e)
        }}
        onWheel={onWheel}
      >
        <g
          transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
        >
          {/* Edges */}
          <g>
            {resolvedLinks.map((l, i) => {
              const s = l.source as SimNode | undefined
              const t = l.target as SimNode | undefined
              if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return null
              const isHighlighted =
                neighborSet &&
                ((s.id === hoveredNode || s.id === selectedNode) ||
                  (t.id === hoveredNode || t.id === selectedNode))
              const isDimmed = neighborSet && !isHighlighted
              const maxCo = Math.max(...pairs.map((p) => p.coOccur), 1)
              const width = 0.5 + (l.coOccur / maxCo) * 3
              const opacity = isDimmed ? 0.05 : isHighlighted ? 0.9 : 0.35
              return (
                <line
                  key={`${s.id}-${t.id}-${i}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={isHighlighted ? '#10b981' : 'currentColor'}
                  strokeWidth={width}
                  strokeOpacity={opacity}
                  className="text-foreground"
                />
              )
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodesRef.current.map((n) => {
              if (n.x == null || n.y == null) return null
              const isHovered = n.id === hoveredNode
              const isSelected = n.id === selectedNode
              const isHighlighted = neighborSet?.has(n.id) ?? false
              const isDimmed = neighborSet && !isHighlighted
              const r = nodeRadius(n)
              const color = CATEGORY_COLORS[n.category] || '#888'
              const opacity = isDimmed ? 0.2 : 1
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: 'pointer', opacity }}
                  onPointerDown={(e) => onNodePointerDown(e, n)}
                  onPointerEnter={() => setHoveredNode(n.id)}
                  onPointerLeave={() => setHoveredNode(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedNode(isSelected ? null : n.id)
                  }}
                >
                  {/* Glow when hovered/selected */}
                  {(isHovered || isSelected) && (
                    <circle
                      r={r + 6}
                      fill={color}
                      opacity={0.2}
                    />
                  )}
                  {/* Outer ring for selected */}
                  {isSelected && (
                    <circle
                      r={r + 3}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                    />
                  )}
                  <circle
                    r={r}
                    fill={color}
                    stroke={isHovered || isSelected ? '#fff' : 'rgba(0,0,0,0.4)'}
                    strokeWidth={isHovered || isSelected ? 1.5 : 0.5}
                  />
                  {/* Label — only for nodes with ≥2 partners or hovered/selected */}
                  {(n.partners >= 2 || isHovered || isSelected) && (
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      className="font-mono pointer-events-none select-none"
                      fontSize={10}
                      fill="currentColor"
                      fillOpacity={isDimmed ? 0.3 : 0.85}
                    >
                      {n.name.length > 18 ? n.name.slice(0, 16) + '…' : n.name}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* Selected node detail panel */}
      <AnimatePresence>
        {selectedNodeData && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 right-16 bottom-3 w-72 rounded-lg border border-border bg-card shadow-lg overflow-hidden flex flex-col"
          >
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[selectedNodeData.category] || '#888' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                  {CATEGORY_LABELS[selectedNodeData.category]} · {selectedNodeData.partners} partnerstw
                </div>
                <div className="text-sm font-mono font-semibold truncate">
                  {selectedNodeData.name}
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-border grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div>
                <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Wystąp.</div>
                <div className="text-foreground font-semibold">{selectedNodeData.appearances}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Fuzje</div>
                <div className="text-foreground font-semibold">{selectedNodeData.partners}</div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-wider text-[8px]">AHI</div>
                <div
                  className="font-semibold"
                  style={{
                    color:
                      selectedNodeData.avgAhi >= 70
                        ? '#10b981'
                        : selectedNodeData.avgAhi >= 50
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                >
                  {selectedNodeData.avgAhi.toFixed(0)}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1 flex items-center gap-1">
                <Star className="w-2.5 h-2.5" />
                Fuzje z tym genem ({selectedNodePairs.length})
              </div>
              {selectedNodePairs.map((p) => {
                const partner = p.geneA === selectedNodeData.id ? p.geneB : p.geneA
                const partnerMeta = geneMeta[partner]
                const partnerColor = partnerMeta
                  ? CATEGORY_COLORS[partnerMeta.category] || '#888'
                  : '#888'
                return (
                  <button
                    key={partner}
                    onClick={() => setSelectedNode(partner)}
                    className="w-full text-left px-2 py-1.5 rounded border border-border bg-card/50 hover:bg-card hover:border-foreground/20 transition-colors flex items-center gap-2"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: partnerColor }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="text-[11px] font-mono font-medium block truncate">
                        {partner}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        ×{p.coOccur} sesji
                        {partnerMeta && ` · ${partnerMeta.appearances} wystąpień`}
                      </span>
                    </span>
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor:
                          p.avgAhi >= 70
                            ? 'rgba(16,185,129,0.15)'
                            : p.avgAhi >= 50
                            ? 'rgba(245,158,11,0.15)'
                            : 'rgba(239,68,68,0.15)',
                        color:
                          p.avgAhi >= 70
                            ? '#10b981'
                            : p.avgAhi >= 50
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    >
                      {p.avgAhi.toFixed(0)}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Sample sessions footer */}
            {selectedNodePairs[0]?.sessions && (
              <div className="border-t border-border p-3 space-y-1 max-h-32 overflow-y-auto">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
                  Przykładowe sesje
                </div>
                {selectedNodePairs[0].sessions.slice(0, 2).map((s) => (
                  <a
                    key={s.id}
                    href={`/lab?session=${s.id}`}
                    className="block text-[10px] font-mono text-muted-foreground hover:text-[var(--ahi)] truncate group"
                  >
                    <ExternalLink className="w-2 h-2 inline mr-1 opacity-40 group-hover:opacity-80" />
                    {s.prompt.slice(0, 60)}
                  </a>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hovered node tooltip (when not selected) */}
      {hoveredNode && !selectedNode && (
        <div className="absolute bottom-3 left-3 px-3 py-2 rounded-md border border-border bg-card/90 backdrop-blur-sm pointer-events-none">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
            {(() => {
              const n = nodesRef.current.find((x) => x.id === hoveredNode)
              return n ? CATEGORY_LABELS[n.category] : ''
            })()}
          </div>
          <div className="text-xs font-mono font-semibold">{hoveredNode}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
            kliknij, aby zobaczyć fuzje →
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function nodeRadius(n: SimNode): number {
  // 5 base + scale by partner count (cap at 20)
  return 5 + Math.min(15, n.partners * 2)
}
