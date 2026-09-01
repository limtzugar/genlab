'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Dna } from 'lucide-react'
import { GenLabSplash } from '@/components/lab/genlab-splash'
import { useTheme } from '@/components/lab/theme-provider'

export default function HomePage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const enterLab = () => {
    window.location.href = '/lab'
  }

  // Keyboard: Enter / Space → enter lab
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        enterLab()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Three.js DNA helix — absolute background */}
      <GenLabSplash />

      {/* Vignette dla czytelności tekstu */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse at center, transparent 30%, rgba(10,10,10,0.4) 80%)'
              : 'radial-gradient(ellipse at center, transparent 30%, rgba(250,250,250,0.5) 80%)',
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Top bar — minimalny, tylko logo i tagline */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : -8 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute top-6 left-6 right-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 rounded bg-foreground flex items-center justify-center">
              <Dna className="w-3.5 h-3.5 text-background" strokeWidth={2.5} />
            </div>
            <span className="text-xs font-mono-display text-muted-foreground uppercase tracking-wider">
              GenLab
            </span>
          </div>
          <span className="text-[10px] font-mono-display text-muted-foreground uppercase tracking-wider hidden sm:block">
            gene-driven · repo-first · patent-ready
          </span>
        </motion.header>

        {/* Hero — GenLab */}
        <div className="flex flex-col items-center text-center max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 12 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1
              className="font-display tracking-tight leading-none select-none"
              style={{
                fontSize: 'clamp(4.5rem, 16vw, 12rem)',
                /* Bricolage Grotesque variable font — load the heaviest instance
                   and engage the optical-size axis at 96 (display end). At
                   this size, opsz tightens the inktraps in letters like G, e,
                   a, b — sharp corners, stronger stroke contrast, more
                   architectural stance than the default body optical size.
                   This is the "subtle inktrap effect" visible at display sizes. */
                fontVariationSettings: '"opsz" 96, "wght" 800',
                fontWeight: 800,
                letterSpacing: '-0.045em',
                fontFeatureSettings: '"ss01"',
                /* Warm AHI amber — makes the GenLab wordmark pop against the
                   DNA-helix background and ties the landing page visually to
                   the rest of the app (sidebar active dots, hardware accent). */
                color: 'var(--ahi)',
                textShadow: '0 4px 32px rgba(234, 88, 12, 0.18)',
              }}
            >
              GenLab
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-sm sm:text-base font-mono-display uppercase tracking-[0.2em]"
            style={{
              /* JetBrains Mono 500 — the tagline reads as a precise technical
                 subtitle, distinct from the body text but in the same amber
                 family. Slightly muted via opacity so the tagline doesn't
                 compete with the wordmark for attention. */
              fontWeight: 500,
              color: 'var(--ahi)',
              opacity: 0.9,
            }}
          >
            gene-driven{' '}
            {/* Editorial italic accent — Instrument Serif italic on the word
                "invention" breaks the all-mono rhythm and signals that this is
                the human/creative axis of the pipeline, while "patent" stays
                in mono to signal the technical/legal axis. The visual contrast
                between the two words IS the brand story. */}
            <span
              className="font-serif-italic normal-case tracking-normal"
              style={{
                fontStyle: 'italic',
                fontSize: '1.15em',
                fontWeight: 400,
                /* Slightly fuller amber (no opacity dim) so the italic word
                   reads as a deliberate accent, not a faded tag-along. */
                opacity: 1,
                textShadow: '0 2px 16px rgba(234, 88, 12, 0.12)',
              }}
            >
              invention
            </span>{' '}
            & patent pipeline
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
            transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-md text-sm leading-relaxed"
            style={{
              /* AHI amber at 0.8 opacity — softer than the wordmark but
                 still on-brand. Long-form text needs slightly lower
                 saturation to remain comfortably readable. */
              color: 'var(--ahi)',
              opacity: 0.8,
            }}
          >
            Odkrywa DNA nowych wynalazków szukając konkretnych repozytoriów open-source
            na GitHub, łączy je jak geny w nowe wynalazki, i formułuje patent claim.
            Teoria jest jedną z sześciu warstw krytycznych pipeline.
          </motion.p>

          {/* CTA — GenLab */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
            transition={{ duration: 0.8, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            onClick={enterLab}
            className="group mt-10 px-6 py-3 rounded-lg transition-all flex items-center gap-2 text-sm font-semibold"
            style={{
              /* AHI amber background + readable dark text. The dark text
                 keeps contrast high on the warm orange, and matches the
                 wordmark's text-shadow color for cohesion. */
              backgroundColor: 'var(--ahi)',
              color: '#0a0a0a',
              boxShadow: '0 4px 24px rgba(234, 88, 12, 0.35)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'
            }}
            aria-label="GenLab — przejdź do laboratorium"
          >
            GenLab
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </motion.button>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: mounted ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="mt-4 text-[10px] text-muted-foreground/60 font-mono-display"
          >
            naciśnij Enter lub kliknij, aby wejść
          </motion.div>
        </div>

        {/* Footer — minimalny */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: mounted ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-[10px] font-mono-display text-muted-foreground/60 uppercase tracking-wider"
        >
          <span>GenLab · v3</span>
          <span className="hidden sm:block">multi-agent SSE · Prisma persistence</span>
        </motion.footer>
      </div>
    </main>
  )
}
