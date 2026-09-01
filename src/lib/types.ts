export type ProblemAnalysis = {
  summary: string
  domains: string[]
  painPoints: string[]
  successCriteria: string[]
  searchQueries: string[]
  researchContext?: string[]
}

export type TechGene = {
  id?: string
  sessionId?: string
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
  reasoning?: string
}

export type AHIResult = {
  autonomy: number
  ethics: number
  decentral: number
  score: number
  reasoning: string
}

export type Fusion = {
  name: string
  definition: string
  architecture: string
  selectedGenes: string[]
  fusionStrategy: string
  patentClaim: string
  priorArt: string
  novelty: string
  inventionId: string
  ahi: AHIResult
}

export type HardwareComponent = {
  id?: string
  name: string
  category: string // compute | sensing | actuation | fabrication | connectivity | power | storage
  vendor: string
  role: string
  rationale: string
  estimatedCost: string
  alternatives: string
  recommended: boolean
  solutionId?: string
  solutionName?: string
  solutionPitch?: string
  solutionCost?: string
}

/**
 * A complete hardware BOM (bill of materials) for one variant.
 * The Hardware Architect agent proposes 2-3 variants per invention —
 * e.g. "Budget DIY", "Performance", "Pro Lab" — and the user selects
 * which one to view / use for schematic regeneration.
 */
export type HardwareSolution = {
  solutionId: string
  name: string
  pitch: string
  estimatedTotalCost: string
  hardware: HardwareComponent[]
}

export type Schematic = {
  id?: string
  kind: string // device | app-screen | system-diagram
  promptText: string
  imageDataUrl: string
  modelUsed: string
  size: string
}

export type SessionMeta = {
  id: string
  prompt: string
  mode: string
  status: string
  summary: string | null
  createdAt: string
  _count: { genes: number; inventions: number }
}

export type PipelineStage =
  | 'idle'
  | 'analysis'
  | 'genes'
  | 'ahi'
  | 'fusion'
  | 'score'
  | 'hardware'
  | 'schematic-prompt'
  | 'schematic-image'
  | 'done'
  | 'error'

export type StageEvent = {
  stage: PipelineStage
  label: string
}
