import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

/**
 * Cached ZAI singleton — avoids recreating the client on every request.
 */
export async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export type TechGene = {
  category: 'input' | 'processing' | 'output' | 'infrastructure'
  need: string
  techName: string
  githubUrl: string | null
  role: string
  description: string | null
  stars: number | null
  language: string | null
  license: string | null
}

export type AHIResult = {
  autonomy: number
  ethics: number
  decentral: number
  score: number
  reasoning: string
}

export type Invention = {
  name: string
  definition: string
  architecture: string
  ahi: AHIResult
  geneIds: string[]
}
