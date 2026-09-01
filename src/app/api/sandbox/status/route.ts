import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/sandbox/status
 *
 * Zwraca metadane sandboxu: wersja projektu (z package.json), status flagi
 * SANDBOX_ENABLED, lista aktywnych eksperymentów, timestamp.
 *
 * Sandbox jest osobną przestrzenią nazw (/sandbox/*, /api/sandbox/*) odizolowaną
 * od głównego pipeline'u /lab. Eksperymenty tutaj nie dotykają bazy sesji
 * ani agentów produkcyjnych.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  // Wczytaj wersję z package.json (tylko do odczytu, nie modyfikuje runtime'u)
  let version = '0.0.0'
  let name = 'genlab'
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    version = pkg.version ?? version
    name = pkg.name ?? name
  } catch {
    // ignore — fallback
  }

  const experiments = [
    {
      id: 'graph3d',
      title: 'Graf genów 3D (three.js)',
      description:
        'Interaktywna 3D wizualizacja grafu fuzji genów z three.js + WebGL. Bloom postprocessing, force-directed 3D, OrbitControls. Dane z /api/explore/fusions.',
      status: 'active',
      category: 'ui',
      href: '/sandbox/graph3d',
      inspirations: [
        'jonobr1/force-directed-graph',
        'salonyranjan/neural-portfolio',
        'cdeust/neural-graph-visualizer',
        'ahilbig/three-graph-modeller',
      ],
    },
    {
      id: 'prompt-lab',
      title: 'Prompt Lab',
      description:
        'Eksperymentalny edytor promptów z live podglądem tokenów i side-by-side diff poprzednich wersji.',
      status: 'planned',
      category: 'ui',
    },
    {
      id: 'gene-sim',
      title: 'Gene Similarity Sandbox',
      description:
        'Wektorowa symilarność genów — obliczona offline, bez zapisu do bazy. Test algorytmu zanim wejdzie do /explore.',
      status: 'planned',
      category: 'analysis',
    },
    {
      id: 'ahi-sim',
      title: 'AHI Simulator',
      description:
        'Manualna symulacja AHI dla dowolnej kombinacji licencji/README/architektury — test scoringu bez pipeline.',
      status: 'planned',
      category: 'analysis',
    },
    {
      id: 'fusion-forge',
      title: 'Fusion Forge',
      description:
        'Ręczne budowanie fuzji genów z grafu — drag-and-drop węzłów, preview wynalazku przed uruchomieniem agenta.',
      status: 'planned',
      category: 'synthesis',
    },
    {
      id: 'patent-draft',
      title: 'Patent Draft Playground',
      description:
        'Sandbox dla Patent Composera — edytowalny szablon claimów, live preview PDF bez zapisu sesji.',
      status: 'planned',
      category: 'output',
    },
    {
      id: 'import-sim',
      title: 'Import Simulator',
      description:
        'Symulacja importu zewnętrznego repo jako genu — walidacja metadanych bez zapisu do DB.',
      status: 'planned',
      category: 'input',
    },
  ]

  return NextResponse.json({
    name,
    version,
    sandboxEnabled: true,
    sandboxVersion: '0.3.0-sandbox',
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
    experiments,
    activeCount: experiments.filter((e) => e.status === 'active').length,
    plannedCount: experiments.filter((e) => e.status === 'planned').length,
    isolation: {
      database: 'read-only / no-writes',
      agents: 'not invoked',
      sessionsTable: 'untouched',
      notes:
        'Sandbox operates on copies/in-memory data only. No mutations to GenLab production state.',
    },
  })
}
