import type { LinkContent } from '../types/db'

const FETCH_TIMEOUT_MS = 4000

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/**
 * Best-effort link metadata.
 *
 * Most sites block cross-origin reads, so the direct fetch usually fails —
 * that is the expected path, not the error path. PRD section 9: a failed
 * fetch still yields a card with the raw URL and hostname, never an error
 * card. The favicon comes from DuckDuckGo's icon service, which is reachable
 * from any origin. Doing this properly server-side needs an edge function,
 * which is deliberately out of scope for now.
 */
export async function fetchLinkMeta(url: string): Promise<LinkContent> {
  const hostname = hostnameOf(url)
  const fallback: LinkContent = {
    url,
    title: hostname,
    favicon: `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) return fallback
    const html = await res.text()
    const parsed = new DOMParser().parseFromString(html, 'text/html')

    const ogTitle = parsed
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content')
      ?.trim()
    const docTitle = parsed.querySelector('title')?.textContent?.trim()
    const ogImage = parsed
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content')
      ?.trim()

    return {
      ...fallback,
      title: ogTitle || docTitle || hostname,
      og_image: ogImage || undefined,
    }
  } catch {
    return fallback
  }
}

export function isProbablyUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim())
}
