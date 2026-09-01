/**
 * Search GitHub for three.js repos suitable for GenLab integration:
 *  - 3D data visualization (force-directed graphs, knowledge graphs)
 *  - Database cataloging / browsing UIs
 *  - Graph/network rendering
 *
 * Runs 4 targeted queries, dedupes, sorts, prints top 20.
 */
import { searchRepos, type RepoSearchResult } from '../src/lib/repo-search'

const QUERIES = [
  'three.js knowledge graph',
  'three.js 3d data visualization',
  'three.js graph database',
  'three.js force directed',
]

async function main() {
  const seen = new Map<string, RepoSearchResult>()
  for (const q of QUERIES) {
    console.error(`\n=== query: ${q} ===`)
    const { results, perPlatform } = await searchRepos(q, ['github'])
    console.error(`  github: ${perPlatform.github} results`)
    for (const r of results) {
      // Dedupe by URL
      if (!seen.has(r.url)) {
        seen.set(r.url, r)
      }
    }
  }

  const all = Array.from(seen.values()).sort((a, b) => {
    if (a.stars == null && b.stars == null) return 0
    if (a.stars == null) return 1
    if (b.stars == null) return -1
    return b.stars - a.stars
  })

  console.log('\n\n===== TOP THREE.JS REPOS FOR GENLAB =====\n')
  for (const r of all.slice(0, 25)) {
    const stars = r.stars != null ? r.stars.toString().padStart(6) : '   n/a'
    const lang = (r.language || 'n/a').padEnd(12).slice(0, 12)
    const lic = (r.license || 'n/a').padEnd(8).slice(0, 8)
    const updated = r.updatedAt ? r.updatedAt.slice(0, 10) : 'n/a'
    console.log(`${stars} ★  ${lang}  ${lic}  ${updated}  ${r.name}`)
    console.log(`         ${r.url}`)
    if (r.description) {
      const desc = r.description.length > 140 ? r.description.slice(0, 137) + '...' : r.description
      console.log(`         ${desc}`)
    }
    if (r.topics && r.topics.length > 0) {
      console.log(`         topics: ${r.topics.slice(0, 8).join(', ')}`)
    }
    console.log()
  }

  console.log(`\nTotal unique: ${all.length}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
