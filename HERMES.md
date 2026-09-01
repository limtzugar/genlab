# HERMES — GenLab local deployment brief

> Ten plik jest instrukcją dla agenta **Hermes** uruchamianego na PC użytkownika.
> Cel: rozpakować paczkę, podnieść GenLab lokalnie, komunikować się z API.

## 0. Szybki start (jedna komenda)

```bash
# Po rozpakowaniu paczki:
cd GenLab
bash scripts/hermes-start.sh          # dev server  → http://localhost:3000
# lub:
bash scripts/hermes-start.sh build    # prod build  → http://localhost:3000
```

Skrypt wykrywa `bun` → `pnpm` → `npm`, tworzy `.env`, instaluje deps, generuje Prisma client, startuje serwer.

## 1. Co to jest GenLab

GenLab to **gene-driven invention & patent pipeline** — laboratorium, które:
- Przyjmuje prompt problemu technicznego (`POST /api/invent`)
- Puszcza go przez **9-agentowy pipeline SSE** (Problem Analyst → Gene Extractor → AHI Ethicist → Fusion Strategist → System Architect → Hardware Architect → Schematic Prompt Builder → Patent Composer)
- Każdy "gen" to **realne repo GitHub** (repo-first, nie teoretyczne)
- Każdy wynalazek dostaje **AHI score** (Autonomy / Ethics / Decentralization) + patent framing (claim + prior art + novelty)
- Hardware phase: 2–3 warianty BOM per wynalazek (Budget DIY / Performance / Pro Lab)
- Sesje, geny, wynalazki, hardware, schematy → SQLite (`prisma/schema.prisma`)

**Stack**: Next.js 16.1.3 (App Router, Turbopack) · React 19 · TypeScript 5 · Prisma 6 (SQLite) · Tailwind 4 · shadcn/ui · three.js 0.184 · z-ai-web-dev-sdk.

**Wersja**: `0.3.0-sandbox` (sandbox mode włączony — izolowane eksperymenty w `/sandbox`).

## 2. Struktura katalogów (po rozpakowaniu)

```
GenLab/
├── src/
│   ├── app/
│   │   ├── api/              ← endpointy REST (patrz sekcja 4)
│   │   ├── lab/page.tsx      ← główny UI  (/lab)
│   │   ├── sandbox/          ← eksperymenty (/sandbox, /sandbox/graph3d)
│   │   └── page.tsx          ← splash → /lab
│   ├── components/
│   │   ├── lab/              ← dashboard, sidebar, widoki (about/explore/invent/sessions)
│   │   ├── sandbox/          ← sandbox-dashboard, gene-graph-3d (three.js)
│   │   └── ui/               ← shadcn primitives
│   ├── lib/
│   │   ├── agents.ts         ← 9-agent pipeline + 6-layer model
│   │   ├── zai.ts            ← ZAI SDK singleton + typy (TechGene, AHIResult, Invention)
│   │   ├── db.ts             ← Prisma client
│   │   ├── types.ts          ← shared types
│   │   └── repo-search.ts    ← GitHub API search helper
│   └── scripts/build-patent-pdf.ts
├── prisma/schema.prisma      ← Session, Gene, Invention, Hardware, Schematic
├── db/custom.db              ← SQLite (już z danymi z poprzednich sesji)
├── public/                   ← logo, robots
├── scripts/
│   ├── hermes-start.sh       ← bootstrap (patrz sekcja 0)
│   ├── make-genlab-backup.sh ← tworzy kolejny backup
│   └── search-threejs-repos.ts
├── package.json
├── next.config.ts            ← output: "standalone", serverExternalPackages: pdfkit
├── tsconfig.json
├── tailwind.config.ts
├── .env.example              ← template (DATABASE_URL, opcjonalnie ZAI_API_KEY)
└── HERMES.md                 ← ten plik
```

## 3. Wymagania środowiskowe

| Wymaganie | Wersja | Uwagi |
|-----------|--------|-------|
| Node.js | 20+ (zalecane 22+) | sprawdzaj `node -v` |
| Package manager | bun ≥1.3 / pnpm / npm | auto-detected przez `hermes-start.sh` |
| Disk | ~600 MB po install | node_modules + .next |
| RAM | 1 GB wolne | Next.js dev + Prisma + three.js |
| OS | Linux / macOS / WSL2 | Windows: zalecane WSL2 (bash) |

**Env vars** (w `.env`, generowane z `.env.example`):
- `DATABASE_URL` — ścieżka do SQLite (domyślnie `file:<root>/db/custom.db`)
- `ZAI_API_KEY` — opcjonalnie na infrastrukturze Z.ai SDK czyta key automatycznie; na czystym PC trzeba ustawić ręcznie

## 4. API endpointy (dla Hermes)

Wszystkie pod `http://localhost:3000`. POST/PUT body = JSON.

### Pipeline główne
| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/api/invent` | SSE stream — 9-agent pipeline. Body: `{ prompt: string, mode?: "invent" \| "explore" \| "analyze" \| "compare" }`. Zwraca Server-Sent Events z heartbeatem + payloadami per agent. |
| `POST` | `/api/schematic` | SSE stream — Hardware Architect + Schematic Prompt Builder dla konkretnej sesji. Body: `{ sessionId, inventionId }`. |
| `POST` | `/api/export` | Eksport sesji do Markdown. Body: `{ sessionId }`. |
| `POST` | `/api/export-patent` | Eksport patentu do PDF (pdfkit). Body: `{ sessionId, inventionId }`. |

### Sesje (CRUD)
| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/sessions` | Lista wszystkich sesji. |
| `POST` | `/api/sessions` | Ręczne utworzenie sesji. Body: `{ prompt, mode, summary? }`. |
| `GET` | `/api/sessions/[id]` | Pełny detail sesji (geny, wynalazki, hardware, schematy). |
| `DELETE` | `/api/sessions/[id]` | Hard-delete sesji. |

### Explore (read-only, agregaty nad DB)
| Metoda | Ścieżka | Query params | Opis |
|--------|---------|--------------|------|
| `GET` | `/api/explore/fusions` | `minCoOccur`, `limit` | Pary genów + `geneMeta` (kategoria, partners, appearances, avgAhi). Dane dla `/sandbox/graph3d`. |
| `GET` | `/api/explore/ahi-ranking` | — | Ranking sesji/wynalazków po AHI. |
| `GET` | `/api/explore/gaps` | — | Luki w pokryciu problemów. |
| `GET` | `/api/explore/repos` | `q`, `limit` | Wyszukiwarka repo GitHub (cache w DB). |
| `GET` | `/api/explore/theory-map` | — | Mapa teorii/problemów. |

### Sandbox (izolowane eksperymenty, bez dotykania DB)
| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/api/sandbox/status` | Status sandboxa, lista eksperymentów, izolacja. |
| `GET` | `/api/sandbox/experiments` | Szczegóły eksperymentów (id, status, complexity, dependsOn). |

### Strony
| URL | Opis |
|-----|------|
| `/` | Splash → przekierowanie do `/lab` |
| `/lab` | Główny dashboard (Invent / Explore / Sessions / About) |
| `/sandbox` | Sandbox dashboard (eksperymenty) |
| `/sandbox/graph3d` | three.js graf genów 3D (force-directed + bloom + flow particles) |

## 5. Konwencje komunikacji z GenLab

### 5.1 SSE pipeline (`/api/invent`)
- Response `Content-Type: text/event-stream`
- Każdy event: `data: { "agent": "problem-analyst", "phase": "thinking", ... }\n\n`
- Heartbeat co ~5s: `: keepalive\n\n` (utrzymuje połączenie przy długich agentach)
- Końcowy event: `data: { "agent": "patent-composer", "phase": "done", "sessionId": "..." }\n\n`
- Klient powinien zbierać wszystkie eventy i dopiero na `done` uważać sesję za kompletną.

### 5.2 Gene model
Każdy gen ma:
```ts
type TechGene = {
  category: 'input' | 'processing' | 'output' | 'infrastructure'
  need: string           // problem/need który gen adresuje
  techName: string       // np. "LangChain"
  githubUrl: string | null  // URL do repo (nullable jeśli nie znaleziono)
  role: string           // rola w architekturze
  description: string | null
  stars: number | null
  language: string | null
  license: string | null
}
```

### 5.3 AHI model
```ts
type AHIResult = {
  autonomy: number   // 0-10
  ethics: number     // 0-10
  decentral: number  // 0-10
  score: number      // średnia
  reasoning: string
}
```

### 5.4 6 warstw krytycznych pipeline
1. **Teoria** — analiza problemu (Problem Analyst)
2. **Repozytoria** — wyszukiwanie genów (Gene Extractor + GitHub API)
3. **Geny** — kategoryzacja + rolne przypisanie
4. **AHI** — scoring etyczny (AHI Ethicist)
5. **Fuzja** — łączenie genów w wynalazek (Fusion Strategist + System Architect)
6. **Patent** — claim + prior art + novelty (Patent Composer)

## 6. Sandbox — co wolno, czego nie

Sandbox (`/sandbox/*`, `/api/sandbox/*`) jest **izolowany** od produkcji:
- ✅ Czyta z DB (read-only agregaty)
- ✅ three.js / WebGL eksperymenty
- ❌ Nie wywołuje agentów (no ZAI SDK calls)
- ❌ Nie modyfikuje sesji
- ❌ Nie zapisuje do DB

Dzięki temu można testować wizualizacje i UI bez ryzyka dla danych produkcyjnych.

## 7. Troubleshooting

| Symptom | Prawdopodobna przyczyna | Rozwiązanie |
|---------|--------------------------|-------------|
| `Cannot find module '@prisma/client'` | Brak `prisma generate` po install | `bunx prisma generate` |
| `Database file not found` | `DATABASE_URL` w `.env` wskazuje nieistniejący plik | Edytuj `.env` — użyj ścieżki absolutnej |
| ZAI SDK błąd 401/403 | Brak `ZAI_API_KEY` na czystym PC | Ustaw env var |
| three.js nie renderuje | Stara przeglądarka / brak WebGL | Chrome/Firefox ≥ 2024 |
| `port 3000 in use` | Inny proces | `lsof -i :3000` i `kill`, albo `PORT=3001 bun run dev` |
| Build OOM | Mało RAM | `NODE_OPTIONS=--max-old-space-size=2048 bun run build` |

## 8. Backup / restore

Backup robi `scripts/make-genlab-backup.sh` — tar.gz z całym projektem (z DB, bez `node_modules`/`.next`). Wynik ląduje w `download/`.

Restore = rozpakuj + `bash scripts/hermes-start.sh`.

## 9. Co Hermes powinien zrobić po rozpakowaniu

1. **Weryfikacja**: `cat package.json | head -5` → sprawdź, że `name: "genlab"`, `version: "0.3.0-sandbox"`.
2. **Health check po starcie**: `curl http://localhost:3000/api/sandbox/status` → powinno zwrócić JSON z `sandboxEnabled: true`.
3. **Smoke test pipeline** (opcjonalnie): `curl -X POST http://localhost:3000/api/invent -H 'Content-Type: application/json' -d '{"prompt":"test hermes","mode":"explore"}'` → stream SSE.
4. **Eksploracja DB**: `curl http://localhost:3000/api/sessions | jq '.[0]'` → lista sesji.
5. **Jeśli coś nie działa**: sprawdź `dev.log` lub `server.log` w katalogu projektu.

## 10. Kontakt / konwencje

- Każde zadanie modyfikujące kod powinno skończyć się wpisem w `worklog.md` z `Task ID`, `Agent`, `Task`, `Work Log`, `Stage Summary`.
- Backup przed większą zmianą — zawsze przez `scripts/make-genlab-backup.sh`.
- TypeScript strict — `npx tsc --noEmit` musi przejść czysto w `src/` (błędy w `skills/` są pre-existing i ignorowane).
