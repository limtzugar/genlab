'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * GenLabSplash — pełnoekranowa animacja DNA helix w three.js
 * Styl: monocolor minimalistyczny (foreground color)
 * Mikrointerakcje: parallax mouse, pulsujące rungi
 */
export function GenLabSplash() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => {
    setMounted(true)
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    // ===== Scene =====
    const scene = new THREE.Scene()

    // ===== Camera =====
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 12)

    // ===== Renderer =====
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // przezroczyste tło — dziedziczy --background
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    // ===== Color z CSS variable (foreground) =====
    // light: #0a0a0a, dark: #fafafa
    const getFgColor = () => {
      const css = getComputedStyle(document.documentElement)
      const v = css.getPropertyValue('--foreground').trim() || '#0a0a0a'
      return new THREE.Color(v)
    }
    const fgColor = getFgColor()

    // ===== Helix group =====
    const helixGroup = new THREE.Group()
    scene.add(helixGroup)

    // Parametry helisy
    const TURNS = 4 // liczba pełnych obrotów
    const STEPS_PER_TURN = 24 // punktów na obrót
    const TOTAL_STEPS = TURNS * STEPS_PER_TURN
    const HELIX_HEIGHT = 8 // wysokość całej helisy
    const HELIX_RADIUS = 1.6 // promień helisy
    const PHASE_SHIFT = Math.PI // druga spirala przesunięta o 180°

    // ===== Sfery na obu spiralach (backbone) =====
    const backboneGeo = new THREE.SphereGeometry(0.07, 16, 16)
    const backboneMat = new THREE.MeshBasicMaterial({ color: fgColor })

    const backbone1: THREE.Mesh[] = []
    const backbone2: THREE.Mesh[] = []
    const rungs: THREE.Mesh[] = []
    const rungMats: THREE.MeshBasicMaterial[] = []

    for (let i = 0; i < TOTAL_STEPS; i++) {
      const t = i / TOTAL_STEPS
      const angle = t * TURNS * Math.PI * 2
      const y = (t - 0.5) * HELIX_HEIGHT

      // Spirala 1
      const x1 = Math.cos(angle) * HELIX_RADIUS
      const z1 = Math.sin(angle) * HELIX_RADIUS
      const m1 = new THREE.Mesh(backboneGeo, backboneMat)
      m1.position.set(x1, y, z1)
      helixGroup.add(m1)
      backbone1.push(m1)

      // Spirala 2 (przesunięta o 180°)
      const x2 = Math.cos(angle + PHASE_SHIFT) * HELIX_RADIUS
      const z2 = Math.sin(angle + PHASE_SHIFT) * HELIX_RADIUS
      const m2 = new THREE.Mesh(backboneGeo, backboneMat)
      m2.position.set(x2, y, z2)
      helixGroup.add(m2)
      backbone2.push(m2)

      // Rung (połączenie) — co 2 kroki, grubsza linia
      if (i % 2 === 0) {
        const start = new THREE.Vector3(x1, y, z1)
        const end = new THREE.Vector3(x2, y, z2)
        const len = start.distanceTo(end)
        const rungGeo = new THREE.CylinderGeometry(0.018, 0.018, len, 8)
        const rungMat = new THREE.MeshBasicMaterial({
          color: fgColor,
          transparent: true,
          opacity: 0.6,
        })
        const rung = new THREE.Mesh(rungGeo, rungMat)
        // Orientacja cylindra: domyślnie Y-up, więc rotujemy do wektora start→end
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
        rung.position.copy(mid)
        const dir = new THREE.Vector3().subVectors(end, start).normalize()
        const quaternion = new THREE.Quaternion()
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        rung.quaternion.copy(quaternion)
        helixGroup.add(rung)
        rungs.push(rung)
        rungMats.push(rungMat)
      }
    }

    // Początkowa rotacja
    helixGroup.rotation.y = 0

    // ===== Animation loop =====
    let raf = 0
    const start = performance.now()

    const animate = () => {
      const now = performance.now()
      const elapsed = (now - start) / 1000 // sekundy

      // Główny obrót wokół osi Y
      helixGroup.rotation.y = elapsed * 0.5

      // Parallax mouse — smooth lerp
      mouseRef.current.tx += (mouseRef.current.x - mouseRef.current.tx) * 0.05
      mouseRef.current.ty += (mouseRef.current.y - mouseRef.current.ty) * 0.05
      helixGroup.rotation.x = mouseRef.current.ty * 0.3
      helixGroup.position.x = mouseRef.current.tx * 0.5

      // Pulsujące rungi — sinusoidalna opacity
      for (let i = 0; i < rungs.length; i++) {
        const phase = (i / rungs.length) * Math.PI * 2
        rungMats[i].opacity = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(elapsed * 2 + phase))
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    // ===== Mouse parallax =====
    const onMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5 // -0.5..0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      mouseRef.current.x = nx
      mouseRef.current.y = ny
    }
    window.addEventListener('mousemove', onMouseMove)

    // ===== Resize =====
    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    // ===== Cleanup =====
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      mount.removeChild(renderer.domElement)
      // Dispose geometries & materials
      backboneGeo.dispose()
      backboneMat.dispose()
      rungs.forEach((r, i) => {
        r.geometry.dispose()
        rungMats[i].dispose()
      })
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    />
  )
}
