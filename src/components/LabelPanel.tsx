import { useState } from 'react'
import type { LabelGroup } from './labelLayers'

interface Props {
  groups: LabelGroup[]
  onToggle: (key: string) => void
}

export default function LabelPanel({ groups, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  if (!groups.length) return null
  return (
    <div className={`label-panel${open ? ' is-open' : ''}`}>
      <button className="label-panel-toggle" onClick={() => setOpen((o) => !o)}>
        Map labels <span className="label-panel-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="label-panel-list">
          {groups.map((g) => (
            <li key={g.key}>
              <label>
                <input type="checkbox" checked={g.visible} onChange={() => onToggle(g.key)} />
                <span>{g.label}</span>
                <span className="label-panel-count">{g.layerIds.length}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
