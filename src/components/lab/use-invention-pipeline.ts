'use client'

import { useCallback, useRef, useState } from 'react'
import type {
  ProblemAnalysis,
  TechGene,
  Fusion,
  PipelineStage,
  HardwareComponent,
  HardwareSolution,
  Schematic,
} from '@/lib/types'

type PipelineState = {
  status: 'idle' | 'running' | 'done' | 'error'
  stage: PipelineStage
  stageLabel: string
  sessionId: string | null
  analysis: ProblemAnalysis | null
  genes: TechGene[]
  fusion: Fusion | null
  /** All hardware components across all solutions, each tagged with solutionId */
  hardware: HardwareComponent[]
  /** Solution variants (Budget / Performance / Pro) — metadata only */
  solutions: HardwareSolution[]
  /** Currently selected solution ID in the UI (defaults to first streamed) */
  selectedSolutionId: string | null
  schematicPrompt: {
    kind: string
    size: string
    promptText: string
    solutionId?: string | null
    solutionName?: string | null
  } | null
  schematicImage: Schematic | null
  /** When regenerating schematic for a different solution — loading state */
  schematicRegenerating: boolean
  hardwareSkipped: string | null
  schematicSkipped: string | null
  error: string | null
}

const initialState: PipelineState = {
  status: 'idle',
  stage: 'idle',
  stageLabel: '',
  sessionId: null,
  analysis: null,
  genes: [],
  fusion: null,
  hardware: [],
  solutions: [],
  selectedSolutionId: null,
  schematicPrompt: null,
  schematicImage: null,
  schematicRegenerating: false,
  hardwareSkipped: null,
  schematicSkipped: null,
  error: null,
}

export function useInventionPipeline() {
  const [state, setState] = useState<PipelineState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (prompt: string, mode: string = 'invent') => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ ...initialState, status: 'running', stage: 'analysis', stageLabel: 'Analizuję problem…' })

    try {
      const res = await fetch('/api/invent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Pipeline failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const raw of events) {
          const lines = raw.split('\n')
          let event = 'message'
          let data = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7)
            else if (line.startsWith('data: ')) data += line.slice(6)
          }
          if (!data) continue
          const payload = JSON.parse(data)
          handleEvent(event, payload, setState)
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const raw = (err as Error).message || ''
      let friendly = raw
      if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('network')) {
        friendly =
          'Połączenie z serwerem zostało przerwane. Enter pracuje 40-90s — jeśli proxy ucina połączenie, spróbuj ponownie (heartbeat SSE powinien utrzymać je przy życiu).'
      } else if (raw.includes('429') || raw.toLowerCase().includes('too many requests')) {
        friendly =
          'Rate limit API ZAI. Poczekaj 30-60s — Enter zserializował zapytania, ale limit globalny nadal obowiązuje.'
      } else if (raw.includes('aborted')) {
        return
      } else if (raw.includes('Nie udało się znaleźć genów')) {
        friendly = raw // already user-friendly
      } else {
        friendly = `Błąd pipeline: ${raw.slice(0, 200)}`
      }
      setState((s) => ({
        ...s,
        status: 'error',
        stage: 'error',
        error: friendly,
      }))
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState(initialState)
  }, [])

  const reset = useCallback(() => setState(initialState), [])

  /**
   * Regenerates the schematic image for a SPECIFIC hardware solution variant.
   * Calls /api/schematic which rebuilds the image-gen prompt using only the
   * selected solution's hardware and re-runs nano-banana-2.
   */
  const regenerateSchematic = useCallback(
    async (solutionId: string) => {
      if (!state.sessionId || !state.fusion?.inventionId) return
      setState((s) => ({
        ...s,
        schematicRegenerating: true,
        selectedSolutionId: solutionId,
      }))
      try {
        const res = await fetch('/api/schematic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.sessionId,
            inventionId: state.fusion.inventionId,
            solutionId,
          }),
        })
        const data = await res.json()
        if (!data.ok) {
          throw new Error(data.error || 'Nie udało się zregenerować schematu')
        }
        setState((s) => ({
          ...s,
          schematicRegenerating: false,
          schematicImage: {
            id: data.schematic.id,
            kind: data.schematic.kind,
            size: data.schematic.size,
            modelUsed: data.schematic.modelUsed,
            imageDataUrl: data.schematic.imageDataUrl,
            promptText: data.schematic.promptText,
          },
          schematicPrompt: {
            kind: data.schematic.kind,
            size: data.schematic.size,
            promptText: data.schematic.promptText,
            solutionId: data.schematic.solutionId,
            solutionName: data.schematic.solutionName,
          },
          schematicSkipped: null,
        }))
      } catch (err) {
        setState((s) => ({
          ...s,
          schematicRegenerating: false,
          schematicSkipped:
            (err instanceof Error ? err.message : 'nieznany błąd').slice(0, 200),
        }))
      }
    },
    [state.sessionId, state.fusion?.inventionId]
  )

  /** Switches the displayed solution variant in the UI (no API call). */
  const selectSolution = useCallback((solutionId: string) => {
    setState((s) => ({ ...s, selectedSolutionId: solutionId }))
  }, [])

  return { state, run, cancel, reset, regenerateSchematic, selectSolution }
}

function handleEvent(
  event: string,
  payload: unknown,
  setState: React.Dispatch<React.SetStateAction<PipelineState>>
) {
  const p = payload as Record<string, unknown>
  switch (event) {
    case 'session':
      setState((s) => ({ ...s, sessionId: p.sessionId as string }))
      break
    case 'stage':
      setState((s) => ({
        ...s,
        stage: p.stage as PipelineStage,
        stageLabel: p.label as string,
      }))
      break
    case 'analysis':
      setState((s) => ({ ...s, analysis: p as unknown as ProblemAnalysis }))
      break
    case 'gene':
      setState((s) => ({ ...s, genes: [...s.genes, p as unknown as TechGene] }))
      break
    case 'fusion':
      setState((s) => ({ ...s, fusion: p as unknown as Fusion }))
      break
    case 'hardware-solution': {
      // Metadata-only event: solutionId + name + pitch + cost
      const sol: HardwareSolution = {
        solutionId: String(p.solutionId),
        name: String(p.name || ''),
        pitch: String(p.pitch || ''),
        estimatedTotalCost: String(p.estimatedTotalCost || ''),
        hardware: [], // populated as `hardware` events arrive
      }
      setState((s) => {
        const isFirst = s.solutions.length === 0
        return {
          ...s,
          solutions: [...s.solutions, sol],
          // Auto-select the first solution
          selectedSolutionId: s.selectedSolutionId || (isFirst ? sol.solutionId : null),
        }
      })
      break
    }
    case 'hardware': {
      // Two possible shapes: a saved component, or a {skipped, reason} marker
      if (p.skipped) {
        setState((s) => ({ ...s, hardwareSkipped: String(p.reason || 'pominięto') }))
        break
      }
      const hw = p as unknown as HardwareComponent
      setState((s) => {
        const newHardware = [...s.hardware, hw]
        // Also push into the matching solution's hardware array
        const solutions = s.solutions.map((sol) =>
          sol.solutionId === hw.solutionId
            ? { ...sol, hardware: [...sol.hardware, hw] }
            : sol
        )
        return { ...s, hardware: newHardware, solutions }
      })
      break
    }
    case 'schematic-prompt':
      setState((s) => ({
        ...s,
        schematicPrompt: {
          kind: String(p.kind || 'device'),
          size: String(p.size || '1344x768'),
          promptText: String(p.promptText || ''),
          solutionId: (p.solutionId as string | null) ?? null,
          solutionName: (p.solutionName as string | null) ?? null,
        },
      }))
      break
    case 'schematic-image': {
      if (p.skipped) {
        setState((s) => ({
          ...s,
          schematicSkipped: String(p.reason || 'pominięto'),
          status: 'done',
          stage: 'done',
        }))
        break
      }
      const sch = p as unknown as Schematic
      setState((s) => ({
        ...s,
        schematicImage: sch,
        status: 'done',
        stage: 'done',
      }))
      break
    }
    case 'error':
      setState((s) => ({
        ...s,
        status: 'error',
        stage: 'error',
        error: p.message as string,
      }))
      break
    case 'done':
      setState((s) => ({ ...s, status: 'done', stage: 'done' }))
      break
  }
}
