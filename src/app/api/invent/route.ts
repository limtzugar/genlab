import { NextRequest } from 'next/server'
import { getZAI, type TechGene, type AHIResult } from '@/lib/zai'
import {
  analyzeProblem,
  extractGenes,
  scoreAHI,
  fuseGenes,
  scoreInvention,
  proposeHardware,
  buildSchematicPrompt,
} from '@/lib/agents'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/invent
 * Streaming SSE pipeline (Enter — Gene-Driven Invention):
 *   event: session     — session created in DB
 *   event: analysis    — problem analysis complete (theory layer)
 *   event: gene        — each gene as it's discovered + AHI-scored
 *   event: fusion      — fused invention with patent framing
 *   event: score       — final AHI score for the invention
 *   event: hardware    — proposed hardware components (Stage 6)
 *   event: schematic-prompt — built prompt for image-gen (Stage 7a)
 *   event: schematic-image  — generated schematic PNG data URL (Stage 7b)
 *   event: done        — pipeline complete
 *   event: error       — pipeline failed
 *
 * Heartbeat: SSE comment `: ping` (padded to ~2KB) every 3s forces every
 * proxy in the chain to flush and prevents silent-connection kills during
 * long agent calls (image gen alone can run 30-60s).
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  let aborted = false

  const { prompt, mode = 'invent' } = await req.json().catch(() => ({}))
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Prompt jest wymagany' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Persist session
  const session = await db.session.create({
    data: { prompt: prompt.trim(), mode, status: 'active' },
  })

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (aborted) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // controller may be closed
        }
      }

      // Heartbeat: every 3s send a PADDED SSE comment to keep the connection
      // alive through every layer of the proxy chain (Caddy → public tunnel →
      // possibly Cloudflare → browser).
      //
      // Why 3s + padding:
      //   • Many reverse proxies (nginx default, Cloudflare free tier, mobile
      //     carriers) kill "silent" SSE connections after 30-60s. During long
      //     LLM calls (image generation takes 30-60s), the only bytes the
      //     client receives are these comments.
      //   • A tiny `: ping` comment (under 50 bytes) can get buffered by an
      //     intermediate proxy that waits for ~4KB before flushing. We pad
      //     each heartbeat to ~2KB so a single heartbeat forces a flush.
      //   • 3s interval means even a 60s LLM call emits ~20 heartbeats —
      //     more than enough to ride out any reasonable proxy timeout.
      const heartbeat = setInterval(() => {
        if (aborted) return
        try {
          const ts = Date.now()
          // 2KB of spaces after `: ping <ts>` — SSE comments ignore leading
          // whitespace, so this is safe per the SSE spec.
          const padding = ' '.repeat(2048)
          controller.enqueue(
            encoder.encode(`: ping ${ts} ${padding}\n\n`)
          )
        } catch {
          // controller closed
        }
      }, 3_000)

      try {
        send('session', { sessionId: session.id, prompt, mode })

        // Stage 1: Analyze problem (theory layer)
        send('stage', { stage: 'analysis', label: 'Warstwa teoretyczna: analizuję problem…' })
        const analysis = await analyzeProblem(prompt)
        send('analysis', analysis)

        // Stage 2: Extract genes (repo-first discovery)
        send('stage', { stage: 'genes', label: 'Szukam konkretnych repozytoriów GitHub…' })
        const genes = await extractGenes(analysis)
        if (genes.length === 0) {
          throw new Error('Nie udało się znaleźć genów technologicznych — web_search mógł zostać zablokowany przez rate limit. Spróbuj ponownie za 30s.')
        }

        // Stage 3: Score each gene AHI SEQUENTIALLY (avoid rate limit)
        send('stage', { stage: 'ahi', label: `Filtr AHI genu (0/${genes.length})…` })
        // TechGene has string-literal category, but we coerce via String() for safety.
        // Use a permissive type so scoredGenes can absorb the coerced shape.
        type ScoredGene = TechGene & { ahi: AHIResult }
        const scoredGenes: ScoredGene[] = []
        for (let i = 0; i < genes.length; i++) {
          const gene = genes[i]
          send('stage', { stage: 'ahi', label: `Filtr AHI genu (${i + 1}/${genes.length})…` })
          // Coerce required string fields — Prisma rejects undefined even if optional in our types
          const safeGene = {
            category: String(gene.category || 'processing') as TechGene['category'],
            need: String(gene.need || gene.role || 'zdolność techniczna'),
            techName: String(gene.techName || 'unknown'),
            role: String(gene.role || ''),
            githubUrl: gene.githubUrl ?? null,
            description: gene.description ?? null,
            stars: typeof gene.stars === 'number' ? gene.stars : null,
            language: gene.language ?? null,
            license: gene.license ?? null,
          }
          try {
            const ahi = await scoreAHI(gene)
            const saved = await db.gene.create({
              data: {
                sessionId: session.id,
                ...safeGene,
                autonomy: ahi.autonomy,
                ethics: ahi.ethics,
                decentral: ahi.decentral,
                ahiScore: ahi.score,
              },
            })
            send('gene', { ...saved, reasoning: ahi.reasoning })
            scoredGenes.push({ ...gene, ...safeGene, ahi })
          } catch (geneErr) {
            // Save gene even if AHI fails — use neutral fallback.
            // ALWAYS include `need` (required by Prisma schema).
            const fallbackReason =
              geneErr instanceof Error
                ? `Pominięto AHI — błąd: ${geneErr.message.slice(0, 120)}`
                : 'Pominięto AHI — nieznany błąd.'
            try {
              const saved = await db.gene.create({
                data: {
                  sessionId: session.id,
                  ...safeGene,
                  autonomy: 50,
                  ethics: 50,
                  decentral: 50,
                  ahiScore: 50,
                },
              })
              send('gene', { ...saved, reasoning: fallbackReason })
              scoredGenes.push({
                ...gene,
                ...safeGene,
                ahi: { autonomy: 50, ethics: 50, decentral: 50, score: 50, reasoning: '' },
              })
            } catch {
              // If even the fallback save fails, skip this gene but don't crash pipeline.
              send('gene', {
                id: `err-${i}`,
                sessionId: session.id,
                ...safeGene,
                autonomy: 50,
                ethics: 50,
                decentral: 50,
                ahiScore: 50,
                reasoning: 'Gen pominięty — błąd zapisu.',
              })
            }
          }
        }

        // Stage 4: Fuse (fusion + patent layer)
        send('stage', { stage: 'fusion', label: 'Syntezuję wynalazek i formułuję patent claim…' })
        const fusion = await fuseGenes(prompt, scoredGenes)

        // Stage 5: Score invention AHI
        send('stage', { stage: 'score', label: 'Finalny audyt AHI całego systemu…' })
        const inventionAHI = await scoreInvention(fusion, scoredGenes)

        const invention = await db.invention.create({
          data: {
            sessionId: session.id,
            name: fusion.name,
            definition: fusion.definition,
            architecture: fusion.architecture,
            patentClaim: fusion.patentClaim || '',
            priorArt: fusion.priorArt || '',
            novelty: fusion.novelty || '',
            autonomy: inventionAHI.autonomy,
            ethics: inventionAHI.ethics,
            decentral: inventionAHI.decentral,
            ahiscore: inventionAHI.score,
            reasoning: inventionAHI.reasoning,
            status: 'validated',
          },
        })

        await db.session.update({
          where: { id: session.id },
          data: {
            status: 'completed',
            summary: `${fusion.name} — AHI ${inventionAHI.score}`,
          },
        })

        send('fusion', {
          ...fusion,
          inventionId: invention.id,
          ahi: inventionAHI,
        })

        // Stage 6: Hardware (Hardware Architect layer)
        // Now returns 2-3 SOLUTION VARIANTS — UI lets the user pick one.
        // Schematic is generated for solution #1 by default; user can
        // regenerate it for any other solution via /api/schematic.
        send('stage', { stage: 'hardware', label: 'Wybieram warianty hardware — Budget / Performance / Pro…' })
        let solutions: Awaited<ReturnType<typeof proposeHardware>> = []
        try {
          solutions = await proposeHardware(
            fusion,
            scoredGenes,
            analysis.researchContext || []
          )

          // For each solution, persist its components with the solutionId tag.
          // Stream a `hardware-solution` event first (with metadata), then
          // stream each component as a `hardware` event tagged with solutionId.
          for (const sol of solutions) {
            send('hardware-solution', {
              solutionId: sol.solutionId,
              name: sol.name,
              pitch: sol.pitch,
              estimatedTotalCost: sol.estimatedTotalCost,
              count: sol.hardware.length,
            })
            for (const hw of sol.hardware) {
              try {
                const saved = await db.hardware.create({
                  data: {
                    sessionId: session.id,
                    inventionId: invention.id,
                    solutionId: sol.solutionId,
                    solutionName: sol.name,
                    solutionPitch: sol.pitch,
                    solutionCost: sol.estimatedTotalCost,
                    name: hw.name,
                    category: hw.category,
                    vendor: hw.vendor,
                    role: hw.role,
                    rationale: hw.rationale,
                    estimatedCost: hw.estimatedCost,
                    alternatives: hw.alternatives,
                    recommended: hw.recommended,
                  },
                })
                send('hardware', { ...saved, solutionId: sol.solutionId, solutionName: sol.name })
              } catch {
                // skip individual hardware failures
              }
            }
          }
          if (solutions.length === 0 || solutions.every((s) => s.hardware.length === 0)) {
            send('hardware', { skipped: true, reason: 'Agent nie zaproponował żadnego hardware' })
          }
        } catch (hwErr) {
          // Hardware stage failure is non-fatal — pipeline continues to schematic
          const reason = hwErr instanceof Error ? hwErr.message.slice(0, 200) : 'nieznany błąd'
          send('hardware', { skipped: true, reason })
        }

        // Stage 7a: Build schematic prompt for the FIRST solution (default).
        // The user can regenerate for other solutions via /api/schematic.
        send('stage', { stage: 'schematic-prompt', label: 'Buduję prompt do schematu urządzenia…' })
        let schematicRequest: Awaited<ReturnType<typeof buildSchematicPrompt>>
        try {
          // Use first solution's hardware; fallback to flat list if no solutions
          const defaultHardware = solutions[0]?.hardware || []
          schematicRequest = await buildSchematicPrompt(fusion, scoredGenes, defaultHardware)
          send('schematic-prompt', {
            kind: schematicRequest.kind,
            size: schematicRequest.size,
            promptText: schematicRequest.promptText,
            solutionId: solutions[0]?.solutionId || null,
            solutionName: solutions[0]?.name || null,
          })
        } catch (promptErr) {
          const reason = promptErr instanceof Error ? promptErr.message.slice(0, 200) : 'nieznany błąd'
          send('schematic-image', { skipped: true, reason })
          send('done', { sessionId: session.id, inventionId: invention.id })
          return
        }

        // Stage 7b: Generate schematic image via image model.
        // Use nano-banana-2 — best for schematics (user spec). Fall back to
        // default model if nano-banana-2 fails (rate limit, model unavailable).
        send('stage', { stage: 'schematic-image', label: 'Generuję schemat urządzenia (nano-banana-2)…' })
        try {
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
            // Fallback: default model (no explicit model param)
            modelUsed = 'zai-image-default'
            console.warn('[schematic] nano-banana-2 failed, falling back to default:', modelErr instanceof Error ? modelErr.message.slice(0, 120) : 'unknown')
            imageResp = await zai.images.generations.create({
              prompt: schematicRequest.promptText,
              size: schematicRequest.size,
            })
          }
          const base64 = imageResp.data?.[0]?.base64 || ''
          if (base64) {
            const imageDataUrl = `data:image/png;base64,${base64}`
            const schematic = await db.schematic.create({
              data: {
                sessionId: session.id,
                inventionId: invention.id,
                kind: schematicRequest.kind,
                promptText: schematicRequest.promptText.slice(0, 5000),
                imageDataUrl,
                modelUsed,
                size: schematicRequest.size,
              },
            })
            send('schematic-image', {
              id: schematic.id,
              kind: schematic.kind,
              size: schematic.size,
              modelUsed: schematic.modelUsed,
              imageDataUrl: schematic.imageDataUrl,
            })
          } else {
            send('schematic-image', { skipped: true, reason: 'Model graficzny zwrócił pusty obraz' })
          }
        } catch (imgErr) {
          const reason = imgErr instanceof Error ? imgErr.message.slice(0, 200) : 'nieznany błąd'
          send('schematic-image', { skipped: true, reason })
        }

        send('done', { sessionId: session.id, inventionId: invention.id })
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Nieznany błąd'
        // Classify error for clearer client messaging
        let classification = 'unknown'
        if (raw.includes('429') || raw.toLowerCase().includes('too many requests')) {
          classification = 'rate-limit'
        } else if (raw.toLowerCase().includes('network') || raw.toLowerCase().includes('fetch')) {
          classification = 'network'
        } else if (raw.toLowerCase().includes('json') || raw.includes('parse')) {
          classification = 'parse'
        }
        send('error', { message: raw, classification })
        try {
          await db.session.update({
            where: { id: session.id },
            data: { status: 'archived' },
          })
        } catch {
          // session update failure shouldn't mask the original error
        }
      } finally {
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      aborted = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
