import { useState } from 'react'
import type { LabelGroup } from './labelLayers'

interface Props {
  groups: LabelGroup[]
  onToggle: (key: string) => void
}

// A dropdown that lives inside the top-right nav pill: a pill button that opens
// a floating checklist of label tiers.
export default function LabelPanel({ groups, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  if (!groups.length) return null
  return (
    <div className="label-menu">
      <button
        className={`site-nav-link site-nav-btn${open ? ' is-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        Labels
      </button>
      {open && (
        <div className="label-menu-panel">
          <ul className="label-menu-list">
            {groups.map((g) => (
              <li key={g.key}>
                <label>
                  <input type="checkbox" checked={g.visible} onChange={() => onToggle(g.key)} />
                  <span>{g.label}</span>
                  <span className="label-menu-count">{g.layerIds.length}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
