import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  composePatentDocument,
  type HardwareProposal,
} from '@/lib/agents'
import { buildPatentPdf } from '@/scripts/build-patent-pdf'

export const runtime = 'nodejs'
export const maxDuration = 180

// Fusion shape used by composePatentDocument — matches the agents.ts input
// (which has a different Fusion type than lib/types.ts).
type FusionForPatent = {
  name: string
  definition: string
  architecture: string
  selectedGenes: string[]
  fusionStrategy: string
  patentClaim: string
  priorArt: string
  novelty: string
  inventionId: string
  ahi: { autonomy: number; ethics: number; decentral: number; score: number; reasoning: string }
}

type GeneForPatent = {
  category: string
  need: string
  techName: string
  githubUrl: string | null
  role: string
  description: string | null
  stars: number | null
  language: string | null
  license: string | null
  autonomy: number
  ethics: number
  decentral: number
  ahiScore: number
}

/**
 * POST /api/export-patent
 * Body: { inventionId, language: 'pl' | 'en' }
 *
 * Returns a PDF buffer (application/pdf) — the client triggers a file download.
 *
 * Pipeline:
 *   1. Fetch invention + session (genes, hardware, schematics) from DB
 *   2. Compose structured patent document via Agent 8 (LLM call)
 *   3. Build PDF with PDFKit (registered Liberation Serif/Sans/Mono fonts)
 *   4. Stream PDF bytes back to client
 */
export async function POST(req: NextRequest) {
  const { inventionId, language: langRaw } = await req.json().catch(() => ({}))
  const language: 'pl' | 'en' = langRaw === 'en' ? 'en' : 'pl'

  if (!inventionId || typeof inventionId !== 'string') {
    return NextResponse.json(
      { error: 'Brak inventionId' },
      { status: 400 }
    )
  }

  const invention = await db.invention.findUnique({
    where: { id: inventionId },
    include: {
      session: {
        include: {
          genes: true,
          hardware: true,
          schematics: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })

  if (!invention) {
    return NextResponse.json(
      { error: 'Wynalazek nie znaleziony' },
      { status: 404 }
    )
  }

  // Build Fusion shape that composePatentDocument expects
  const fusion: FusionForPatent = {
    name: invention.name,
    definition: invention.definition,
    architecture: invention.architecture,
    selectedGenes: [],
    fusionStrategy: '',
    patentClaim: invention.patentClaim,
    priorArt: invention.priorArt,
    novelty: invention.novelty,
    inventionId: invention.id,
    ahi: {
      autonomy: invention.autonomy,
      ethics: invention.ethics,
      decentral: invention.decentral,
      score: invention.ahiscore,
      reasoning: invention.reasoning || '',
    },
  }

  const genes: GeneForPatent[] = invention.session.genes.map((g) => ({
    category: g.category,
    need: g.need,
    techName: g.techName,
    githubUrl: g.githubUrl,
    role: g.role,
    description: g.description,
    stars: g.stars,
    language: g.language,
    license: g.license,
    autonomy: g.autonomy,
    ethics: g.ethics,
    decentral: g.decentral,
    ahiScore: g.ahiScore,
  }))

  const hardware: HardwareProposal[] = invention.session.hardware.map((h) => ({
    name: h.name,
    category: h.category,
    vendor: h.vendor || '',
    role: h.role,
    rationale: h.rationale,
    estimatedCost: h.estimatedCost || '',
    alternatives: h.alternatives || '',
    recommended: h.recommended,
  }))

  const ahi = fusion.ahi

  // Pick latest schematic image
  const schematic = invention.session.schematics?.[0] || null
  const schematicBase64 = schematic?.imageDataUrl?.startsWith('data:image/png;base64,')
    ? schematic.imageDataUrl.slice('data:image/png;base64,'.length)
    : null

  try {
    // Compose the patent document via Agent 8 (LLM)
    const doc = await composePatentDocument({
      fusion,
      genes,
      hardware,
      originalPrompt: invention.session.prompt,
      ahi,
      language,
    })

    // Build the PDF
    const pdfBytes = await buildPatentPdf({
      doc,
      genes: genes.map((g) => ({
        techName: g.techName,
        category: g.category,
        role: g.role,
        need: g.need,
        githubUrl: g.githubUrl,
        ahiScore: g.ahiScore,
        autonomy: g.autonomy,
        ethics: g.ethics,
        decentral: g.decentral,
      })),
      hardware: hardware.map((h) => ({
        name: h.name,
        category: h.category,
        vendor: h.vendor || null,
        role: h.role,
        rationale: h.rationale,
        estimatedCost: h.estimatedCost || null,
        alternatives: h.alternatives || null,
        recommended: h.recommended,
      })),
      ahi,
      schematicImageBase64: schematicBase64,
      originalPrompt: invention.session.prompt,
    })

    // Filename
    const safeName = invention.name
      .toLowerCase()
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'wynalazek'
    const filename = `patent-${safeName}-${language}.pdf`

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.length),
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Nieznany błąd'
    return NextResponse.json(
      { error: `Błąd generowania PDF: ${raw.slice(0, 300)}` },
      { status: 500 }
    )
  }
}
