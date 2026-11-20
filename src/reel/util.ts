// Small timing helpers shared by the shots.

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Progress of t through [a, b], clamped. */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)

/**
 * Monotone cubic (Fritsch–Carlson) through keyframes [t, v]. Equal neighbouring
 * values give a true hold with eased entry and exit, and the curve never
 * overshoots, so time on a map never runs backwards.
 */
export function monotone(keys: [number, number][]): (t: number) => number {
  const n = keys.length
  const xs = keys.map((k) => k[0])
  const ys = keys.map((k) => k[1])
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  const m: number[] = new Array(n)
  m[0] = 0
  m[n - 1] = 0
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      m[i] = k * a * d[i]
      m[i + 1] = k * b * d[i]
    }
  }
  return (t: number) => {
    if (t <= xs[0]) return ys[0]
    if (t >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (t > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const u = (t - xs[i]) / h
    const u2 = u * u
    const u3 = u2 * u
    return (
      (2 * u3 - 3 * u2 + 1) * ys[i] +
      (u3 - 2 * u2 + u) * h * m[i] +
      (-2 * u3 + 3 * u2) * ys[i + 1] +
      (u3 - u2) * h * m[i + 1]
    )
  }
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')

const EPOCH = Date.UTC(1961, 0, 1)
/** Epoch-day (1 Jan 1961 = day 1) of a calendar date. */
export const dayOf = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 864e5) + 1
export const dateOf = (day: number) => new Date(EPOCH + (day - 1) * 864e5)

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent: HTMLElement,
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (html) e.innerHTML = html
  parent.appendChild(e)
  return e
}

export async function json<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
  return r.json() as Promise<T>
}
