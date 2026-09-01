/**
 * Repo URL helpers — shared between client and server.
 *
 * This module is INTENTIONALLY dependency-free (no imports from @/lib/agents
 * or @/lib/zai) so it can be safely imported from Client Components without
 * pulling the Z-AI SDK (which requires Node's `fs/promises` and breaks
 * browser bundles).
 *
 * Supported code-hosting platforms:
 *   GitHub        — github.com, /owner/repo pattern
 *   GitLab        — gitlab.com, /owner/repo pattern
 *   Bitbucket     — bitbucket.org, /owner/repo pattern
 *   Codeberg      — codeberg.org, /owner/repo pattern (forgejo)
 *   AWS CodeCommit — codecommit.aws.amazon.com, /console/vcs/codecommit/repositories/<repo>/
 *   SourceForge   — sourceforge.net, /projects/<name>/ pattern
 */

export const SUPPORTED_REPO_HOSTS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'codeberg.org',
  'codecommit.aws.amazon.com',
  'sourceforge.net',
] as const

/** Returns true if a URL points to a recognized code-hosting platform. */
export function isRepoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const u = url.toLowerCase()
  return SUPPORTED_REPO_HOSTS.some((h) => u.includes(h))
}

/**
 * Parses owner/repo from a repo URL across all supported platforms.
 * Returns { owner, repo, host } or null if not a recognized repo URL.
 *
 * GitHub/GitLab/Bitbucket/Codeberg all use /<owner>/<repo> pattern.
 * CodeCommit uses /console/vcs/codecommit/repositories/<repo>/browse
 * SourceForge uses /projects/<name>/ pattern (no owner).
 */
export function parseRepoUrl(
  url: string | null | undefined
): { owner: string; repo: string; host: string } | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const pathParts = u.pathname.split('/').filter(Boolean)

  if (host === 'sourceforge.net') {
    // /projects/<name>/...
    if (pathParts[0] === 'projects' && pathParts[1]) {
      return { owner: 'sourceforge', repo: pathParts[1], host }
    }
    return null
  }
  if (host === 'codecommit.aws.amazon.com' || host.endsWith('.codecommit.aws.amazon.com')) {
    // /console/vcs/codecommit/repositories/<repo>/...
    const idx = pathParts.indexOf('repositories')
    if (idx >= 0 && pathParts[idx + 1]) {
      return { owner: 'aws', repo: pathParts[idx + 1], host }
    }
    return null
  }
  // GitHub / GitLab / Bitbucket / Codeberg: /<owner>/<repo>
  if (pathParts.length >= 2) {
    return { owner: pathParts[0], repo: pathParts[1], host }
  }
  return null
}

/**
 * Compact human-readable label for a repo URL.
 *   github.com/owner/repo   → "owner/repo"
 *   gitlab.com/owner/repo   → "gl:owner/repo"
 *   bitbucket.org/owner/repo → "bb:owner/repo"
 *   codeberg.org/owner/repo → "cb:owner/repo"
 *   sourceforge.net/projects/audacity → "sf:audacity"
 *   codecommit.../repositories/my-repo → "aws:my-repo"
 */
export function repoUrlToLabel(url: string | null | undefined): string {
  const parsed = parseRepoUrl(url)
  if (!parsed) return url || ''
  if (parsed.host === 'sourceforge.net') return `sf:${parsed.repo}`
  if (parsed.host === 'codecommit.aws.amazon.com' || parsed.host.endsWith('.codecommit.aws.amazon.com')) {
    return `aws:${parsed.repo}`
  }
  const shortHost =
    parsed.host === 'github.com' ? '' :
    parsed.host === 'gitlab.com' ? 'gl:' :
    parsed.host === 'bitbucket.org' ? 'bb:' :
    parsed.host === 'codeberg.org' ? 'cb:' :
    `${parsed.host}:`
  return `${shortHost}${parsed.owner}/${parsed.repo}`
}

/**
 * Returns a short host label for display (used in UI badges / icons).
 *   github.com → "GitHub"
 *   gitlab.com → "GitLab"
 *   bitbucket.org → "Bitbucket"
 *   codeberg.org → "Codeberg"
 *   codecommit.aws.amazon.com → "CodeCommit"
 *   sourceforge.net → "SourceForge"
 */
export function repoHostLabel(url: string | null | undefined): string {
  const parsed = parseRepoUrl(url)
  if (!parsed) return 'Repo'
  switch (parsed.host) {
    case 'github.com': return 'GitHub'
    case 'gitlab.com': return 'GitLab'
    case 'bitbucket.org': return 'Bitbucket'
    case 'codeberg.org': return 'Codeberg'
    case 'codecommit.aws.amazon.com': return 'CodeCommit'
    case 'sourceforge.net': return 'SourceForge'
    default: return parsed.host
  }
}
