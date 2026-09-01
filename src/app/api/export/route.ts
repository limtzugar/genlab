import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * POST /api/export
 * Body: { inventionId }
 * Returns Markdown document of the invention (for client-side download).
 * Includes patent framing (claim, prior art, novelty) for IP defense.
 */
export async function POST(req: NextRequest) {
  const { inventionId } = await req.json()
  const invention = await db.invention.findUnique({
    where: { id: inventionId },
    include: {
      session: { include: { genes: true } },
    },
  })
  if (!invention) {
    return NextResponse.json({ error: 'Wynalazek nie znaleziony' }, { status: 404 })
  }

  const md = buildMarkdown(invention, invention.session)
  return NextResponse.json({
    filename: `${invention.name.replace(/\s+/g, '-').toLowerCase()}.md`,
    content: md,
  })
}

type InventionForExport = {
  name: string
  definition: string
  architecture: string
  patentClaim: string
  priorArt: string
  novelty: string
  autonomy: number
  ethics: number
  decentral: number
  ahiscore: number
  reasoning: string | null
}

type SessionForExport = {
  prompt: string
  genes: Array<{
    techName: string
    category: string
    role: string
    need: string
    githubUrl: string | null
    autonomy: number
    ethics: number
    decentral: number
    ahiScore: number
  }>
}

function buildMarkdown(inv: InventionForExport, session: SessionForExport) {
  const patentSection =
    inv.patentClaim || inv.priorArt || inv.novelty
      ? `
## Patent Framing

### Claim of Novelty
${inv.patentClaim || '—'}

### Prior Art
${inv.priorArt || '—'}

### Novelty
${inv.novelty || '—'}
`
      : ''

  return `# ${inv.name}

> ${inv.definition}

## Problem
${session.prompt}

## Architektura
${inv.architecture}

## Geny Technologiczne — DNA Wynalazku
${session.genes
  .map(
    (g) => `### ${g.techName}
- **Kategoria:** ${g.category}
- **Rola:** ${g.role}
- **Potrzeba:** ${g.need}
${g.githubUrl ? `- **GitHub:** ${g.githubUrl}` : ''}
- **AHI:** autonomiczność ${g.autonomy} | etyka ${g.ethics} | decentralizacja ${g.decentral} → **${g.ahiScore}**
`
  )
  .join('\n')}
${patentSection}
## Audyt AHI
- **Autonomiczność:** ${inv.autonomy}/100
- **Etyka:** ${inv.ethics}/100
- **Decentralizacja:** ${inv.decentral}/100
- **Wynik AHI:** ${inv.ahiscore}/100

### Uzasadnienie
${inv.reasoning}

---
*Wygenerowano przez Enter — gene-driven invention & patent pipeline*
`
}
