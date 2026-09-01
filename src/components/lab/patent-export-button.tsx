'use client'

import { useState } from 'react'
import { FileText, Loader2, Download, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

type Props = {
  inventionId: string
  inventionName: string
  size?: 'sm' | 'md'
}

/**
 * Patent PDF export button with language selector (PL / EN).
 *
 * On click, calls /api/export-patent which:
 *   1. Composes a structured patent document via Agent 8 (LLM)
 *   2. Builds a PDF with PDFKit including the schematic image
 *   3. Streams the PDF back
 *
 * The browser then downloads the file.
 */
export function PatentExportButton({ inventionId, inventionName, size = 'md' }: Props) {
  const [language, setLanguage] = useState<'pl' | 'en'>('pl')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')

  const handleExport = async () => {
    if (loading || !inventionId) return
    setLoading(true)
    setProgress('Komponuję dokument patentowy (Agent 8)…')
    try {
      const res = await fetch('/api/export-patent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventionId, language }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Nieznany błąd' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      setProgress('Generuję PDF…')

      // Get PDF as blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeName = (inventionName || 'wynalazek')
        .toLowerCase()
        .replace(/[^\w-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
      a.download = `patent-${safeName}-${language}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Patent PDF (${language.toUpperCase()}) pobrany`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd'
      toast.error(`Błąd eksportu PDF: ${msg.slice(0, 150)}`)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const isSm = size === 'sm'

  return (
    <div className={`flex items-center gap-1.5 ${isSm ? 'text-[10px]' : 'text-xs'}`}>
      {/* Language toggle */}
      <div
        className={`flex items-center rounded-md border border-border overflow-hidden bg-card ${
          isSm ? 'text-[10px]' : 'text-[11px]'
        }`}
        role="radiogroup"
        aria-label="Język PDF"
      >
        <Globe className={`w-3 h-3 text-muted-foreground mx-1.5 ${isSm ? 'hidden' : ''}`} />
        {(['pl', 'en'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            role="radio"
            aria-checked={language === lang}
            disabled={loading}
            onClick={() => setLanguage(lang)}
            className={`px-2 py-1 font-mono uppercase transition-colors ${
              language === lang
                ? 'bg-[var(--ahi)] text-white'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Export button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={handleExport}
        disabled={loading || !inventionId}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isSm
            ? 'px-2 py-1 text-[10px] border border-border hover:bg-muted'
            : 'px-3 py-1.5 text-xs bg-foreground text-background hover:opacity-90'
        }`}
        title={loading ? progress : `Eksportuj patent PDF (${language.toUpperCase()})`}
        aria-label={`Eksportuj patent PDF w języku ${language === 'pl' ? 'polskim' : 'angielskim'}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="truncate max-w-[140px]">{progress || 'Generuję…'}</span>
          </>
        ) : (
          <>
            <FileText className="w-3 h-3" />
            PDF
            <Download className="w-2.5 h-2.5 opacity-70" />
          </>
        )}
      </motion.button>
    </div>
  )
}
