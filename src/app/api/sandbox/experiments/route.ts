import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/sandbox/experiments
 *
 * Zwraca listę eksperymentów sandboxowych z metadanymi.
 * Idempotentny — nie dotyka bazy danych.
 */
export const dynamic = 'force-dynamic'

type Experiment = {
  id: string
  title: string
  description: string
  status: 'planned' | 'active' | 'archived'
  category: 'ui' | 'analysis' | 'synthesis' | 'output' | 'input'
  estimatedComplexity: 'low' | 'medium' | 'high'
  dependsOn: string[]
}

const EXPERIMENTS: Experiment[] = [
  {
    id: 'prompt-lab',
    title: 'Prompt Lab',
    description:
      'Eksperymentalny edytor promptów z live podglądem tokenów i side-by-side diff poprzednich wersji. Każdy z 9 agentów pipeline ma swój editable prompt template.',
    status: 'planned',
    category: 'ui',
    estimatedComplexity: 'medium',
    dependsOn: [],
  },
  {
    id: 'gene-sim',
    title: 'Gene Similarity Sandbox',
    description:
      'Wektorowa symilarność genów (TF-IDF na README + opisach). Wynik w pamięci — test algorytmu zanim wejdzie do /explore jako nowy moduł.',
    status: 'planned',
    category: 'analysis',
    estimatedComplexity: 'medium',
    dependsOn: [],
  },
  {
    id: 'ahi-sim',
    title: 'AHI Simulator',
    description:
      'Manualna symulacja AHI: wybierasz licencję + tagi README + cechy architektury, sandbox liczy A/H/D score i zwraca rozkład. Test scoringu bez pipeline.',
    status: 'planned',
    category: 'analysis',
    estimatedComplexity: 'low',
    dependsOn: [],
  },
  {
    id: 'fusion-forge',
    title: 'Fusion Forge',
    description:
      'Ręczne budowanie fuzji genów z grafu — drag-and-drop węzłów, preview wynalazku przed uruchomieniem agenta Fusion Strategist.',
    status: 'planned',
    category: 'synthesis',
    estimatedComplexity: 'high',
    dependsOn: ['gene-sim'],
  },
  {
    id: 'patent-draft',
    title: 'Patent Draft Playground',
    description:
      'Sandbox dla Patent Composera — edytowalny szablon claimów, live preview PDF, bez zapisu sesji. Test różnych strategii claimów.',
    status: 'planned',
    category: 'output',
    estimatedComplexity: 'medium',
    dependsOn: [],
  },
  {
    id: 'import-sim',
    title: 'Import Simulator',
    description:
      'Symulacja importu zewnętrznego repo jako genu — walidacja metadanych (licencja, README, język) bez zapisu do DB. Zwraca co by się stało.',
    status: 'planned',
    category: 'input',
    estimatedComplexity: 'low',
    dependsOn: [],
  },
]

export async function GET() {
  let version = '0.0.0'
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    version = pkg.version ?? version
  } catch {
    // ignore
  }

  return NextResponse.json({
    version,
    total: EXPERIMENTS.length,
    byStatus: {
      planned: EXPERIMENTS.filter((e) => e.status === 'planned').length,
      active: EXPERIMENTS.filter((e) => e.status === 'active').length,
      archived: EXPERIMENTS.filter((e) => e.status === 'archived').length,
    },
    byCategory: {
      ui: EXPERIMENTS.filter((e) => e.category === 'ui').length,
      analysis: EXPERIMENTS.filter((e) => e.category === 'analysis').length,
      synthesis: EXPERIMENTS.filter((e) => e.category === 'synthesis').length,
      output: EXPERIMENTS.filter((e) => e.category === 'output').length,
      input: EXPERIMENTS.filter((e) => e.category === 'input').length,
    },
    experiments: EXPERIMENTS,
  })
}
