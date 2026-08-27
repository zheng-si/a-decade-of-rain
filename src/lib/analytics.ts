/** Cookieless product analytics (Umami Cloud).
 *
 *  The tracker script loads only when VITE_UMAMI_WEBSITE_ID is set at build
 *  time, so dev builds and forks send nothing. Pageviews (story vs archive,
 *  visitor counts) come from the script itself; the questions the custom
 *  events answer are of the form "how many readers ever did X", so every
 *  event is deduplicated per browser session — a reader who plays the decade
 *  five times counts once.
 */

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined

/** Events fired before the tracker script arrives wait here. Capped: if the
 *  script never loads (blocked, offline), the page must not accumulate. */
const pending: Array<[string, Record<string, string | number> | undefined]> = []

export function loadAnalytics() {
  if (!WEBSITE_ID) return
  const s = document.createElement('script')
  s.defer = true
  s.src = 'https://cloud.umami.is/script.js'
  s.dataset.websiteId = WEBSITE_ID
  s.onload = () => {
    for (const [event, data] of pending.splice(0)) window.umami?.track(event, data)
  }
  document.head.appendChild(s)
}

export function track(event: string, data?: Record<string, string | number>) {
  const key = `adr:${event}${data ? ':' + Object.values(data).join(',') : ''}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    /* private mode: counting is never worth crashing over */
  }
  if (window.umami) window.umami.track(event, data)
  else if (pending.length < 32) pending.push([event, data])
}
