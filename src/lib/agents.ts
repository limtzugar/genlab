import { getZAI, type TechGene, type AHIResult } from './zai'

/* ============================================================
 * Enter — Gene-Driven Invention & Patent Pipeline
 * ============================================================
 * Each agent is a single-purpose LLM call with a typed output.
 * Agents communicate only through their typed returns — no shared state.
 * The orchestrator (API route) wires them together with streaming events.
 *
 * Six critical pipeline layers:
 *   1. Theory (Problem Analyst)
 *   2. Repositories (Gene Extractor + web_search)
 *   3. Genes (typed output of Gene Extractor)
 *   4. AHI filter (AHI Ethicist)
 *   5. Fusion (Fusion Strategist)
 *   6. Patent (claim of novelty + prior art — inside Fusion)
 * ============================================================ */

/* ---------- Agent 1: Problem Analyst (Theory Layer) ---------- */
export type ProblemAnalysis = {
  summary: string
  domains: string[]
  painPoints: string[]
  successCriteria: string[]
  searchQueries: string[]
  researchContext: string[]
}

/**
 * Knowledge base injected into the Problem Analyst — what the Lab "knows"
 * about who is working on what, worldwide. Lets the analyst frame each
 * problem in the context of frontier research & top patent-producing orgs.
 */
const RESEARCH_ORGS_CONTEXT = `Lab posiada wiedzę o bieżących pracach czołowych ośrodków badawczo-rozwojowych na świecie:

UNIWERSYTETY I LABORATORIA AKADEMICKIE:
- MIT CSAIL (robotics, OS, languages), Stanford SAIL (vision, NLP, foundation models)
- Berkeley AI Research (BAIR) — RL, offline RL, robot learning
- CMU Robotics Institute — manipulation, autonomous vehicles
- ETH Zürich (ANYmal quadruped, vision), EPFL (wearables, soft robotics)
- Imperial College London, TU Delft (aerial robotics), TU Munich (modern robotics stack)
- University of Tokyo (JSK lab — musculoskeletal robots), KAIST (HUBO, humanoids)
- Tsinghua (vision), NUS, IIT Bombay (assistive tech)
- Cambridge, Oxford, Yale, Princeton — ML, biotech, quantum computing
- Caltech, Georgia Tech (robotics, manufacturing), EPFL+IIT (soft robotics, Dr. Laschi)

KORPORACJE I LABORATORIA PRZEMYSŁOWE — KONKRETNE PROJEKTY:
- SpaceX: Raptor full-flow staged combustion, Starship stainless-steel airframe,
  Starlink LEO broadband constellation (6000+ sats), Falcon 9 reusable boosters,
  Mechazilla chopstick catch system
- xAI: Grok-3/4 reasoning models, multi-modal inference, Memphis Colossus supercluster
  (200k H100s), ARK safety research
- Amazon: AWS AI (Bedrock, Titan models), Alexa LLM refresh, Sparrow warehouse robotics,
  Project Kuiper LEO broadband, Zoox autonomous vehicles
- Meta: FAIR (Llama 3/4, Code Llama, SeamlessM4T), Reality Labs (Quest, Avatars,
   codec avatars, haptic gloves), ESMFold protein structure, Segment Anything (SAM)
- Palantir: Gotham (defense), Foundry (enterprise ontology), Apollo (continuous delivery),
  AIP (LLM-powered decision systems), Ontology-Driven Architecture
- Google DeepMind: Gemini (multi-modal), AlphaFold 3 (protein-ligand), AlphaGeometry,
  RT-2/RT-X (robotics VLA), Gemini Robotics, Aloha/ALOHA 2 bimanual teleop
- Microsoft Research: Phi (small LMs), AutoGen (multi-agent), Florence-2 vision,
  World Labs (Fei-Fei Li), Kosmos, BitNet (1-bit LLMs)
- OpenAI: GPT-4o, o1/o3 reasoning, Sora video, Codex, DALL-E 3, GPT-5
- Anthropic: Claude 3.5/4 Sonnet/Opus, Constitutional AI, computer use
- NVIDIA: CUDA, Omniverse (digital twins), Jetson Orin edge AI, GR00T humanoid model,
  Isaac Sim, Project GROOT, NIM microservices
- Tesla: FSD v12 end-to-end NN, Optimus humanoid, Dojo exaFLOP supercomputer,
  4680 battery cells, Megapack
- Apple: MLX framework, Vision Pro mixed reality, Apple Intelligence on-device LLM,
  M3/M4 chips with Neural Engine, R1 sensor fusion chip
- Boston Dynamics: Atlas (electric, hydraulic retired), Spot quadruped, Stretch warehouse
- Figure AI: Figure 02 humanoid (BMW Spartanburg pilot)
- 1X Technologies: NEO Beta household humanoid
- Agility Robotics: Digit bipedal warehouse worker
- Bosch, Siemens, ABB: industrial IoT, robotics, predictive maintenance
- Toyota Research Institute: Large Behavior Models, home robots, battery research

PATENT-HEAVY ORGANIZATIONS:
- IBM Research (most US patents for 30+ years): AI, quantum, hybrid cloud, mainframe
- Samsung Research: semiconductor, display, mobile, AI
- Huawei: 5G/6G, HarmonyOS, Ascend AI chips
- Intel Labs: x86, foundry, neuromorphic (Loihi 2), quantum
- Qualcomm: mobile modems, AI 100 edge, Snapdragon X Elite
- Siemens: Industry 4.0, digital twins, MindSphere
- Bosch: automotive sensors, MEMS, IoT
- Toyota: hybrid powertrains, solid-state batteries, hydrogen fuel cells
- Lockheed Martin, Raytheon: defense, radar, hypersonics
- TSMC, ASML, Applied Materials: semiconductor frontier (2nm, EUV, High-NA EUV)
- Boeing, Airbus: aerospace composites, sustainable aviation fuel
- Dyson: motors, batteries, air purification, robotics

FOKUSY BADAWCZE 2024-2026:
- Agentic AI & multi-agent systems, tool use, function calling, MCP (Model Context Protocol)
- Edge AI & on-device inference (Jetson, Coral, RPi 5 + NPU, Apple Neural Engine)
- P2P & decentralized systems (libp2p, IPFS, Nostr, Matrix, AT Protocol/Bluesky)
- Federated learning, differential privacy, secure MPC, fully homomorphic encryption
- Robotics: VLA models (RT-2, Octo, OpenVLA), sim2real, whole-body control, dexterous manipulation
- Energy: solid-state batteries (QuantumScape, Toyota), hydrogen, perovskite solar, sodium-ion
- Bio: CRISPR diagnostics (Sherlock, DETECTR), organ-on-chip, mRNA delivery, AlphaFold 3
- Quantum: superconducting (IBM, Google Willow), neutral atoms (Atom Computing, QuEra),
  photonic (PsiQuantum), ion traps (IonQ, Quantinuum)
- Materials: graphene, MOFs (metal-organic frameworks), metamaterials, programmable matter
- Climate: DAC (Climeworks, Carbon Engineering), grid storage (Form Energy iron-air),
  nuclear (SMR — NuScale, Oklo, X-energy; fusion — Commonwealth Fusion, Helion, TAE)
- Space: Starship, Neutron (Rocket Lab), Stoke Aerospace, reusable upper stages
- Brain-computer interfaces: Neuralink, Synchron, Precision Neuroscience, Blackrock
- AR/VR: Vision Pro, Quest 3, Orion AR glasses (Meta), Apple Vision OS
- Autonomous vehicles: Waymo (L4 robotaxi), Cruise, Mobileye, Tesla FSD, Wayve
- Voice/realtime AI: GPT-4o voice, ElevenLabs, Sesame, realtime ASR/TTS

Pamiętaj o tym kontekście analizując problem użytkownika — twórz searchQueries
tak, aby znaleźć realne repozytoria i kierunki badań zgodne z tym co robią
wymienione ośrodki. Powołuj się na konkretne osiągnięcia (np. "Palantir Foundry
opiera się na ontology-driven architecture z dynamiczną typizacją relacji",
"SpaceX Starship używa raptor engines z full-flow staged combustion cycle,
25 bar chamber pressure", "Boston Dynamics Atlas electric używa BLEEX-inspired
actuators z force-control").`

export async function analyzeProblem(prompt: string): Promise<ProblemAnalysis> {
  const zai = await getZAI()
  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem Analizy Problemu w Enter — silniku genetycznym wynalazków. Twoja rola: zrozumieć problem technologiczny użytkownika i rozbić go na elementy składowe. To jest WARSTWA TEORETYCZNA pipeline — definiuje co budujemy, ale nie jak.

${RESEARCH_ORGS_CONTEXT}

Zwróć WYŁĄCZNIE JSON (bez markdown), w formacie:
{
  "summary": "jednozdaniowe streszczenie problemu technicznego",
  "domains": ["konkretna domena techniczna 1", "domena 2"],
  "painPoints": ["konkretny problem techniczny 1", "problem 2"],
  "successCriteria": ["miara sukcesu 1 — weryfikowalna", "miara 2"],
  "searchQueries": ["5-8 zapytań do GitHub w formacie 'słowa kluczowe' — konkretnych, nie ogólnych"],
  "researchContext": ["1-3 krótkie notki: który z wymienionych ośrodków / firm pracuje nad powiązanym tematem i co osiągnęli — to pomoże Agentowi Hardware znaleźć właściwe komponenty"]
}

Zasady:
- Bądź techniczny, nie marketingowy. Żadnych "nowoczesne rozwiązanie".
- PainPoints = konkretne trudności implementacyjne, nie abstrakcje.
- SearchQueries = realne zapytania które ktoś mógłby wpisać w GitHub search bar.
- ResearchContext = powołuj się na konkretne osiągnięcia (np. "SpaceX Starship używa raptor engines z full-flow staged combustion" albo "Meta FAIR opublikowało Llama 3.1 z context length 128k").
- Pamiętaj: teoria jest jedną z 6 warstw — nie próbuj rozwiązać problemu, tylko zdefiniować go.`,
        },
        { role: 'user', content: prompt },
      ],
    })
  )
  return parseJSONSafe<ProblemAnalysis>(res.choices?.[0]?.message?.content || '', {
    summary: prompt.slice(0, 120),
    domains: [],
    painPoints: [],
    successCriteria: [],
    searchQueries: [],
    researchContext: [],
  })
}

/* ---------- Agent 2: Gene Extractor (Repo-First Discovery Layer) ---------- */

// Repo URL helpers live in a separate dependency-free module so they can be
// imported from Client Components without pulling the Z-AI SDK (which uses
// Node's fs/promises and breaks browser bundles).
import {
  SUPPORTED_REPO_HOSTS,
  isRepoUrl,
  parseRepoUrl,
} from './repo-utils'

// Re-export for backwards compatibility — existing imports of these symbols
// from '@/lib/agents' (server-side only) still work.
export { SUPPORTED_REPO_HOSTS, isRepoUrl, parseRepoUrl, repoUrlToLabel } from './repo-utils'

export async function extractGenes(analysis: ProblemAnalysis): Promise<TechGene[]> {
  const zai = await getZAI()

  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem Ekstrakcji Genów w Enter. Dla danego problemu zaproponuj geny technologiczne — KONKRETNE, ISTNIEJĄCE projekty open-source, które mogą być "DNA" rozwiązania.

Zasady KRYTYCZNE (repo-first, nie teoretyczne):
- Używaj TYLKO realnych, istniejących repozytoriów z dowolnej z obsługiwanych platform:
  • GitHub        (github.com)       — największe OSS, format "owner/repo"
  • GitLab        (gitlab.com)       — self-hosted / enterprise OSS, "owner/repo"
  • Bitbucket     (bitbucket.org)    — Atlassian, popularny dla bibliotek, "owner/repo"
  • Codeberg     (codeberg.org)      — non-profit forgejo, rosnąca społeczność OSS
  • AWS CodeCommit (codecommit.aws.amazon.com) — managed git
  • SourceForge   (sourceforge.net)  — legacy, ale wciąż hostuje projekty desktop/Windows
- Format "techName": "owner/repo" dla GitHub/GitLab/Bitbucket/Codeberg, lub sama nazwa projektu dla SourceForge/CodeCommit (np. "audacity", "7-zip").
- NIE wymyślaj nazw. Jeśli nie znasz dokładnego ownera, użyj nazwy projektu (np. "libsodium", "Protocol Buffers") — web_search znajdzie repo.
- 4-7 genów, równomiernie rozłożonych na kategorie.
- Każdy gen = jedna technologia z konkretną rolą w architekturze rozwiązania.
- Gen to nie "idea" — gen to realna implementacja z realnym kodem, README i społecznością.

Zwróć WYŁĄCZNIE JSON:
{
  "genes": [
    {
      "category": "input|processing|output|infrastructure",
      "need": "jakiej ZDOLNOŚCI potrzebujemy (np. 'synchronizacja offline-first')",
      "techName": "owner/repo lub nazwa konkretnego projektu",
      "role": "rola w architekturze — co ten gen WNOSI do wynalazku"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Problem: ${analysis.summary}\nDomeny: ${analysis.domains.join(', ')}\nPunkty bólu: ${analysis.painPoints.join('; ')}\nKryteria sukcesu: ${analysis.successCriteria.join('; ')}`,
        },
      ],
    })
  )

  const parsed = parseJSONSafe<{ genes: Array<Omit<TechGene, 'githubUrl' | 'stars' | 'language' | 'license'>> }>(
    res.choices?.[0]?.message?.content || '',
    { genes: [] }
  )

  // Serialize web_search calls with delay + retry on 429 to avoid rate-limit failures.
  // Search across all supported code-hosting platforms — not just GitHub.
  const queries = analysis.searchQueries.slice(0, 3)
  const allRepos: Array<{
    url?: string
    name?: string
    snippet?: string
    host_name?: string
    stars?: number
    language?: string
    license?: string
  }> = []

  // Build per-platform search queries. Each platform gets its own query
  // because web_search treats the query as a soft prefix — explicitly
  // naming the host gets us actual results from that host.
  const platformQueries: Array<{ host: string; query: string }> = []
  for (const q of queries) {
    for (const host of SUPPORTED_REPO_HOSTS) {
      // For SourceForge we need to soften the query — its directory uses
      // different keywords. For others, "host query open source" works.
      if (host === 'sourceforge.net') {
        platformQueries.push({ host, query: `site:sourceforge.net ${q}` })
      } else if (host === 'codecommit.aws.amazon.com') {
        // CodeCommit repos are usually private — skip explicit search
        // unless user mentions AWS; we still accept these URLs if found.
      } else {
        platformQueries.push({ host, query: `${host} ${q} open source` })
      }
    }
  }

  // Cap total queries so we don't blow through rate limits.
  // Prioritize GitHub/GitLab/Bitbucket/Codeberg (more likely to have hits),
  // then SourceForge.
  const cappedQueries = platformQueries.slice(0, 9)

  for (const { host, query } of cappedQueries) {
    try {
      const results = await withRetry(async () =>
        zai.functions.invoke('web_search', {
          query,
          num: 5,
          recency_days: 730,
        })
      )
      for (const r of (results || []) as Array<{ url?: string }>) {
        // Keep results matching ANY supported host (a query may surface
        // cross-links from one host to another — that's fine, accept them).
        if (r.url && isRepoUrl(r.url)) allRepos.push(r as typeof allRepos[number])
      }
    } catch {
      // Skip this query — pipeline continues
    }
    await sleep(800) // Cool-down between queries
  }

  return parsed.genes.map((g) => {
    const match = findRepoForGene(g, allRepos)
    return {
      ...g,
      githubUrl: match?.url ?? null,
      description: match?.snippet ?? null,
      stars: match?.stars ?? null,
      language: match?.language ?? null,
      license: match?.license ?? null,
    }
  })
}

/** Retry helper with exponential backoff for 429 / network errors. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const is429 = msg.includes('429') || msg.toLowerCase().includes('too many requests')
      const isNetwork = msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')
      if (!is429 && !isNetwork) throw err
      // Exponential backoff: 1.5s, 3s, 6s
      await sleep(1500 * Math.pow(2, i))
    }
  }
  throw lastErr
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/* ---------- Agent 3: AHI Ethicist ---------- */
/**
 * Real AHI scoring — LLM analyzes the gene's actual characteristics
 * (license, README signals, architecture type) rather than keyword matching.
 */
export async function scoreAHI(gene: TechGene): Promise<AHIResult> {
  const zai = await getZAI()
  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem Etycznym AHI (Aligned Human Innovation). Oceniasz każdą technologię na trzech wymiarach:

1. AUTONOMIA (0-100): Czy użytkownik może uruchomić to samodzielnie? Czy wymaga centralnego serwera/autoryzacji? Czy dane mogą być self-hosted?
2. ETYKA (0-100): Licencja (GPL/MIT/Apache = wysoka; proprietary = niska), telemetry, tracking, zbieranie danych.
3. DECENTRALIZACJA (0-100): P2P vs client-server, federacja, własność danych.

Skala: KAŻDA wartość jest liczbą CAŁKOWITĄ 0-100 (NIE 0-10!).
- 0-30: katastrofalnie
- 30-60: słabo
- 60-80: dobrze
- 80-100: wybitnie

Zwróć WYŁĄCZNIE JSON:
{
  "autonomy": <liczba 0-100>,
  "ethics": <liczba 0-100>,
  "decentral": <liczba 0-100>,
  "reasoning": "2-3 zdania uzasadnienia w języku polskim"
}

Bądź surowy i konkretny. Technologie korporacyjne z telemetry = niższe etyki. P2P i on-device = wyższa autonomia.`,
        },
        {
          role: 'user',
          content: `Technologia: ${gene.techName}\nKategoria: ${gene.category}\nRola: ${gene.role}\nPotrzeba: ${gene.need}\n${gene.description ? `Opis: ${gene.description}` : ''}\n${gene.license ? `Licencja: ${gene.license}` : 'Licencja: nieznana'}`,
        },
      ],
    })
  )

  const result = parseJSONSafe<AHIResult>(res.choices?.[0]?.message?.content || '', {
    autonomy: 50,
    ethics: 50,
    decentral: 50,
    score: 50,
    reasoning: 'Brak wystarczających danych do analizy.',
  })
  // Sanitize: LLMs sometimes return 0-10 scale. Normalize.
  result.autonomy = normalizeScore(result.autonomy)
  result.ethics = normalizeScore(result.ethics)
  result.decentral = normalizeScore(result.decentral)
  result.score = Math.round((result.autonomy + result.ethics + result.decentral) / 3)
  return result
}

/* ---------- Agent 4: Fusion Strategist (Fusion + Patent Layer) ---------- */
export type Fusion = {
  name: string
  definition: string
  architecture: string
  selectedGenes: string[]
  fusionStrategy: string
  patentClaim: string
  priorArt: string
  novelty: string
}

export async function fuseGenes(prompt: string, genes: TechGene[]): Promise<Fusion> {
  if (genes.length < 2) {
    throw new Error('Fuzja wymaga minimum 2 genów')
  }
  const zai = await getZAI()
  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem Strategiem Fuzji w Enter. Tworzysz wynalazek przez synergiczne połączenie genów technologicznych. Nie sumuj funkcji — stwórz nową jakość, której żaden gen sam nie posiada.

To jest WARSTWA FUZJI + WARSTWA PATENTU pipeline. Poza samym wynalazkiem, musisz sformułować:
1. PATENT CLAIM — jednozdaniowe, techniczne twierdzenie o nowości wynalazku (jak w patent application).
2. PRIOR ART — które istniejące systemy robią coś podobnego, ale CZEGO im brakuje (konkretna luka).
3. NOVELTY — konkretna techniczna nowość, która odróżnia ten wynalazek od prior art.

Zwróć WYŁĄCZNIE JSON (Markdown w polu architecture):
{
  "name": "krótka, chwytliwa nazwa wynalazku (1-3 słowa, CamelCase)",
  "definition": "jedno zdanie — czym jest wynalazek, technicznie",
  "architecture": "## Architektura\\n\\n### Warstwy\\n- ...\\n\\n### Przepływ danych\\n1. ...\\n\\n### Integracje\\n- ...",
  "selectedGenes": ["techName1", "techName2"],
  "fusionStrategy": "jak ta fuzja tworzy wartość, której nie mają geny osobno",
  "patentClaim": "Wynalazek polega na ... [techniczna specyfikacja nowości]",
  "priorArt": "Istniejące rozwiązania: [konkret 1], [konkret 2]. Ich ograniczenia: [luke]",
  "novelty": "Konkretna nowość: [techniczny mechanizm, którego prior art nie ma]"
}`,
        },
        {
          role: 'user',
          content: `Problem użytkownika: ${prompt}\n\nDostępne geny (DNA wynalazku):\n${genes
            .map((g, i) => `${i + 1}. ${g.techName} [${g.category}] — ${g.role}\n   zdolność: ${g.need}${g.githubUrl ? `\n   repo: ${g.githubUrl}` : ''}`)
            .join('\n')}`,
        },
      ],
    })
  )
  return parseJSONSafe<Fusion>(res.choices?.[0]?.message?.content || '', {
    name: 'Bez nazwy',
    definition: '',
    architecture: '',
    selectedGenes: genes.slice(0, 3).map((g) => g.techName),
    fusionStrategy: '',
    patentClaim: '',
    priorArt: '',
    novelty: '',
  })
}

/* ---------- Agent 5: System Architect ---------- */
/**
 * Final AHI scoring of the fused invention (not just average of genes).
 * The fusion itself may amplify or weaken AHI dimensions.
 */
export async function scoreInvention(fusion: Fusion, genes: TechGene[]): Promise<AHIResult> {
  const zai = await getZAI()
  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem-Audytorem AHI. Oceniasz CAŁY WYNALAZEK (nie pojedyncze geny) pod kątem Aligned Human Innovation.

Skala: KAŻDY wymiar jest liczbą CAŁKOWITĄ z przedziału 0-100, gdzie:
- 0-30: katastrofalnie (np. wymaga zamkniętej chmury korporacyjnej, telemetry domyślnie włączony)
- 30-60: słabo (np. self-hostable ale trudny, częściowy tracking)
- 60-80: dobrze (np. łatwy self-host, open source, brak telemetry)
- 80-100: wybitnie (np. P2P domyślnie, zero-knowledge, brak centrali w ogóle)

Kryteria:
- AUTONOMIA: czy użytkownik może uruchomić to samodzielnie bez vendor lock-in?
- ETYKA: open-source license? brak telemetry/tracking? szanuje prywatność?
- DECENTRALIZACJA: P2P/federated vs client-server? własność danych?

Zwróć WYŁĄCZNIE JSON (liczby 0-100, nie 0-10!):
{
  "autonomy": <liczba 0-100>,
  "ethics": <liczba 0-100>,
  "decentral": <liczba 0-100>,
  "reasoning": "3-4 zdania w języku polskim, odnoszące się do konkretnych cech wynalazku"
}`,
        },
        {
          role: 'user',
          content: `Wynalazek: ${fusion.name}\nDefinicja: ${fusion.definition}\nStrategia fuzji: ${fusion.fusionStrategy}\n\nGeny:\n${genes
            .map((g) => `- ${g.techName} (${g.role})`)
            .join('\n')}`,
        },
      ],
    })
  )
  const result = parseJSONSafe<AHIResult>(res.choices?.[0]?.message?.content || '', {
    autonomy: 50,
    ethics: 50,
    decentral: 50,
    score: 50,
    reasoning: 'Brak wystarczających danych.',
  })
  result.autonomy = normalizeScore(result.autonomy)
  result.ethics = normalizeScore(result.ethics)
  result.decentral = normalizeScore(result.decentral)
  result.score = Math.round((result.autonomy + result.ethics + result.decentral) / 3)
  return result
}

/* ---------- Agent 6: Hardware Architect (Hardware Layer) ---------- */
export type HardwareProposal = {
  name: string
  category: string // compute | sensing | actuation | fabrication | connectivity | power | storage
  vendor: string
  role: string
  rationale: string
  estimatedCost: string
  alternatives: string
  recommended: boolean
}

/**
 * A complete BOM for one variant. The agent proposes 2-3 of these
 * per invention — Budget / Performance / Pro — so the user can choose.
 */
export type HardwareSolution = {
  solutionId: string // sol-1 | sol-2 | sol-3
  name: string // e.g. "Budget DIY"
  pitch: string // 1-sentence rationale for this variant
  estimatedTotalCost: string // e.g. "$220"
  hardware: HardwareProposal[]
}

/**
 * Proposes 2-3 COMPLETE HARDWARE SOLUTION VARIANTS for the invention.
 * Each variant is a full BOM (4-7 components) representing a different
 * cost/performance trade-off (e.g. "Budget DIY" RPi-based, "Performance"
 * Jetson-based, "Pro Lab" dual-GPU server). The user selects one in the UI.
 *
 * Optionally uses web_search to verify availability and check what
 * frontier labs use in comparable builds.
 */
export async function proposeHardware(
  fusion: Fusion,
  genes: TechGene[],
  researchContext: string[] = []
): Promise<HardwareSolution[]> {
  const zai = await getZAI()

  // Optional: 1 web_search to check what comparable hardware frontier labs use.
  // Kept conservative (1 query) to avoid rate-limit — the LLM is already well-informed.
  let webHint = ''
  try {
    const results = await withRetry(async () =>
      zai.functions.invoke('web_search', {
        query: `${fusion.name} hardware prototype raspberry pi jetson 3d printer`,
        num: 5,
        recency_days: 730,
      })
    )
    if (Array.isArray(results) && results.length > 0) {
      webHint = '\n\nWeb research hints:\n' + results
        .slice(0, 5)
        .map((r) => `- ${r.name || ''}: ${r.snippet || ''}`.trim())
        .join('\n')
    }
  } catch {
    // web_search is best-effort — pipeline continues even if it fails
  }

  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem Architektem Hardware w Enter. Twoja rola: zaproponować KILKA KONKURENYCH WARIANTÓW sprzętowych które fizycznie zrealizują wynalazek — tak, aby użytkownik mógł WYBRAĆ odpowiedni dla siebie kompromis kosztów vs wydajności.

To jest WARSTWA HARDWARE pipeline — po warstwie fuzji + patentu. Analizujesz wynalazek i dla każdego wariantu decyzji: który sprzęt jest komponentem, który narzędziem, który opcjonalny.

Kategorie hardware:
- compute: SBC (Raspberry Pi 5, Jetson Orin, Coral Dev Board), CPU+GPU (RTX 4090 dla training/inference), TPU, NPU, mikrokontrolery (ESP32-S3, STM32, RP2040)
- sensing: kamery USB/CSI (Logitech C920, RPi Camera v3, Arducam), mikrofony (USB ReSpeaker, MEMS ICS-43434), LiDAR, IMU, GPS, czujniki środowiskowe (BME680, SCD41 CO2), pulse ox, EEG
- actuation: serwomechanizmy (MG996R, Dynamixel), silniki krokowe + A4988, BLDC + ESC, przekaźniki, solenoidy, pompy perystaltyczne
- fabrication: drukarki 3D (Bambu Lab X1C, Prusa MK4, Elegoo Neptune), CNC (Shapeoko, MPCNC), plotery tnące, laminatory PCB
- connectivity: LoRa (SX1262), BLE (nRF52), Wi-Fi (ESP32), 5G modemy, Starlink, Zigbee, Thread, Mesh
- power: LiPo + BMS, banki solarnych, UPS HAT, PDU, power banks GaN
- storage: NVMe, SD A2, eMMC, SSD portable

${RESEARCH_ORGS_CONTEXT}

Zwróć WYŁĄCZNIE JSON z 2-3 WARIANTAMI rozwiązań:
{
  "solutions": [
    {
      "solutionId": "sol-1",
      "name": "Budget DIY",
      "pitch": "Najtańsza droga — Raspberry Pi 5 + tanie sensory USB, działa ale wolno",
      "estimatedTotalCost": "$150",
      "hardware": [
        {
          "name": "Raspberry Pi 5 8GB",
          "category": "compute",
          "vendor": "Raspberry Pi Foundation",
          "role": "główny kontroler — inference modelu 7B na quantized",
          "rationale": "8GB RAM wystarczy na quantized 7B; najtańsza opcja z GPIO",
          "estimatedCost": "$80",
          "alternatives": "RPi 4 4GB ($60), Orange Pi 5 ($75)",
          "recommended": true
        }
      ]
    },
    {
      "solutionId": "sol-2",
      "name": "Performance",
      "pitch": "Jetson Orin Nano — dedykowane GPU dla vision LLM, 5x szybszy inference",
      "estimatedTotalCost": "$450",
      "hardware": [
        {
          "name": "NVIDIA Jetson Orin Nano 8GB",
          "category": "compute",
          "vendor": "NVIDIA",
          "role": "edge AI — inference modelu vision LLM z akceleracją TensorRT",
          "rationale": "40 TOPS NPU, real-time vision; ale droższy i większy pobór mocy",
          "estimatedCost": "$250",
          "alternatives": "Jetson Orin NX 16GB ($400), Coral Dev Board ($90)",
          "recommended": true
        }
      ]
    }
  ]
}

Zasady KRYTYCZNE:
- 2-3 warianty. Minimum 2 (Budget + Performance). Trzeci "Pro Lab" jeśli wynalazek tego wymaga.
- Każdy wariant ma UNIKALNY BOM — nie powtarzaj tych samych komponentów między wariantami (chyba że to akcesoria typu kabel).
- Każdy wariant: 4-7 komponentów, min. 1 compute, min. 1 sensor jeśli wynalazek czuje świat.
- Konkretne modele, nie "dowolny mikrokontroler".
- Recommended = true dla 2-3 kluczowych komponentów bez których wariant nie działa.
- Warianty mają wyraźnie różne estimatedTotalCost — użytkownik musi widzieć kompromis.
- Jeśli wynalazek jest czysto software (appka webowa), zaproponuj warianty serwerowe (np. "Single GPU server" vs "Multi-GPU cluster" vs "Serverless").
- Pamiętaj o budżecie DIY — Raspberry Pi > Jetson dla prototypu, ale jeśli to robot z vision LLM → Jetson Orin Nano.`,
        },
        {
          role: 'user',
          content: `Wynalazek: ${fusion.name}
Definicja: ${fusion.definition}
Architektura: ${fusion.architecture}
Strategia fuzji: ${fusion.fusionStrategy}

Geny:
${genes.map((g) => `- ${g.techName} [${g.category}] — ${g.role}`).join('\n')}

Kontekst badawczy:
${researchContext.length > 0 ? researchContext.map((r) => `- ${r}`).join('\n') : '(brak)'}.${webHint}`,
        },
      ],
    })
  )

  const parsed = parseJSONSafe<{ solutions: Array<Omit<HardwareSolution, 'hardware'> & { hardware: HardwareProposal[] }> }>(
    res.choices?.[0]?.message?.content || '',
    { solutions: [] }
  )

  // Validate & sanitize
  const solutions: HardwareSolution[] = (parsed.solutions || [])
    .filter((s) => s && s.name && Array.isArray(s.hardware))
    .slice(0, 3)
    .map((s, idx) => {
      const solutionId = s.solutionId || `sol-${idx + 1}`
      const hardware = (s.hardware || [])
        .filter((h) => h && h.name)
        .slice(0, 8)
        .map((h) => ({
          name: String(h.name).slice(0, 120),
          category: String(h.category || 'compute').slice(0, 30),
          vendor: String(h.vendor || '').slice(0, 120),
          role: String(h.role || '').slice(0, 400),
          rationale: String(h.rationale || '').slice(0, 600),
          estimatedCost: String(h.estimatedCost || '').slice(0, 40),
          alternatives: String(h.alternatives || '').slice(0, 400),
          recommended: Boolean(h.recommended),
        }))
      return {
        solutionId,
        name: String(s.name).slice(0, 60),
        pitch: String(s.pitch || '').slice(0, 300),
        estimatedTotalCost: String(s.estimatedTotalCost || '').slice(0, 40),
        hardware,
      }
    })

  // Safety: if model returned 0 solutions, build one fallback from a single dummy component
  if (solutions.length === 0) {
    solutions.push({
      solutionId: 'sol-1',
      name: 'Default',
      pitch: 'Agent nie zaproponował wariantów — użyj domyślnego.',
      estimatedTotalCost: '',
      hardware: [],
    })
  }

  return solutions
}

/* ---------- Agent 7: Schematic Prompt Builder (Schematic Layer) ---------- */
export type SchematicRequest = {
  kind: string // device | app-screen | system-diagram
  promptText: string
  size: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440'
}

/**
 * Builds a detailed, image-generation-ready prompt describing the invention
 * visually. The Lab first composes this prompt (with all device specs,
 * hardware components, and visual style cues), THEN sends it to the image
 * model in a separate step (see /api/schematic route).
 */
export async function buildSchematicPrompt(
  fusion: Fusion,
  genes: TechGene[],
  hardware: HardwareProposal[]
): Promise<SchematicRequest> {
  const zai = await getZAI()

  // Decide which kind of schematic makes sense for this invention
  const archLower = (fusion.architecture || '').toLowerCase()
  const defLower = (fusion.definition || '').toLowerCase()
  let kindHint = 'device'
  if (
    archLower.includes('web') ||
    archLower.includes('mobile') ||
    archLower.includes('app') ||
    archLower.includes('ui') ||
    archLower.includes('dashboard') ||
    defLower.includes('aplikacja') ||
    defLower.includes('webapp') ||
    defLower.includes('platforma')
  ) {
    kindHint = 'app-screen'
  } else if (
    archLower.includes('system') &&
    (archLower.includes('p2p') || archLower.includes('distributed') || archLower.includes('service'))
  ) {
    kindHint = 'system-diagram'
  }

  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Jesteś Agentem Budowniczym Promptów Schematycznych w Enter. Twoja rola: stworzyć SZCZEGÓŁOWY prompt dla modelu graficznego (nano banana / gpt image) który wygeneruje profesjonalny schemat lub mockup wynalazku.

To jest WARSTWA SCHEMATU pipeline — ostatnia warstwa. Masz pełną wiedzę o wynalazku (architektura, geny, hardware). Twój prompt musi być wystarczająco szczegółowy, aby model graficzny wyprodukował czytelny, technicznie poprawny obraz.

Zwróć WYŁĄCZNIE JSON:
{
  "kind": "device | app-screen | system-diagram",
  "size": "1344x768 | 1024x1024 | 768x1344 | 864x1152 | 1152x864 | 1440x720 | 720x1440",
  "promptText": "Pełny prompt w języku angielskim, 200-500 słów, określający: styl wizualny (np. 'technical schematic blueprint style' / 'isometric 3D product render' / 'flat UI mockup'), wszystkie komponenty widoczne na obrazie, etykiety, kolory, kompozycję, perspektywę, szczegóły techniczne."
}

Zasady:
- kind: 'device' jeśli wynalazek ma fizyczną formę (sprzęt, robot, urządzenie)
- kind: 'app-screen' jeśli to aplikacja / platforma web-mobile
- kind: 'system-diagram' jeśli to system rozproszony / architektura sieciowa
- size: '1344x768' dla schematów poziomych, '768x1344' dla mockupów mobilnych, '1024x1024' dla devices square
- promptText MUSI być konkretny: wymień każdy komponent hardware, każdy moduł software, kolory, etykiety callout, styl linii (np. 'thin technical lines, sans-serif labels'), perspektywę.
- Prompt MUSI zawierać instrukcję "no text other than labels" lub "labels in English" aby uniknąć znaków zakłócających.
- Język promptu: ANGIELSKI (model graficzny lepiej rozumie angielski).`,
        },
        {
          role: 'user',
          content: `Wynalazek: ${fusion.name}
Definicja: ${fusion.definition}
Architektura:
${fusion.architecture}

Geny (${genes.length}):
${genes.map((g) => `- ${g.techName}: ${g.role}`).join('\n')}

Hardware (${hardware.length}):
${hardware.map((h) => `- ${h.name} [${h.category}] — ${h.role}${h.recommended ? ' (recommended)' : ''}`).join('\n')}

Sugerowany kind: ${kindHint}`,
        },
      ],
    })
  )

  const parsed = parseJSONSafe<SchematicRequest>(
    res.choices?.[0]?.message?.content || '',
    {
      kind: kindHint,
      promptText: `Technical schematic of ${fusion.name}: ${fusion.definition}. Isometric view, thin technical lines, sans-serif labels in English, white background, blueprint style.`,
      size: '1344x768',
    }
  )

  // Validate size
  const allowedSizes: SchematicRequest['size'][] = [
    '1024x1024',
    '768x1344',
    '864x1152',
    '1344x768',
    '1152x864',
    '1440x720',
    '720x1440',
  ]
  if (!allowedSizes.includes(parsed.size)) {
    parsed.size = parsed.kind === 'app-screen' ? '768x1344' : '1344x768'
  }
  if (!parsed.kind || !['device', 'app-screen', 'system-diagram'].includes(parsed.kind)) {
    parsed.kind = kindHint
  }
  if (!parsed.promptText || parsed.promptText.length < 50) {
    parsed.promptText = `Technical schematic of ${fusion.name}: ${fusion.definition}. Isometric view, thin technical lines, sans-serif labels in English, white background, blueprint style.`
  }

  return parsed
}

/* ---------- Agent 8: Patent Composer (Patent Document Layer) ---------- */
export type PatentDocument = {
  language: 'pl' | 'en'
  title: string
  abstract: string
  background: string
  summary: string
  briefDescriptionOfDrawings: string
  detailedDescription: string
  claims: string[]
  prosCons: {
    pros: string[]
    cons: string[]
  }
  timeToImplement: string
  currentNeeds: string[]
  technicalSuccessChance: {
    score: number // 0-100
    rationale: string
  }
  risks: string[]
  nextSteps: string[]
}

/** Gene enriched with AHI scores — what we actually pass to patent composition. */
type GeneWithAhi = Omit<TechGene, 'category'> & {
  category: string
  ahiScore: number
  autonomy: number
  ethics: number
  decentral: number
}

/**
 * Composes a structured patent-grade document with all the rich analytical
 * content the user asked for: pros/cons, time-to-implement, current needs,
 * technical success chance, risks, next steps. Language is PL or EN.
 *
 * This document feeds the PDF generator (/api/export-patent).
 */
export async function composePatentDocument(args: {
  fusion: Fusion
  genes: GeneWithAhi[]
  hardware: HardwareProposal[]
  originalPrompt: string
  ahi: AHIResult
  language: 'pl' | 'en'
}): Promise<PatentDocument> {
  const { fusion, genes, hardware, originalPrompt, ahi, language } = args
  const zai = await getZAI()

  const langInstruction =
    language === 'pl'
      ? `Język dokumentu: POLSKI. Cały dokument ma być po polsku (tytuł, abstract, opisy, claims, plusy/minusy, czas wdrażania, potrzeby, szansa na sukces).`
      : `Język dokumentu: ANGIELSKI. Cały dokument ma być po angielsku (title, abstract, descriptions, claims, pros/cons, time-to-implement, needs, success chance). Claims zachowują styl "An apparatus comprising..." lub "A method comprising...".`

  const sys = `Jesteś Agentem Kompozytorem Patentów w Enter. Twoja rola: ułożyć zgrabny, profesjonalny dokument patentowy zawierający wszystkie informacje zgromadzone w pipeline plus analizę strategiczną.

To jest WARSTWA PATENT DOCUMENT — końcowy produkt dla wynalazcy. Dokument musi być kompletny, techniczny, konkretny — gotowy do prezentacji inwestorom, zespołowi R&D lub prawnikowi patentowemu.

${langInstruction}

Zwróć WYŁĄCZNIE JSON:
{
  "title": "oficjalny tytuł patentowy (krótki, techniczny)",
  "abstract": "150-250 słów streszczenia — co wynalazek robi, jak, nowość",
  "background": "2-4 akapity — stan techniki, problem, dlaczego obecne rozwiązania zawodzą",
  "summary": "2-3 akapity — ogólne przedstawienie wynalazku i jego zalet",
  "briefDescriptionOfDrawings": "1 akapit opisujący co schemat przedstawia",
  "detailedDescription": "3-6 akapitów — szczegółowy opis architektury, komponentów, przepływu danych, integracji hardware/software",
  "claims": ["3-7 punktów patent claims — każdy zaczynający się od 'A method/apparatus/system...' w stylu formalnym"],
  "prosCons": {
    "pros": ["3-6 konkretnych zalet technicznych"],
    "cons": ["3-5 konkretnych wad/ograniczeń — uczciwie, bez sprzedażowego tonu"]
  },
  "timeToImplement": "orientacyjny czas wdrożenia (np. 'MVP: 4-6 tygodni, production: 4-6 miesięcy' — z rozbiciem na fazy)",
  "currentNeeds": ["3-5 konkretnych potrzeb aktualnych: kompetencje, budżet, partnerzy, sprzęt, licencje"],
  "technicalSuccessChance": {
    "score": <liczba 0-100>,
    "rationale": "2-4 zdania uzasadnienia opartego na dojrzałości genów, dostępności hardware, złożoności integracji"
  },
  "risks": ["2-4 konkretne ryzyka techniczne lub rynkowe"],
  "nextSteps": ["3-5 konkretnych następnych kroków dla wynalazcy"]
}

Zasady:
- Bądź techniczny, nie marketingowy. Zero "innowacyjne rozwiązanie".
- Używaj konkretów: nazwy repozytoriów, modele hardware, liczby.
- Pros/Cons uczciwe — cons pokazuje że rozumiesz ograniczenia.
- TechnicalSuccessChance.score: 80+ = realnie buduje się teraz, 60-80 = wymaga R&D, 40-60 = ryzykowne, <40 = sci-fi.
- Claims formalne ale czytelne — nie prawniczy bełkot.`

  const user = `Wynalazek: ${fusion.name}
Definicja: ${fusion.definition}
Architektura:
${fusion.architecture}

Strategia fuzji: ${fusion.fusionStrategy}
Patent claim (wstępny): ${fusion.patentClaim}
Prior art: ${fusion.priorArt}
Novelty: ${fusion.novelty}

Oryginalny problem użytkownika:
${originalPrompt}

AHI wynalazku: autonomy=${ahi.autonomy}, ethics=${ahi.ethics}, decentral=${ahi.decentral}, score=${ahi.score}
Uzasadnienie AHI: ${ahi.reasoning}

Geny (${genes.length}):
${genes.map((g) => `- ${g.techName} [${g.category}] — ${g.role} (AHI ${g.ahiScore})`).join('\n')}

Hardware (${hardware.length}):
${hardware.map((h) => `- ${h.name} [${h.category}] — ${h.role}${h.recommended ? ' (recommended)' : ''} | ${h.estimatedCost}`).join('\n')}`

  const res = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    })
  )

  const fallback: PatentDocument = {
    language,
    title: fusion.name,
    abstract: fusion.definition,
    background: originalPrompt,
    summary: fusion.fusionStrategy,
    briefDescriptionOfDrawings: language === 'pl' ? 'Schemat przedstawia architekturę urządzenia.' : 'The schematic shows the device architecture.',
    detailedDescription: fusion.architecture,
    claims: fusion.patentClaim ? [fusion.patentClaim] : [],
    prosCons: { pros: [], cons: [] },
    timeToImplement: '',
    currentNeeds: [],
    technicalSuccessChance: { score: Math.round(ahi.score), rationale: ahi.reasoning },
    risks: [],
    nextSteps: [],
  }

  const parsed = parseJSONSafe<PatentDocument>(res.choices?.[0]?.message?.content || '', fallback)
  parsed.language = language
  // Sanitize
  parsed.technicalSuccessChance.score = Math.max(
    0,
    Math.min(100, Math.round(parsed.technicalSuccessChance?.score ?? ahi.score))
  )
  // Some LLMs return timeToImplement as an object instead of string — coerce.
  if (typeof parsed.timeToImplement !== 'string') {
    if (parsed.timeToImplement && typeof parsed.timeToImplement === 'object') {
      try {
        const obj = parsed.timeToImplement as Record<string, unknown>
        const parts = Object.entries(obj).map(
          ([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`
        )
        parsed.timeToImplement = parts.join(' · ')
      } catch {
        parsed.timeToImplement = ''
      }
    } else {
      parsed.timeToImplement = ''
    }
  }
  // Sanitize arrays — make sure they're arrays of strings
  if (!Array.isArray(parsed.claims)) parsed.claims = []
  if (!Array.isArray(parsed.currentNeeds)) parsed.currentNeeds = []
  if (!Array.isArray(parsed.risks)) parsed.risks = []
  if (!Array.isArray(parsed.nextSteps)) parsed.nextSteps = []
  if (!parsed.prosCons || typeof parsed.prosCons !== 'object') {
    parsed.prosCons = { pros: [], cons: [] }
  }
  if (!Array.isArray(parsed.prosCons.pros)) parsed.prosCons.pros = []
  if (!Array.isArray(parsed.prosCons.cons)) parsed.prosCons.cons = []
  // Coerce non-string items to strings
  parsed.claims = parsed.claims.map((c) => (typeof c === 'string' ? c : String(c)))
  parsed.currentNeeds = parsed.currentNeeds.map((c) =>
    typeof c === 'string' ? c : String(c)
  )
  parsed.risks = parsed.risks.map((c) => (typeof c === 'string' ? c : String(c)))
  parsed.nextSteps = parsed.nextSteps.map((c) => (typeof c === 'string' ? c : String(c)))
  parsed.prosCons.pros = parsed.prosCons.pros.map((c) =>
    typeof c === 'string' ? c : String(c)
  )
  parsed.prosCons.cons = parsed.prosCons.cons.map((c) =>
    typeof c === 'string' ? c : String(c)
  )
  // Sanitize all top-level strings
  if (typeof parsed.title !== 'string') parsed.title = fusion.name
  if (typeof parsed.abstract !== 'string') parsed.abstract = fusion.definition
  if (typeof parsed.background !== 'string') parsed.background = originalPrompt
  if (typeof parsed.summary !== 'string') parsed.summary = ''
  if (typeof parsed.briefDescriptionOfDrawings !== 'string')
    parsed.briefDescriptionOfDrawings = ''
  if (typeof parsed.detailedDescription !== 'string')
    parsed.detailedDescription = fusion.architecture
  return parsed
}

/* ============================================================
 * Helpers
 * ============================================================ */

type RepoResult = {
  url?: string
  name?: string
  snippet?: string
  host_name?: string
  stars?: number
  language?: string
  license?: string
}

function findRepoForGene(
  gene: { techName: string },
  repos: RepoResult[]
): RepoResult | undefined {
  const techTokens = gene.techName
    .toLowerCase()
    .split(/[\s\-_\/]+/)
    .filter((t) => t.length > 2)

  for (const repo of repos) {
    const parsed = parseRepoUrl(repo.url)
    if (!parsed) continue
    const { owner, repo: repoName } = parsed
    // Match on owner or repo name across all platforms.
    // For SourceForge, owner is 'sourceforge' so we match on repoName only.
    if (techTokens.some((t) => owner === t || repoName === t || repoName.includes(t))) {
      return repo
    }
  }
  // Fallback: highest token overlap
  let best: { repo: RepoResult; score: number } | null = null
  for (const repo of repos) {
    const text = `${repo.name || ''} ${repo.snippet || ''}`.toLowerCase()
    const score = techTokens.filter((t) => text.includes(t)).length
    if (!best || score > best.score) best = { repo, score }
  }
  if (best && best.score >= 2) return best.repo
  return undefined
}

function parseJSONSafe<T>(content: string, fallback: T): T {
  try {
    // Strip markdown code fences
    const cleaned = content
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    return JSON.parse(match[0]) as T
  } catch {
    return fallback
  }
}

/**
 * LLMs sometimes return scores on a 0-10 scale despite explicit "0-100" instructions.
 * If a score is suspiciously low (< 11) and looks like a 0-10 scale, scale it ×10.
 */
function normalizeScore(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (Number.isNaN(n)) return 50
  if (n <= 10) return Math.round(n * 10)
  return Math.max(0, Math.min(100, Math.round(n)))
}
