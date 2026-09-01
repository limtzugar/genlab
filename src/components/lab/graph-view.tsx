'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, GitBranch, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

type GraphNode = {
  id: string
  label: string
  category: string
  ahiScore: number
  x: number
  y: number
  vx: number
  vy: number
}

type GraphEdge = {
  source: string
  target: string
}

const CATEGORY_COLORS: Record<string, string> = {
  input: '#16a34a',
  processing: '#ea580c',
  output: '#d97706',
  infrastructure: '#8b5cf6',
  fusion: '#0ea5e9',
}

// Virtual world size — much larger than viewport so user can pan/scroll
const WORLD_W = 1600
const WORLD_H = 1200

export function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<GraphNode | null>(null)
  const animationRef = useRef<number>(0)
  const nodesRef = useRef<GraphNode[]>([])

  // View transform: scale + offset (pan)
  const viewRef = useRef({ scale: 1, offX: 0, offY: 0 })
  const [, setViewVersion] = useState(0) // force re-render of HUD
  const bumpView = () => setViewVersion((v) => v + 1)

  // Drag state
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; offX: number; offY: number; moved: boolean }>({
    active: false,
    startX: 0,
    startY: 0,
    offX: 0,
    offY: 0,
    moved: false,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/sessions')
    const { sessions = [] } = await res.json()
    const completed = sessions.filter((s: { _count: { inventions: number } }) => s._count.inventions > 0).slice(0, 8)

    const allNodes: GraphNode[] = []
    const allEdges: GraphEdge[] = []

    for (const s of completed) {
      const detail = await fetch(`/api/sessions/${s.id}`).then((r) => r.json())
      const sess = detail.session
      if (!sess?.genes?.length) continue

      const sessionId = `session-${sess.id}`
      allNodes.push({
        id: sessionId,
        label: sess.inventions?.[0]?.name || 'Sesja',
        category: 'fusion',
        ahiScore: sess.inventions?.[0]?.ahiscore || 50,
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        vx: 0,
        vy: 0,
      })

      for (const g of sess.genes) {
        if (!allNodes.find((n) => n.id === g.id)) {
          allNodes.push({
            id: g.id,
            label: g.techName,
            category: g.category,
            ahiScore: g.ahiScore,
            x: Math.random() * WORLD_W,
            y: Math.random() * WORLD_H,
            vx: 0,
            vy: 0,
          })
        }
        allEdges.push({ source: sessionId, target: g.id })
      }
    }

    setNodes(allNodes)
    setEdges(allEdges)
    nodesRef.current = allNodes
    setLoading(false)

    // Fit view to all nodes after initial load
    setTimeout(() => fitView(allNodes), 100)
  }, [])

  // Fit view to bounds of given nodes
  const fitView = useCallback((arr: GraphNode[]) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || arr.length === 0) return
    const rect = container.getBoundingClientRect()

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of arr) {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x)
      maxY = Math.max(maxY, n.y)
    }
    const padding = 80
    const w = Math.max(maxX - minX, 1)
    const h = Math.max(maxY - minY, 1)
    const scale = Math.min(
      (rect.width - padding * 2) / w,
      (rect.height - padding * 2) / h,
      1.5
    )
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    viewRef.current = {
      scale,
      offX: rect.width / 2 - cx * scale,
      offY: rect.height / 2 - cy * scale,
    }
    bumpView()
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Force simulation
  useEffect(() => {
    if (nodes.length === 0) return

    let mounted = true
    const simulate = () => {
      if (!mounted) return
      const arr = nodesRef.current

      // Repulsion
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const dx = arr[j].x - arr[i].x
          const dy = arr[j].y - arr[i].y
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 3000 / (d * d)
          arr[i].vx -= (dx / d) * force
          arr[i].vy -= (dy / d) * force
          arr[j].vx += (dx / d) * force
          arr[j].vy += (dy / d) * force
        }
      }

      // Attraction along edges
      for (const e of edges) {
        const s = arr.find((n) => n.id === e.source)
        const t = arr.find((n) => n.id === e.target)
        if (!s || !t) continue
        const dx = t.x - s.x
        const dy = t.y - s.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (d - 160) * 0.02
        s.vx += (dx / d) * force
        s.vy += (dy / d) * force
        t.vx -= (dx / d) * force
        t.vy -= (dy / d) * force
      }

      // Center gravity + damping
      for (const n of arr) {
        n.vx += (WORLD_W / 2 - n.x) * 0.001
        n.vy += (WORLD_H / 2 - n.y) * 0.001
        n.vx *= 0.85
        n.vy *= 0.85
        n.x += n.vx
        n.y += n.vy
        n.x = Math.max(40, Math.min(WORLD_W - 40, n.x))
        n.y = Math.max(40, Math.min(WORLD_H - 40, n.y))
      }

      setNodes([...arr])
      animationRef.current = requestAnimationFrame(simulate)
    }

    animationRef.current = requestAnimationFrame(simulate)
    return () => {
      mounted = false
      cancelAnimationFrame(animationRef.current)
    }
  }, [edges, nodes.length])

  // Render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const { scale, offX, offY } = viewRef.current

    ctx.clearRect(0, 0, rect.width, rect.height)

    // Edges
    ctx.strokeStyle = 'rgba(125, 125, 125, 0.18)'
    ctx.lineWidth = Math.max(0.5, 1 / scale)
    for (const e of edges) {
      const s = nodes.find((n) => n.id === e.source)
      const t = nodes.find((n) => n.id === e.target)
      if (!s || !t) continue
      ctx.beginPath()
      ctx.moveTo(s.x * scale + offX, s.y * scale + offY)
      ctx.lineTo(t.x * scale + offX, t.y * scale + offY)
      ctx.stroke()
    }

    // Nodes
    for (const n of nodes) {
      const x = n.x * scale + offX
      const y = n.y * scale + offY
      const isFusion = n.category === 'fusion'
      const r = (isFusion ? 14 : 7 + (n.ahiScore / 100) * 7) * Math.min(scale, 1.2)
      const color = CATEGORY_COLORS[n.category] || '#71717a'

      // Skip nodes outside viewport for perf
      if (x < -50 || x > rect.width + 50 || y < -50 || y > rect.height + 50) continue

      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.globalAlpha = hovered && hovered.id !== n.id ? 0.25 : 1
      ctx.fill()
      ctx.globalAlpha = 1

      if (hovered?.id === n.id) {
        ctx.beginPath()
        ctx.arc(x, y, r + 4, 0, 2 * Math.PI)
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Labels: fusion nodes always; others only when zoomed in or hovered
      if (isFusion || hovered?.id === n.id || scale > 0.85) {
        ctx.font = `${isFusion ? '600' : '400'} ${Math.max(10, 11 * Math.min(scale, 1.2))}px ui-sans-serif, system-ui`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = isFusion ? '#0a0a0a' : '#525252'
        ctx.fillText(n.label.slice(0, 24), x, y + r + 14)
      }
    }
  }, [nodes, edges, hovered, viewRef.current.scale, viewRef.current.offX, viewRef.current.offY])

  // Convert screen → world coords
  const screenToWorld = (sx: number, sy: number) => {
    const { scale, offX, offY } = viewRef.current
    return { x: (sx - offX) / scale, y: (sy - offY) / scale }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const v = viewRef.current
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const newScale = Math.max(0.2, Math.min(3, v.scale * zoomFactor))

    // Zoom toward cursor
    const worldX = (mx - v.offX) / v.scale
    const worldY = (my - v.offY) / v.scale
    v.offX = mx - worldX * newScale
    v.offY = my - worldY * newScale
    v.scale = newScale
    bumpView()
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    dragRef.current = {
      active: true,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      offX: viewRef.current.offX,
      offY: viewRef.current.offY,
      moved: false,
    }
    canvas.style.cursor = 'grabbing'
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (dragRef.current.active) {
      const dx = x - dragRef.current.startX
      const dy = y - dragRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true
      viewRef.current.offX = dragRef.current.offX + dx
      viewRef.current.offY = dragRef.current.offY + dy
      bumpView()
      return
    }

    // Hover detection
    const world = screenToWorld(x, y)
    const found = nodes.find((n) => Math.hypot(n.x - world.x, n.y - world.y) < 16)
    setHovered(found || null)
    canvas.style.cursor = found ? 'pointer' : 'grab'
  }

  const handleMouseUp = () => {
    dragRef.current.active = false
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }

  const handleMouseLeave = () => {
    dragRef.current.active = false
    setHovered(null)
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
  }

  // Zoom controls
  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = rect.width / 2
    const my = rect.height / 2
    const v = viewRef.current
    const newScale = Math.max(0.2, Math.min(3, v.scale * factor))
    const worldX = (mx - v.offX) / v.scale
    const worldY = (my - v.offY) / v.scale
    v.offX = mx - worldX * newScale
    v.offY = my - worldY * newScale
    v.scale = newScale
    bumpView()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-4 flex items-center justify-between bg-card/30">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[var(--ahi)]" />
            Graf genów technologicznych
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Scroll = zoom · przeciągnij = pan · węzły pomarańczowe = wynalazki · wielkość = AHI
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Odśwież
        </button>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <GitBranch className="w-10 h-10 opacity-40 mb-2" />
            <p className="text-sm">Brak danych. Uruchom pipeline, aby zobaczyć graf.</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="w-full h-full block"
            style={{ cursor: 'grab' }}
            aria-label="Graf genów — scroll przybliża, przeciągnij aby przesunąć"
          />
        )}

        {hovered && (
          <div className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto p-3 rounded-lg border border-border bg-card glass pointer-events-none">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: CATEGORY_COLORS[hovered.category] }}
              />
              <span className="text-xs font-mono font-medium">{hovered.label}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Kategoria: {hovered.category} · AHI: {hovered.ahiScore}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute top-4 right-4 p-3 rounded-md border border-border bg-card/80 glass space-y-1.5 pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
            Legenda
          </div>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[11px] text-muted-foreground">{cat}</span>
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        {!loading && nodes.length > 0 && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 p-1 rounded-md border border-border bg-card/80 glass">
            <button
              onClick={() => zoomBy(1.25)}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              aria-label="Przybliż"
              title="Przybliż"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => zoomBy(1 / 1.25)}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              aria-label="Oddal"
              title="Oddal"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fitView(nodesRef.current)}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              aria-label="Dopasuj do okna"
              title="Dopasuj do okna"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="text-[9px] font-mono text-muted-foreground text-center pt-0.5 border-t border-border">
              {Math.round(viewRef.current.scale * 100)}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
