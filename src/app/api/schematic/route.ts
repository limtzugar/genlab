import { NextRequest } from 'next/server'
import { getZAI } from '@/lib/zai'
import { buildSchematicPrompt, type HardwareProposal } from '@/lib/agents'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 180

/**
 * POST /api/schematic
 *
 * Regenerates the device schematic / app mockup for a SPECIFIC hardware
 * solution variant. The user picks a solution in the UI (Budget / Perf / Pro)
 * and this endpoint rebuilds the schematic-prompt using only that solution's
 * hardware, then re-runs the image-gen model (nano-banana-2).
 *
 * Body:
 *   { sessionId: string, inventionId: string, solutionId: string }
 *
 * Returns JSON:
 *   { ok: true, schematic: { id, kind, size, modelUsed, imageDataUrl, solutionId, solutionName } }
 *   { ok: false, error: string }
 */
export async function POST(req: NextRequest) {
  const { sessionId, inventionId, solutionId } = await req.json().catch(() => ({}))

  if (!sessionId || !inventionId || !solutionId) {
    return Response.json(
      { ok: false, error: 'sessionId, inventionId, solutionId są wymagane' },
      { status: 400 }
    )
  }

  // Load invention
  const invention = await db.invention.findUnique({ where: { id: inventionId } })
  if (!invention) {
    return Response.json({ ok: false, error: 'Invention nie istnieje' }, { status: 404 })
  }

  // Load genes (we need them to build the schematic prompt)
  const genes = await db.gene.findMany({ where: { sessionId } })
  if (genes.length === 0) {
    return Response.json({ ok: false, error: 'Brak genów dla tej sesji' }, { status: 404 })
  }

  // Load hardware components for the requested solutionId
  const hardwareRows = await db.hardware.findMany({
    where: { sessionId, solutionId },
  })

  if (hardwareRows.length === 0) {
    return Response.json(
      { ok: false, error: `Brak hardware dla solutionId=${solutionId}` },
      { status: 404 }
    )
  }

  const solutionName = hardwareRows[0]?.solutionName || solutionId

  // Map DB rows → HardwareProposal (the shape buildSchematicPrompt expects)
  const hardware: HardwareProposal[] = hardwareRows.map((h) => ({
    name: h.name,
    category: h.category,
    vendor: h.vendor || '',
    role: h.role,
    rationale: h.rationale,
    estimatedCost: h.estimatedCost || '',
    alternatives: h.alternatives || '',
    recommended: h.recommended,
  }))

  // Reconstruct Fusion from DB (buildSchematicPrompt needs it)
  const fusion = {
    name: invention.name,
    definition: invention.definition,
    architecture: invention.architecture,
    selectedGenes: genes.map((g) => g.techName),
    fusionStrategy: '',
    patentClaim: invention.patentClaim,
    priorArt: invention.priorArt,
    novelty: invention.novelty,
  }

  // Build a NEW schematic prompt with the selected solution's hardware
  const schematicRequest = await buildSchematicPrompt(
    fusion,
    genes.map((g) => ({
      category: g.category as 'input' | 'processing' | 'output' | 'infrastructure',
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
    })),
    hardware
  )

  // Generate the image via nano-banana-2 (fallback to default model)
  const zai = await getZAI()
  let imageResp: { data?: Array<{ base64?: string }> } = { data: [] }
  let modelUsed = 'nano-banana-2'
  try {
    imageResp = await zai.images.generations.create({
      model: 'nano-banana-2',
      prompt: schematicRequest.promptText,
      size: schematicRequest.size,
    })
  } catch (modelErr) {
    modelUsed = 'zai-image-default'
    console.warn(
      '[/api/schematic] nano-banana-2 failed, falling back to default:',
      modelErr instanceof Error ? modelErr.message.slice(0, 120) : 'unknown'
    )
    imageResp = await zai.images.generations.create({
      prompt: schematicRequest.promptText,
      size: schematicRequest.size,
    })
  }

  const base64 = imageResp.data?.[0]?.base64 || ''
  if (!base64) {
    return Response.json(
      { ok: false, error: 'Model graficzny zwrócił pusty obraz' },
      { status: 502 }
    )
  }

  const imageDataUrl = `data:image/png;base64,${base64}`

  // Persist as a NEW schematic row (keep history)
  const schematic = await db.schematic.create({
    data: {
      sessionId,
      inventionId,
      kind: schematicRequest.kind,
      promptText: schematicRequest.promptText.slice(0, 5000),
      imageDataUrl,
      modelUsed,
      size: schematicRequest.size,
    },
  })

  return Response.json({
    ok: true,
    schematic: {
      id: schematic.id,
      kind: schematic.kind,
      size: schematic.size,
      modelUsed: schematic.modelUsed,
      imageDataUrl: schematic.imageDataUrl,
      promptText: schematic.promptText,
      solutionId,
      solutionName,
    },
  })
}
