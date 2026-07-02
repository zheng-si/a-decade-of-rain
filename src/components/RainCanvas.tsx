import { useEffect, useRef } from 'react'

interface Drop {
  x: number
  y: number
  len: number
  sp: number // px per second
  wdt: number
  a: number
}

// Rain drawn on a single <canvas> rather than dozens of animated DOM nodes.
// One composited layer means no layer-promotion storm — which was making the
// banner and the glass nav pill flicker.
export default function RainCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let drops: Drop[] = []

    const spawn = (anywhere: boolean): Drop => {
      const long = Math.random() > 0.82
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -40,
        len: long ? 80 + Math.random() * 90 : 16 + Math.random() * 54,
        sp: (long ? 900 : 520) + Math.random() * 700,
        wdt: Math.random() > 0.8 ? 2 : 1.2,
        a: 0.12 + Math.random() * 0.5,
      }
    }

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(40, Math.round((w * h) / 16000))
      drops = Array.from({ length: count }, () => spawn(true))
    }

    let raf = 0
    let last = 0
    let t0 = 0
    const frame = (t: number) => {
      if (!t0) t0 = t
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
      last = t
      // Smooth shower ↔ downpour swell over ~13s.
      const phase = (((t - t0) / 1000) % 13) / 13
      const intensity = 0.4 + 0.6 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2))
      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'
      for (const d of drops) {
        d.y += d.sp * dt
        if (d.y - d.len > h) Object.assign(d, spawn(false))
        ctx.strokeStyle = `rgba(255,84,73,${(d.a * intensity).toFixed(3)})`
        ctx.lineWidth = d.wdt
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x, d.y - d.len) // strictly vertical
        ctx.stroke()
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="story-rain-canvas" aria-hidden="true" />
}
