'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  ArrowLeft,
  Beaker,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Star,
  Github,
  Loader2,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ------------------------------------------------------------------ *
 * GeneGraph3D — three.js 3D visualization of the gene fusion network
 * ------------------------------------------------------------------ *
 * Inspirations (z GitHub, ocenione w scripts/search-threejs-repos.ts):
 *   1. jonobr1/force-directed-graph — GPU force-directed (main pattern)
 *   2. salonyranjan/neural-portfolio — React + Next.js + Three.js stack match
 *   3. ArjunSNair00/NodeScape — AI knowledge graph explorer pattern
 *   4. cdeust/neural-graph-visualizer — bloom + flow particles visual style
 *   5. rodspeed/heartwood — local-first knowledge graph philosophy
 *   6. ahilbig/three-graph-modeller — graph database cataloguing pattern
 *
 * Dane: /api/explore/fusions (już istnieje, zwraca pary genów + geneMeta).
 * Implementacja: pure three.js (już w package.json), bez R3F — minimalne
 * zależności, pełna kontrola nad WebGL.
 * ------------------------------------------------------------------ */

type Category = 'input' | 'processing' | 'output' | 'infrastructure' | 'fusion' | 'unknown'

const CATEGORY_COLORS: Record<Category, number> = {
  input: 0x3b82f6,          // blue
  processing: 0x8b5cf6,     // violet
  output: 0x10b981,         // green
  infrastructure: 0xf59e0b, // amber
  fusion: 0xec4899,         // pink
  unknown: 0x6b7280,        // gray
}

const CATEGORY_LABELS: Record<Category, string> = {
  input: 'Input',
  processing: 'Processing',
  output: 'Output',
  infrastructure: 'Infrastructure',
  fusion: 'Fusion',
  unknown: 'Unknown',
}

type FusionPair = {
  geneA: string
  geneB: string
  coOccur: number
  avgAhi: number
  sessions: Array<{ prompt: string; createdAt: string; sessionId: string }>
}

type GeneMeta = {
  category: Category
  partners: number
  appearances: number
  avgAhi: number
}

type ApiResponse = {
  pairs: FusionPair[]
  geneMeta: Record<string, GeneMeta>
  hubGenes: Array<{ name: string; partners: number; avgAhi: number }>
  totalPairs: number
  scannedSessions: number
  scannedGenes: number
}

/* ------------------------------------------------------------------ *
 * Particle system config (module-scope constants)
 * ------------------------------------------------------------------ *
 * Each edge carries PARTICLES_PER_EDGE particles total:
 *   - PARTICLES_PER_DIRECTION flowing A→B
 *   - PARTICLES_PER_DIRECTION flowing B→A (bidirectional)
 * The 3 particles in each direction are phase-offset by 1/3 so they
 * appear as a flowing trail rather than a single dot.
 * ------------------------------------------------------------------ */
const PARTICLES_PER_DIRECTION = 3
const PARTICLES_PER_EDGE = PARTICLES_PER_DIRECTION * 2 // 6
const PHASE_OFFSETS = [0, 1 / 3, 2 / 3]

/* ------------------------------------------------------------------ *
 * THREE.js scene — encapsulated in a class for clean lifecycle
 * ------------------------------------------------------------------ */
class GeneGraphScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  composer: EffectComposer
  bloomPass: UnrealBloomPass

  nodesGroup: THREE.Group
  edgesGroup: THREE.Group
  particlesGroup: THREE.Group
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2

  nodes: Map<string, THREE.Mesh> = new Map()
  nodeData: Map<string, { meta: GeneMeta; velocity: THREE.Vector3; force: THREE.Vector3; baseScale: number }> = new Map()
  edges: Array<{
    a: string
    b: string
    line: THREE.Line
    coOccur: number
  }> = []

  // Per-particle state. Each edge has PARTICLES_PER_EDGE particles
  // (PARTICLES_PER_DIRECTION in each direction). Stored as flat array
  // for cache-friendly iteration in the hot updateParticles loop.
  particleStates: Array<{
    edgeIndex: number
    direction: 1 | -1  // 1 = A→B, -1 = B→A
    t: number          // current position 0..1
    speed: number      // per-frame t-delta
  }> = []

  // Single THREE.Points object holding ALL particles (PARTICLES_PER_EDGE per edge).
  // Updated per-frame by writing into the position attribute.
  particles: THREE.Points | null = null
  particleGeometry: THREE.BufferGeometry | null = null
  particleMaterial: THREE.ShaderMaterial | null = null
  // Per-particle alpha (for highlight state) — separate Float32Array
  // written into the 'aAlpha' attribute each frame.
  particleAlphas: Float32Array = new Float32Array(0)
  particleSizes: Float32Array = new Float32Array(0)

  // Pulse flash — when a particle arrives at a node (t wraps), the
  // destination node's flash intensity boosts. Decays each frame.
  // Applied in updateHighlight as emissive + scale boost.
  nodeFlashIntensity: Map<string, number> = new Map()

  // Cached max coOccur for normalization in highlight calculations
  maxCoOccur: number = 1

  // Toggle — particles visible by default
  particlesEnabled = true

  hovered: string | null = null
  selected: string | null = null

  container: HTMLElement
  animationId: number | null = null
  isRunning = true

  // Physics params
  repulsion = 80
  attraction = 0.02
  damping = 0.85
  centerForce = 0.001

  // Particle params
  particleBaseSpeed = 0.004  // baseline t-delta per frame
  particleBaseSize = 6.0     // base gl_PointSize in pixels (before size attenuation)

  // Pulse flash params
  flashDecay = 0.88          // per-frame multiplier (flash *= flashDecay)
  flashIncrement = 0.35      // added to node flash on each particle arrival
  flashMaxEmissive = 0.8     // max emissive boost from flash
  flashMaxScale = 0.25       // max scale boost (mesh.scale = baseScale * (1 + flash * this))

  constructor(container: HTMLElement) {
    this.container = container
    const w = container.clientWidth
    const h = container.clientHeight

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0a)
    this.scene.fog = new THREE.FogExp2(0x0a0a0a, 0.012)

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
    this.camera.position.set(0, 0, 80)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.rotateSpeed = 0.6
    this.controls.zoomSpeed = 0.8
    this.controls.minDistance = 15
    this.controls.maxDistance = 250

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.35)
    this.scene.add(ambient)

    const keyLight = new THREE.PointLight(0xea580c, 1.2, 200)
    keyLight.position.set(50, 30, 50)
    this.scene.add(keyLight)

    const fillLight = new THREE.PointLight(0x3b82f6, 0.6, 200)
    fillLight.position.set(-50, -20, -30)
    this.scene.add(fillLight)

    // Groups
    this.nodesGroup = new THREE.Group()
    this.edgesGroup = new THREE.Group()
    this.particlesGroup = new THREE.Group()
    this.scene.add(this.edgesGroup)
    this.scene.add(this.particlesGroup)
    this.scene.add(this.nodesGroup)

    // Picking
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    // Postprocessing — bloom dla akcentów (inspiracja: cdeust/neural-graph-visualizer)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.6,  // strength
      0.5,  // radius
      0.3   // threshold
    )
    this.composer.addPass(this.bloomPass)

    // Background grid (subtle reference plane)
    this.addBackgroundGrid()
  }

  private addBackgroundGrid() {
    const gridHelper = new THREE.GridHelper(400, 40, 0x1a1a1a, 0x111111)
    gridHelper.position.y = -40
    ;(gridHelper.material as THREE.Material).transparent = true
    ;(gridHelper.material as THREE.Material).opacity = 0.3
    this.scene.add(gridHelper)
  }

  /* ------------------------------------------------------------------ *
   * Build graph from API response
   * ------------------------------------------------------------------ */
  loadData(data: ApiResponse) {
    // Clear existing
    this.nodesGroup.clear()
    this.edgesGroup.clear()
    this.particlesGroup.clear()
    this.nodes.clear()
    this.nodeData.clear()
    this.edges = []
    this.particles = null
    this.particleGeometry = null
    this.particleMaterial = null

    // Build nodes from geneMeta
    const geneNames = Object.keys(data.geneMeta)
    const maxPartners = Math.max(1, ...geneNames.map((n) => data.geneMeta[n].partners))

    geneNames.forEach((name, idx) => {
      const meta = data.geneMeta[name]
      const radius = 0.8 + (meta.partners / maxPartners) * 2.2
      const color = CATEGORY_COLORS[meta.category] ?? CATEGORY_COLORS.unknown

      const geometry = new THREE.SphereGeometry(radius, 24, 24)
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.6,
      })
      const mesh = new THREE.Mesh(geometry, material)

      // Initialize on a sphere shell (random) — gives d3-force-like startup
      const phi = Math.acos(1 - 2 * (idx + 0.5) / geneNames.length)
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx
      const r = 25 + Math.random() * 8
      mesh.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )

      // User data for raycasting
      mesh.userData = { geneName: name, meta }

      this.nodesGroup.add(mesh)
      this.nodes.set(name, mesh)
      this.nodeData.set(name, {
        meta,
        velocity: new THREE.Vector3(),
        force: new THREE.Vector3(),
        baseScale: 1.0,
      })
      this.nodeFlashIntensity.set(name, 0)
    })

    // Build edges
    this.maxCoOccur = Math.max(1, ...data.pairs.map((p) => p.coOccur))

    data.pairs.forEach((pair, edgeIndex) => {
      const aMesh = this.nodes.get(pair.geneA)
      const bMesh = this.nodes.get(pair.geneB)
      if (!aMesh || !bMesh) return

      // Edge thickness encoded as opacity (THREE.Line doesn't support width >1 on most platforms)
      const intensity = pair.coOccur / this.maxCoOccur
      const opacity = 0.15 + intensity * 0.6

      const geometry = new THREE.BufferGeometry().setFromPoints([
        aMesh.position.clone(),
        bMesh.position.clone(),
      ])
      const material = new THREE.LineBasicMaterial({
        color: 0xea580c,
        transparent: true,
        opacity,
      })
      const line = new THREE.Line(geometry, material)
      this.edgesGroup.add(line)
      this.edges.push({
        a: pair.geneA,
        b: pair.geneB,
        line,
        coOccur: pair.coOccur,
      })
    })

    // Build the unified particles system (bidirectional + trail + flash)
    this.buildParticles()
  }

  /* ------------------------------------------------------------------ *
   * Particles — single THREE.Points object with PARTICLES_PER_EDGE
   * particles per edge (3 A→B + 3 B→A, phase-offset for trail effect).
   * Custom ShaderMaterial with additive blending + size attenuation so
   * particles glow brighter when zoomed in and fade naturally with bloom.
   * Inspiracja: cdeust/neural-graph-visualizer (flow particles on edges).
   * ------------------------------------------------------------------ */
  private buildParticles() {
    if (this.edges.length === 0) return

    const totalParticles = this.edges.length * PARTICLES_PER_EDGE
    const positions = new Float32Array(totalParticles * 3)
    const alphas = new Float32Array(totalParticles)
    const sizes = new Float32Array(totalParticles)

    // Build per-particle state. For each edge, create PARTICLES_PER_EDGE
    // particles: first half flow A→B, second half flow B→A. Within each
    // direction, particles are phase-offset by PHASE_OFFSETS to form a trail.
    this.particleStates = []
    for (let edgeIdx = 0; edgeIdx < this.edges.length; edgeIdx++) {
      const edge = this.edges[edgeIdx]
      const intensity = edge.coOccur / this.maxCoOccur
      const speed = this.particleBaseSpeed * (0.5 + intensity * 1.5)
      const aMesh = this.nodes.get(edge.a)!

      for (let dirIdx = 0; dirIdx < PARTICLES_PER_DIRECTION; dirIdx++) {
        const phase = PHASE_OFFSETS[dirIdx]
        // A→B particle
        const abIdx = edgeIdx * PARTICLES_PER_EDGE + dirIdx
        this.particleStates.push({
          edgeIndex: edgeIdx,
          direction: 1,
          t: phase,  // start at phase offset
          speed,
        })
        positions[abIdx * 3 + 0] = aMesh.position.x
        positions[abIdx * 3 + 1] = aMesh.position.y
        positions[abIdx * 3 + 2] = aMesh.position.z
        alphas[abIdx] = 0.5
        sizes[abIdx] = this.particleBaseSize

        // B→A particle
        const baIdx = edgeIdx * PARTICLES_PER_EDGE + PARTICLES_PER_DIRECTION + dirIdx
        this.particleStates.push({
          edgeIndex: edgeIdx,
          direction: -1,
          t: phase,
          speed,
        })
        positions[baIdx * 3 + 0] = aMesh.position.x
        positions[baIdx * 3 + 1] = aMesh.position.y
        positions[baIdx * 3 + 2] = aMesh.position.z
        alphas[baIdx] = 0.5
        sizes[baIdx] = this.particleBaseSize
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    // Custom shader — circular soft particle, additive blending, size attenuation.
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xfbbf24) },     // amber (default)
        uHighlightColor: { value: new THREE.Color(0xffe066) }, // brighter amber (highlighted)
        uPixelRatio: { value: this.renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        uniform float uPixelRatio;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // Size attenuation: closer particles are bigger.
          // 300.0 is a tuning constant for the falloff curve.
          float pointSize = aSize * uPixelRatio * (300.0 / -mvPosition.z);
          gl_PointSize = clamp(pointSize, 1.0, 32.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uHighlightColor;
        varying float vAlpha;
        void main() {
          // Distance from center of the point sprite (0..1)
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          if (dist > 0.5) discard;  // circular cutout
          // Soft radial falloff — bright core, gentle edge
          float falloff = 1.0 - smoothstep(0.0, 0.5, dist);
          falloff = pow(falloff, 2.0);
          // Mix between base and highlight color by alpha (highlighted particles
          // use higher alpha, which we also use as a proxy for color shift)
          vec3 color = mix(uColor, uHighlightColor, smoothstep(0.85, 1.0, vAlpha));
          gl_FragColor = vec4(color, falloff * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false  // positions update every frame
    this.particlesGroup.add(points)

    this.particles = points
    this.particleGeometry = geometry
    this.particleMaterial = material
    this.particleAlphas = alphas
    this.particleSizes = sizes
  }

  /* ------------------------------------------------------------------ *
   * Update particle positions each frame.
   *
   * For each particle:
   *   1. Advance t by particle.speed
   *   2. If t wrapped past 1 → particle arrived at destination node →
   *      boost that node's flash intensity (pulse flash effect)
   *   3. Compute eased position along edge (direction-aware: A→B or B→A)
   *   4. Compute alpha with sin(PI*t) fade for trail effect — particles
   *      peak in brightness mid-edge, fade at endpoints
   *   5. Apply highlight state (focused edge → bright/big, others → dim)
   * ------------------------------------------------------------------ */
  private updateParticles() {
    if (!this.particlesEnabled || !this.particleGeometry || !this.particles) return

    const positions = this.particleGeometry.attributes.position as THREE.BufferAttribute
    const alphas = this.particleGeometry.attributes.aAlpha as THREE.BufferAttribute
    const sizes = this.particleGeometry.attributes.aSize as THREE.BufferAttribute

    const focused = this.hovered ?? this.selected

    for (let i = 0; i < this.particleStates.length; i++) {
      const p = this.particleStates[i]
      const edge = this.edges[p.edgeIndex]
      const aMesh = this.nodes.get(edge.a)!
      const bMesh = this.nodes.get(edge.b)!

      // Advance t
      p.t += p.speed
      let arrived = false
      if (p.t >= 1) {
        p.t -= 1
        arrived = true  // wrapped → arrived at destination
      }

      // Pulse flash: when particle arrives, boost destination node's flash.
      // Direction 1 (A→B) arrives at B; direction -1 (B→A) arrives at A.
      if (arrived) {
        const destName = p.direction === 1 ? edge.b : edge.a
        const current = this.nodeFlashIntensity.get(destName) ?? 0
        // Scale increment by edge coOccur — stronger fusions = bigger flash
        const inc = this.flashIncrement * (0.5 + (edge.coOccur / this.maxCoOccur) * 0.8)
        this.nodeFlashIntensity.set(destName, Math.min(1.5, current + inc))
      }

      // Compute eased position along edge (direction-aware)
      // For direction -1, we reverse t so the particle flows B→A
      const flowT = p.direction === 1 ? p.t : 1 - p.t
      // easeInOutSine — smoother than linear, slows at endpoints
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * flowT)

      const x = aMesh.position.x + (bMesh.position.x - aMesh.position.x) * eased
      const y = aMesh.position.y + (bMesh.position.y - aMesh.position.y) * eased
      const z = aMesh.position.z + (bMesh.position.z - aMesh.position.z) * eased
      positions.setXYZ(i, x, y, z)

      // Trail fade: sin(PI*t) peaks at t=0.5, fades at endpoints.
      // Combined with phase-offset particles, creates a flowing trail.
      const fade = 0.4 + 0.6 * Math.sin(Math.PI * p.t)  // min 0.4, peak 1.0

      // Alpha + size based on highlight state
      let alpha: number
      let size: number
      if (!focused) {
        alpha = (0.45 + (edge.coOccur / 10) * 0.05) * fade
        size = this.particleBaseSize
      } else if (edge.a === focused || edge.b === focused) {
        alpha = 1.0 * fade
        size = this.particleBaseSize * 2.2
      } else {
        alpha = 0.08 * fade
        size = this.particleBaseSize * 0.5
      }
      this.particleAlphas[i] = alpha
      this.particleSizes[i] = size
      alphas.setX(i, alpha)
      sizes.setX(i, size)
    }

    positions.needsUpdate = true
    alphas.needsUpdate = true
    sizes.needsUpdate = true
  }

  setParticlesEnabled(enabled: boolean) {
    this.particlesEnabled = enabled
    if (this.particles) {
      this.particles.visible = enabled
    }
  }

  /* ------------------------------------------------------------------ *
   * Force simulation — runs every frame, lighter than d3-force
   * ------------------------------------------------------------------ */
  private applyForces() {
    const nodeNames = Array.from(this.nodes.keys())
    if (nodeNames.length === 0) return

    // Reset forces
    for (const name of nodeNames) {
      this.nodeData.get(name)!.force.set(0, 0, 0)
    }

    // Repulsion (all pairs) — O(n²), fine for n<200
    for (let i = 0; i < nodeNames.length; i++) {
      const aName = nodeNames[i]
      const aMesh = this.nodes.get(aName)!
      for (let j = i + 1; j < nodeNames.length; j++) {
        const bName = nodeNames[j]
        const bMesh = this.nodes.get(bName)!
        const diff = new THREE.Vector3().subVectors(aMesh.position, bMesh.position)
        const distSq = Math.max(diff.lengthSq(), 0.5)
        const force = this.repulsion / distSq
        diff.normalize().multiplyScalar(force)
        this.nodeData.get(aName)!.force.add(diff)
        this.nodeData.get(bName)!.force.sub(diff)
      }
    }

    // Attraction (only edges) + edge length target based on coOccur
    for (const edge of this.edges) {
      const aMesh = this.nodes.get(edge.a)!
      const bMesh = this.nodes.get(edge.b)!
      const aData = this.nodeData.get(edge.a)!
      const bData = this.nodeData.get(edge.b)!
      const diff = new THREE.Vector3().subVectors(bMesh.position, aMesh.position)
      const dist = diff.length()
      // Stronger pairs want to be closer
      const targetDist = 25 - Math.min(15, edge.coOccur * 1.5)
      const displacement = dist - targetDist
      diff.normalize().multiplyScalar(this.attraction * displacement)
      aData.force.add(diff)
      bData.force.sub(diff)
    }

    // Gentle pull to center (prevents drift)
    for (const name of nodeNames) {
      const mesh = this.nodes.get(name)!
      const toCenter = mesh.position.clone().multiplyScalar(-this.centerForce)
      this.nodeData.get(name)!.force.add(toCenter)
    }

    // Integrate
    for (const name of nodeNames) {
      const data = this.nodeData.get(name)!
      const mesh = this.nodes.get(name)!
      data.velocity.add(data.force).multiplyScalar(this.damping)
      // Pin selected/hovered node
      if (this.selected === name || this.hovered === name) {
        data.velocity.set(0, 0, 0)
      }
      mesh.position.add(data.velocity)
    }

    // Update edge geometry
    for (const edge of this.edges) {
      const aMesh = this.nodes.get(edge.a)!
      const bMesh = this.nodes.get(edge.b)!
      const positions = (edge.line.geometry as THREE.BufferGeometry).attributes.position
      positions.setXYZ(0, aMesh.position.x, aMesh.position.y, aMesh.position.z)
      positions.setXYZ(1, bMesh.position.x, bMesh.position.y, bMesh.position.z)
      positions.needsUpdate = true
    }
  }

  /* ------------------------------------------------------------------ *
   * Highlight state on hover/select + apply pulse flash to nodes.
   *
   * For each node:
   *   - Compute base emissive from highlight state (0.35 / 0.9 / 0.1)
   *   - Add flash intensity * flashMaxEmissive on top
   *   - Scale mesh by (1 + flash * flashMaxScale) for visual pulse
   *   - Decay flash intensity (flash *= flashDecay) AFTER applying
   *
   * Note: this runs after updateParticles in the frame loop, so flash
   * from this frame's arrivals is included.
   * ------------------------------------------------------------------ */
  private updateHighlight() {
    const focused = this.hovered ?? this.selected
    const neighborSet = new Set<string>()
    if (focused) {
      neighborSet.add(focused)
      for (const edge of this.edges) {
        if (edge.a === focused) neighborSet.add(edge.b)
        if (edge.b === focused) neighborSet.add(edge.a)
      }
    }

    for (const [name, mesh] of this.nodes) {
      const mat = mesh.material as THREE.MeshStandardMaterial
      const data = this.nodeData.get(name)!
      const flash = this.nodeFlashIntensity.get(name) ?? 0

      let baseEmissive: number
      if (!focused) {
        baseEmissive = 0.35
        mat.opacity = 1
        ;(mat as THREE.Material).transparent = false
      } else if (neighborSet.has(name)) {
        baseEmissive = 0.9
        ;(mat as THREE.Material).transparent = false
        mat.opacity = 1
      } else {
        baseEmissive = 0.1
        ;(mat as THREE.Material).transparent = true
        mat.opacity = 0.25
      }

      // Apply flash boost to emissive + scale
      mat.emissiveIntensity = baseEmissive + flash * this.flashMaxEmissive
      const scale = data.baseScale * (1 + flash * this.flashMaxScale)
      mesh.scale.setScalar(scale)

      // Decay flash AFTER applying (so this frame's boost is visible)
      this.nodeFlashIntensity.set(name, flash * this.flashDecay)
    }

    for (const edge of this.edges) {
      const mat = edge.line.material as THREE.LineBasicMaterial
      if (!focused) {
        mat.opacity = 0.15 + (edge.coOccur / this.maxCoOccur) * 0.6
        continue
      }
      if (edge.a === focused || edge.b === focused) {
        mat.opacity = 0.95
        mat.color.setHex(0xfbbf24)
      } else {
        mat.opacity = 0.05
        mat.color.setHex(0xea580c)
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Animation loop
   * ------------------------------------------------------------------ */
  start() {
    const animate = () => {
      if (!this.isRunning) return
      this.animationId = requestAnimationFrame(animate)

      this.applyForces()
      this.updateParticles()
      this.updateHighlight()
      this.controls.update()
      this.composer.render()
    }
    animate()
  }

  stop() {
    this.isRunning = false
    if (this.animationId != null) cancelAnimationFrame(this.animationId)
  }

  /* ------------------------------------------------------------------ *
   * Pointer interaction
   * ------------------------------------------------------------------ */
  setPointer(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((x - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((y - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = Array.from(this.nodes.values())
    const intersects = this.raycaster.intersectObjects(meshes, false)

    if (intersects.length > 0) {
      const name = intersects[0].object.userData.geneName as string
      if (this.hovered !== name) {
        this.hovered = name
        return { type: 'hover' as const, name, meta: intersects[0].object.userData.meta as GeneMeta }
      }
    } else if (this.hovered !== null) {
      this.hovered = null
      return { type: 'hover' as const, name: null, meta: null }
    }
    return null
  }

  click(): { name: string; meta: GeneMeta } | null {
    if (this.hovered) {
      this.selected = this.selected === this.hovered ? null : this.hovered
      if (this.selected) {
        const mesh = this.nodes.get(this.selected)!
        return { name: this.selected, meta: mesh.userData.meta as GeneMeta }
      }
    } else {
      this.selected = null
    }
    return null
  }

  resetCamera() {
    this.camera.position.set(0, 0, 80)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloomPass.resolution.set(w, h)
  }

  dispose() {
    this.stop()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
      if (obj instanceof THREE.Line) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
      if (obj instanceof THREE.Points) {
        obj.geometry.dispose()
        ;(obj.material as THREE.Material).dispose()
      }
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

/* ------------------------------------------------------------------ *
 * React component
 * ------------------------------------------------------------------ */
export function GeneGraph3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GeneGraphScene | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [hovered, setHovered] = useState<{ name: string; meta: GeneMeta } | null>(null)
  const [selected, setSelected] = useState<{ name: string; meta: GeneMeta } | null>(null)
  const [stats, setStats] = useState<{ nodes: number; edges: number; fps: number }>({
    nodes: 0,
    edges: 0,
    fps: 0,
  })
  const [particlesOn, setParticlesOn] = useState(true)

  // Fetch data
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/explore/fusions?minCoOccur=1&limit=100', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ApiResponse
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize three.js scene when data is ready
  useEffect(() => {
    if (!data || !containerRef.current) return
    const container = containerRef.current

    const scene = new GeneGraphScene(container)
    sceneRef.current = scene
    scene.loadData(data)
    scene.start()

    setStats({ nodes: scene.nodes.size, edges: scene.edges.length, fps: 0 })

    // FPS counter
    let frames = 0
    let lastTime = performance.now()
    const fpsInterval = setInterval(() => {
      const now = performance.now()
      const elapsed = now - lastTime
      const fps = Math.round((frames * 1000) / elapsed)
      setStats((s) => ({ ...s, fps }))
      frames = 0
      lastTime = now
    }, 1000)

    const onFrame = () => {
      frames++
    }
    const frameTimer = setInterval(onFrame, 16)

    // Pointer events
    const onPointerMove = (ev: PointerEvent) => {
      const result = scene.setPointer(ev.clientX, ev.clientY)
      if (result?.type === 'hover') {
        if (result.name) {
          setHovered({ name: result.name, meta: result.meta! })
        } else {
          setHovered(null)
        }
      }
    }
    const onClick = (ev: MouseEvent) => {
      // Only handle if click was on canvas (not on UI overlay)
      const target = ev.target as HTMLElement
      if (!target.closest('canvas')) return
      const result = scene.click()
      setSelected(result ? { name: result.name, meta: result.meta } : null)
    }
    const onResize = () => scene.resize()

    container.addEventListener('pointermove', onPointerMove)
    window.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)

    return () => {
      clearInterval(fpsInterval)
      clearInterval(frameTimer)
      container.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      scene.dispose()
      sceneRef.current = null
    }
  }, [data])

  const handleReset = useCallback(() => {
    sceneRef.current?.resetCamera()
  }, [])

  const handleToggleParticles = useCallback(() => {
    setParticlesOn((prev) => {
      const next = !prev
      sceneRef.current?.setParticlesEnabled(next)
      return next
    })
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/60 glass">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/sandbox"
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Wróć do sandbox"
              title="Wróć do /sandbox"
            >
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div className="relative w-7 h-7 rounded-md bg-[var(--ahi)] flex items-center justify-center">
              <Beaker className="w-4 h-4 text-background" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">Graf genów 3D</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-[var(--ahi)]/40 bg-[var(--ahi)]/10 text-[var(--ahi)]">
                  three.js
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                WebGL · bloom postprocessing · force-directed 3D · flow particles
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data && (
              <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span>{stats.nodes} węzłów</span>
                <span>{stats.edges} krawędzi</span>
                <span>{stats.fps} FPS</span>
              </div>
            )}
            <button
              onClick={handleToggleParticles}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                particlesOn
                  ? 'border-[var(--ahi)]/60 bg-[var(--ahi)]/10 text-[var(--ahi)]'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              title={particlesOn ? 'Wyłącz cząstki flow' : 'Włącz cząstki flow'}
              aria-pressed={particlesOn}
            >
              <Zap className="w-3 h-3" />
              Cząstki
              <span className="text-[9px] font-mono opacity-70">
                {particlesOn ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors"
              title="Reset kamery"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="relative" style={{ height: 'calc(100vh - 3.5rem)' }}>
        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[var(--ahi)] animate-spin" />
              <p className="text-sm text-muted-foreground font-mono">
                ładowanie grafu genów…
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20 p-6">
            <div className="border border-red-500/40 bg-red-500/5 rounded-lg p-6 max-w-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-500 mb-1">Błąd ładowania</h3>
                  <p className="text-sm text-muted-foreground font-mono">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Three.js canvas container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Hover tooltip */}
        <AnimatePresence>
          {hovered && !selected && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-4 left-4 z-10 pointer-events-none border border-border rounded-lg bg-card/95 glass backdrop-blur p-3 min-w-[220px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: `#${CATEGORY_COLORS[hovered.meta.category].toString(16).padStart(6, '0')}` }}
                />
                <span className="text-sm font-mono font-semibold">{hovered.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Kategoria</div>
                  <div className="font-mono">{CATEGORY_LABELS[hovered.meta.category]}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Fuzje</div>
                  <div className="font-mono">{hovered.meta.partners}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Wystąpienia</div>
                  <div className="font-mono">{hovered.meta.appearances}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">avg AHI</div>
                  <div className="font-mono">{hovered.meta.avgAhi}</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 italic">kliknij, aby zablokować</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected detail panel */}
        <AnimatePresence>
          {selected && data && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 bottom-4 z-10 w-80 border border-border rounded-lg bg-card/95 glass backdrop-blur overflow-y-auto"
            >
              <SelectedDetail
                name={selected.name}
                meta={selected.meta}
                pairs={data.pairs.filter(
                  (p) => p.geneA === selected.name || p.geneB === selected.name
                )}
                onClose={() => {
                  setSelected(null)
                  sceneRef.current?.click() // toggle off
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 border border-border rounded-lg bg-card/90 glass backdrop-blur p-3">
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
            Kategoria
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {(Object.keys(CATEGORY_COLORS) as Category[]).map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: `#${CATEGORY_COLORS[cat].toString(16).padStart(6, '0')}`,
                  }}
                />
                <span className="text-xs font-mono">{CATEGORY_LABELS[cat]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inspirations footer (collapsed by default) */}
        <InspirationsBar />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Selected node detail panel
 * ------------------------------------------------------------------ */
function SelectedDetail({
  name,
  meta,
  pairs,
  onClose,
}: {
  name: string
  meta: GeneMeta
  pairs: FusionPair[]
  onClose: () => void
}) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: `#${CATEGORY_COLORS[meta.category].toString(16).padStart(6, '0')}` }}
            />
            <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              {CATEGORY_LABELS[meta.category]}
            </span>
          </div>
          <h3 className="text-base font-mono font-semibold break-all">{name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Zamknij panel"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="border border-border rounded p-2">
          <div className="text-[10px] uppercase text-muted-foreground font-mono">Fuzje</div>
          <div className="text-lg font-semibold">{meta.partners}</div>
        </div>
        <div className="border border-border rounded p-2">
          <div className="text-[10px] uppercase text-muted-foreground font-mono">Wystąp.</div>
          <div className="text-lg font-semibold">{meta.appearances}</div>
        </div>
        <div className="border border-border rounded p-2">
          <div className="text-[10px] uppercase text-muted-foreground font-mono">avg AHI</div>
          <div className="text-lg font-semibold">{meta.avgAhi}</div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
        Fuzje ({pairs.length})
      </div>
      <div className="space-y-2">
        {pairs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Brak fuzji w tej kohorcie.</p>
        ) : (
          pairs.map((p) => {
            const partner = p.geneA === name ? p.geneB : p.geneA
            return (
              <div
                key={`${p.geneA}-${p.geneB}`}
                className="border border-border rounded p-2 bg-background/40"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-medium">{partner}</span>
                  <span className="text-[10px] font-mono text-[var(--ahi)]">
                    ×{p.coOccur}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  avg AHI: {p.avgAhi} · {p.sessions.length} sesji
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Inspirations bar — referenced repos (bottom of screen)
 * ------------------------------------------------------------------ */
const INSPIRATIONS = [
  {
    name: 'jonobr1/force-directed-graph',
    url: 'https://github.com/jonobr1/force-directed-graph',
    stars: 95,
    license: 'MIT',
    why: 'GPU force-directed graph. Main pattern for our physics simulation.',
    role: 'główna inspiracja: symulacja siłowa',
  },
  {
    name: 'salonyranjan/neural-portfolio',
    url: 'https://github.com/salonyranjan/neural-portfolio',
    stars: 3,
    license: 'MIT',
    why: 'React + Next.js + Three.js + R3F. Stack match z GenLab.',
    role: 'wzorzec stacku',
  },
  {
    name: 'ArjunSNair00/NodeScape',
    url: 'https://github.com/ArjunSNair00/NodeScape',
    stars: 3,
    license: 'n/a',
    why: 'AI-powered knowledge graph explorer. Wzorzec interakcji AI + graf.',
    role: 'wzorzec eksploracji',
  },
  {
    name: 'cdeust/neural-graph-visualizer',
    url: 'https://github.com/cdeust/neural-graph-visualizer',
    stars: 1,
    license: 'MIT',
    why: 'Bloom + flow particles. Inspiracja dla postprocessing efektorów.',
    role: 'inspiracja wizualna',
  },
  {
    name: 'rodspeed/heartwood',
    url: 'https://github.com/rodspeed/heartwood',
    stars: 3,
    license: 'MIT',
    why: 'Local-first knowledge graph. Filozofia spójna z GenLab.',
    role: 'filozofia',
  },
  {
    name: 'ahilbig/three-graph-modeller',
    url: 'https://github.com/ahilbig/three-graph-modeller',
    stars: 2,
    license: 'Apache-2',
    why: 'Graph database modeller dla Neo4J/OrientDB. Wzorzec katalogowania bazy.',
    role: 'wzorzec katalogowania',
  },
]

function InspirationsBar() {
  const [open, setOpen] = useState(false)
  return (
    <div className="absolute bottom-4 right-4 z-10">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-card/90 glass backdrop-blur hover:bg-muted transition-colors"
      >
        <Sparkles className="w-3 h-3 text-[var(--ahi)]" />
        Inspiracje ({INSPIRATIONS.length})
        {open ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-10 right-0 w-96 max-h-[60vh] overflow-y-auto border border-border rounded-lg bg-card/95 glass backdrop-blur p-3"
          >
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
              Repozytoria three.js — inspiracje integracji
            </div>
            <div className="space-y-2">
              {INSPIRATIONS.map((repo) => (
                <div key={repo.name} className="border border-border rounded p-2.5 bg-background/40">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono font-medium hover:text-[var(--ahi)] transition-colors break-all"
                    >
                      {repo.name}
                    </a>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      aria-label="Otwórz na GitHub"
                    >
                      <Github className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-1.5">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" />
                      {repo.stars}
                    </span>
                    <span>{repo.license}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-1.5">
                    {repo.why}
                  </p>
                  <div className="text-[10px] font-mono text-[var(--ahi)]">{repo.role}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
