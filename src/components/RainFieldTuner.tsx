import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AgentSeries } from './RainbowHerbicides'
import { densityOf, FIELD_DEFAULTS, type BuiltField, type FieldGeom, type Shape } from './rainfield'
import './RainFieldTuner.css'

/**
 * A dial for the year typology's geometry.
 *
 * The same shape as the Story's type tuner and gated the same way (dev, or
 * `?tune` anywhere), so the field can be dialled on a deploy preview rather
 * than only on a machine with the repo checked out.
 *
 * PORTALLED to the body, which the type tuner does not need to be because it is
 * rendered at the Story root. This one is owned by the field — that is how it
 * gets the geometry and the record without a store — and the field sits inside
 * a section that opens its own stacking context, so a fixed panel at z-index
 * 9999 in there still lands UNDER the z-index-6 nav rail. Measured, not
 * assumed: it rendered behind the rail until this was added.
 *
 * What makes this one more than a slider box is the CONSEQUENCES block. The
 * field's parameters are not free: cols x rows decides both whether a year can
 * be drawn at all in Volume mode and whether a small agent share survives
 * rounding in Share mode, and both were settled by measurement rather than by
 * eye. A panel that let those be moved without showing what moved with them
 * would be a way to quietly delete data. So every reading below is recomputed
 * from the record on every keystroke, against the same arithmetic the figure
 * itself uses, and the panel says plainly when a setting loses something.
 */

interface Props {
  geom: FieldGeom
  onChange: (g: FieldGeom) => void
  built: BuiltField
  years: number[]
  series: AgentSeries[]
}

const SHAPES: { v: Shape; label: string }[] = [
  { v: 'drop', label: 'Drop' },
  { v: 'circle', label: 'Circle' },
  { v: 'square', label: 'Square' },
]

/** Parameter triples worth comparing, all inside the compass-drop family. Named
 *  for what they look like rather than for their numbers, because that is how
 *  they get talked about. */
const PRESETS: { label: string; p: Partial<FieldGeom> }[] = [
  { label: 'Shipped', p: { shape: 'drop', aspect: 1.3, apex: 6, hip: 30 } },
  { label: 'Long cone', p: { shape: 'drop', aspect: 1.55, apex: 2, hip: 42 } },
  { label: 'Low waterline', p: { shape: 'drop', aspect: 1.45, apex: 4, hip: 46 } },
  { label: 'Blunt', p: { shape: 'drop', aspect: 1.15, apex: 13, hip: 22 } },
  { label: 'Teardrop', p: { shape: 'drop', aspect: 1.7, apex: 1, hip: 50 } },
]

/** Same apportionment the figure uses. Duplicated rather than imported because
 *  the panel must be able to answer "what would this setting do" for counts the
 *  figure is not currently rendering. */
function apportion(vals: number[], budget: number): number[] {
  const total = vals.reduce((a, b) => a + b, 0)
  const out = vals.map(() => 0)
  if (!total || !budget) return out
  const raw = vals.map((v) => (v / total) * budget)
  raw.forEach((r, i) => (out[i] = Math.floor(r)))
  vals.forEach((v, i) => {
    if (v > 0 && out[i] === 0) out[i] = 1
  })
  const order = raw.map((_, i) => i).sort((a, b) => (raw[b] % 1) - (raw[a] % 1))
  let d = budget - out.reduce((a, b) => a + b, 0)
  for (let i = 0; d > 0 && i < 999; i++, d--) out[order[i % order.length]]++
  for (let i = 0; d < 0 && i < 999; i++) {
    const j = order[order.length - 1 - (i % order.length)]
    if (out[j] > 1) {
      out[j]--
      d++
    }
  }
  return out
}

/** One parameter row: name, minus, an editable value, plus, and what the number
 *  means. The value is an input rather than a readout because a designer
 *  settling on 1.42 should not press + eight times to reach it — which is also
 *  why this lives at module scope. Declared inside the panel's own render it
 *  would be a new component type on every keystroke, so React would unmount the
 *  input and the caret would jump out after each character. */
function Num({
  geom,
  set,
  k,
  label,
  step,
  min,
  max,
  unit,
}: {
  geom: FieldGeom
  set: (p: Partial<FieldGeom>) => void
  k: keyof FieldGeom
  label: string
  step: number
  min: number
  max: number
  unit?: string
}) {
  const v = geom[k] as number
  const moved = v !== FIELD_DEFAULTS[k]
  const clamp = (x: number) => Math.max(min, Math.min(max, Math.round(x * 10000) / 10000))
  return (
    <div className="rft-dial">
      <span className="rft-k">{label}</span>
      <button onClick={() => set({ [k]: clamp(v - step) } as Partial<FieldGeom>)} aria-label="Less">
        −
      </button>
      <input
        className={`rft-val${moved ? ' is-set' : ''}`}
        value={v}
        inputMode="decimal"
        onChange={(e) => {
          const x = parseFloat(e.target.value)
          if (!Number.isNaN(x)) set({ [k]: clamp(x) } as Partial<FieldGeom>)
        }}
      />
      <button onClick={() => set({ [k]: clamp(v + step) } as Partial<FieldGeom>)} aria-label="More">
        +
      </button>
      <span className="rft-u">{unit}</span>
    </div>
  )
}

/** A boolean row. At module scope for the same reason Num is. */
function Flag({
  geom,
  set,
  k,
  label,
  note,
}: {
  geom: FieldGeom
  set: (p: Partial<FieldGeom>) => void
  k: keyof FieldGeom
  label: string
  note?: string
}) {
  const on = geom[k] as boolean
  const moved = on !== FIELD_DEFAULTS[k]
  return (
    <div className="rft-dial">
      <span className="rft-k">{label}</span>
      <button
        className={`rft-flag${on ? ' is-on' : ''}${moved ? ' is-set' : ''}`}
        aria-pressed={on}
        onClick={() => set({ [k]: !on } as Partial<FieldGeom>)}
      >
        {on ? 'on' : 'off'}
      </button>
      <span className="rft-u">{note}</span>
    </div>
  )
}

const n1 = (v: number) => Math.round(v * 10) / 10
const n2 = (v: number) => Math.round(v * 100) / 100

export default function RainFieldTuner({ geom, onChange, built, years, series }: Props) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const set = (p: Partial<FieldGeom>) => {
    onChange({ ...geom, ...p })
    setCopied(false)
  }

  /** What this setting does to the record. Everything here is derived, nothing
   *  is remembered from a previous session's measurements. */
  const facts = useMemo(() => {
    const cells = built.cells
    const yearTotals = years.map((_, i) => series.reduce((a, s) => a + s.values[i], 0))
    const peak = Math.max(...yearTotals, 0)
    const peakYear = years[yearTotals.indexOf(peak)]

    // Volume: how full the heaviest year is, and whether anything overflows.
    const volFills = yearTotals.map((q) => (q > 0 ? Math.max(1, Math.round(q / geom.gallons)) : 0))
    const over = volFills.filter((v) => v > cells).length
    // A year with volume that cannot be drawn at all is the failure the field
    // size exists to avoid.
    const volLost = years.filter((_, i) => yearTotals[i] > 0 && Math.round(yearTotals[i] / geom.gallons) < 1)

    // Share: an agent that sprayed and rounds away to nothing. The figure's
    // floor-of-one hides this, so the check is against the raw largest
    // remainder, which is what the floor is compensating for.
    const shareLost: string[] = []
    years.forEach((yr, i) => {
      const vals = series.map((s) => s.values[i])
      const tot = vals.reduce((a, b) => a + b, 0)
      if (tot <= 0) return
      const raw = vals.map((v) => Math.floor((v / tot) * cells))
      let d = cells - raw.reduce((a, b) => a + b, 0)
      const ord = vals.map((_, k) => k).sort((a, b) => ((vals[b] / tot) * cells) % 1 - ((vals[a] / tot) * cells) % 1)
      for (let k = 0; d > 0 && k < 999; k++, d--) raw[ord[k % ord.length]]++
      vals.forEach((v, k) => {
        if (v > 0 && raw[k] === 0) shareLost.push(`${yr} ${series[k].name.replace(/^Agents? /, '')} ${n2((v / tot) * 100)}%`)
      })
    })

    // The unit that would make the heaviest year exactly fill the field, and the
    // nearest round numbers either side of it.
    const tight = peak / cells
    const rounds = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 75000, 100000]
    const fits = rounds.filter((u) => Math.round(peak / u) <= cells)
    const tightestRound = fits.length ? Math.min(...fits) : null

    const floorExtra = years.reduce((acc, _, i) => {
      const vals = series.map((s) => s.values[i])
      const q = vals.reduce((a, b) => a + b, 0)
      if (q <= 0) return acc
      const budget = Math.min(cells, Math.max(1, Math.round(q / geom.gallons)))
      return acc + (apportion(vals, budget).reduce((a, b) => a + b, 0) - budget)
    }, 0)

    const empties = years.filter((_, i) => yearTotals[i] <= 0)

    return {
      empties,
      cells,
      peak,
      peakYear,
      peakDrops: peak > 0 ? Math.round(peak / geom.gallons) : 0,
      peakPct: cells ? Math.round((Math.round(peak / geom.gallons) / cells) * 100) : 0,
      over,
      volLost,
      shareLost,
      tight,
      tightestRound,
      floorExtra,
      // Marks the figure actually DRAWS, so the floor cost is a fraction of
      // something on screen. It counted every year including the hidden ones.
      totalMarks: cells * (years.length - (geom.hideEmpty ? empties.length : 0)),
    }
  }, [built.cells, geom.gallons, years, series])

  const copyText = useMemo(() => {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const diff = (Object.keys(FIELD_DEFAULTS) as (keyof FieldGeom)[]).filter((k) => geom[k] !== FIELD_DEFAULTS[k])
    const line = (k: keyof FieldGeom) => `  ${k}: ${typeof geom[k] === 'string' ? `'${geom[k]}'` : geom[k]},`
    return [
      '// src/components/rainfield.ts — FIELD_DEFAULTS',
      `// dialled at ${window.innerWidth}px wide, 1rem = ${root}px`,
      diff.length ? `// changed: ${diff.join(', ')}` : '// nothing changed yet',
      'export const FIELD_DEFAULTS: FieldGeom = {',
      ...(Object.keys(FIELD_DEFAULTS) as (keyof FieldGeom)[]).map(line),
      '}',
      '',
      `// mark          ${geom.shape}, box 100 x ${n1(built.dh)}${geom.shape === 'drop' ? `, flank ${n1(built.flank)}deg from vertical` : ''}`,
      `// density       ${n2(densityOf(geom.gapX) * 100)}% of pitch across`,
      `// field         ${built.cols} x ${built.rows} = ${facts.cells} marks, viewBox ${built.fieldW.toFixed(1)} x ${built.fieldH.toFixed(1)}`,
      `// cell gap      ${geom.gridGapY} / ${geom.gridGapX}rem = ${n1(geom.gridGapY * root)} / ${n1(geom.gridGapX * root)}px here`,
      `// unit          1 mark = ${geom.gallons.toLocaleString()} gallons`,
      `// fields drawn  ${years.length - (geom.hideEmpty ? facts.empties.length : 0)} of ${years.length}${
        geom.hideEmpty && facts.empties.length ? ` (${facts.empties.join(', ')} hidden)` : ''
      }`,
      geom.hideEmpty !== FIELD_DEFAULTS.hideEmpty
        ? '// NOTE: hideEmpty also drops RAINBOW.fieldNoteNil from the caption -- the\n//       sentence about 1961 only shows while there is a 1961 to point at.'
        : '',
      `// peak          ${facts.peakYear} fills ${facts.peakDrops} of ${facts.cells} (${facts.peakPct}%)`,
      `// overflow      ${facts.over ? `${facts.over} year(s) EXCEED the field` : 'none'}`,
      `// volume loses  ${facts.volLost.length ? facts.volLost.join(', ') + ' (drawn at the floor of one)' : 'nothing'}`,
      `// share loses   ${facts.shareLost.length ? facts.shareLost.join(', ') : 'nothing'}`,
      `// floor cost    ${facts.floorExtra} extra marks out of ${facts.totalMarks}`,
      !built.valid ? `// INVALID SHAPE ${built.why}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }, [geom, built, facts])

  if (!open) {
    return createPortal(
      <button className="rft-reopen" onClick={() => setOpen(true)}>
        Field
      </button>,
      document.body,
    )
  }

  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

  return createPortal(
    <aside className="rft" aria-label="Rain field tuner">
      <header className="rft-head">
        <strong>Field · the drops</strong>
        <button onClick={() => setOpen(false)} aria-label="Close">
          ×
        </button>
      </header>

      <div className="rft-body">
        <p className="rft-note">
          Everything is live. The readings under “What it costs” are recomputed from the spray record on
          every change — they are the reason to look here rather than only at the page.
        </p>

        <section>
          <h4>Mark</h4>
          <div className="rft-seg rft-wide">
            {SHAPES.map((sh) => (
              <button key={sh.v} className={geom.shape === sh.v ? 'is-on' : undefined} onClick={() => set({ shape: sh.v })}>
                {sh.label}
              </button>
            ))}
          </div>
          <div className="rft-presets">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => set(p.p)}>
                {p.label}
              </button>
            ))}
          </div>
          <Num geom={geom} set={set} k="aspect" label="aspect" step={0.05} min={0.3} max={3} unit={`= ${n1(built.dh)} tall`} />
          {geom.shape === 'drop' && (
            <>
              <Num geom={geom} set={set} k="apex" label="apex r" step={1} min={0} max={49} unit="% of w" />
              <Num geom={geom} set={set} k="hip" label="hip r" step={1} min={1} max={50} unit="% of w" />
              <p className="rft-hint">flank {n1(built.flank)}° from vertical</p>
            </>
          )}
          {geom.shape === 'square' && <Num geom={geom} set={set} k="corner" label="corner" step={2} min={0} max={50} unit="% of w" />}
          {!built.valid && <p className="rft-bad">{built.why}</p>}
        </section>

        <section>
          <h4>Field · marks per year</h4>
          <Num geom={geom} set={set} k="cols" label="cols" step={1} min={1} max={30} />
          <Num geom={geom} set={set} k="rows" label="rows" step={1} min={1} max={30} />
          <p className="rft-hint">
            {built.cols} × {built.rows} = <b>{facts.cells}</b> marks
          </p>
          <Flag
            geom={geom}
            set={set}
            k="hideEmpty"
            label="hide empty"
            note={facts.empties.length ? `drops ${facts.empties.join(', ')}` : 'nothing to drop'}
          />
          <Num geom={geom} set={set} k="gapX" label="gap x" step={2} min={0} max={300} unit="% of w" />
          <Num geom={geom} set={set} k="gapY" label="gap y" step={2} min={0} max={300} unit="% of h" />
          <p className="rft-hint">
            density {n2(densityOf(geom.gapX) * 100)}% across ·{' '}
            <button
              className="rft-link"
              onClick={() => set({ gapX: FIELD_DEFAULTS.gapX, gapY: FIELD_DEFAULTS.gapY })}
            >
              back to {n2(densityOf(FIELD_DEFAULTS.gapX) * 100)}%
            </button>
          </p>
        </section>

        <section>
          <h4>Grid · the year cells</h4>
          <Num geom={geom} set={set} k="cellMin" label="cell min" step={5} min={40} max={400} unit="px" />
          <Num geom={geom} set={set} k="gridGapX" label="gap x" step={0.125} min={0} max={6} unit={`rem = ${n1(geom.gridGapX * root)}px`} />
          <Num geom={geom} set={set} k="gridGapY" label="gap y" step={0.125} min={0} max={6} unit={`rem = ${n1(geom.gridGapY * root)}px`} />
          <Num geom={geom} set={set} k="maxWidth" label="max w" step={10} min={200} max={2000} unit="px" />
        </section>

        <section>
          <h4>Unit</h4>
          <Num geom={geom} set={set} k="gallons" label="gal/mark" step={1000} min={100} max={500000} />
          {facts.tightestRound && facts.tightestRound !== geom.gallons && (
            <p className="rft-hint">
              <button className="rft-link" onClick={() => set({ gallons: facts.tightestRound! })}>
                tightest round unit that fits: {facts.tightestRound.toLocaleString()}
              </button>
            </p>
          )}
        </section>

      </div>

      <section className="rft-facts">
        <h4>What it costs</h4>
        <dl>
          <dt>peak</dt>
          <dd>
            {facts.peakYear} fills <b>{facts.peakDrops}</b> of {facts.cells} ({facts.peakPct}%)
          </dd>
          <dt>overflow</dt>
          <dd className={facts.over ? 'is-bad' : 'is-ok'}>
            {facts.over ? `${facts.over} year(s) exceed the field` : 'none'}
          </dd>
          <dt>volume loses</dt>
          <dd className={facts.volLost.length ? 'is-warn' : 'is-ok'}>
            {facts.volLost.length ? `${facts.volLost.join(', ')} — under one mark` : 'nothing'}
          </dd>
          <dt>share loses</dt>
          <dd className={facts.shareLost.length ? 'is-bad' : 'is-ok'}>
            {facts.shareLost.length ? facts.shareLost.join(' · ') : 'nothing'}
          </dd>
          <dt>fields drawn</dt>
          <dd className={geom.hideEmpty && facts.empties.length ? 'is-warn' : undefined}>
            {years.length - (geom.hideEmpty ? facts.empties.length : 0)} of {years.length}
            {geom.hideEmpty && facts.empties.length ? ` — ${facts.empties.join(', ')} hidden` : ''}
          </dd>
          <dt>floor cost</dt>
          <dd>
            {facts.floorExtra} extra marks / {facts.totalMarks}
          </dd>
        </dl>
      </section>

      <footer className="rft-foot">
        <button onClick={() => onChange(FIELD_DEFAULTS)}>Reset</button>
        <button
          className="is-primary"
          onClick={() => {
            navigator.clipboard?.writeText(copyText)
            setCopied(true)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </footer>

      <pre className="rft-out">{copyText}</pre>
    </aside>,
    document.body,
  )
}
