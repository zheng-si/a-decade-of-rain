import type { AgentInfo } from '../data/spray'

export interface AgentChoice {
  key: string
  label: string
  /** Agent indices this choice selects; null = all. */
  indices: number[] | null
}

/** Build the agent filter choices from the dataset legend. */
export function buildAgentChoices(agents: AgentInfo[]): AgentChoice[] {
  const byCode = (code: string) => agents.find((a) => a.code === code)?.index
  const main = ['O', 'W', 'B']
  const otherIdx = agents.filter((a) => !main.includes(a.code)).map((a) => a.index)
  const only = (code: string): number[] => {
    const i = byCode(code)
    return i == null ? [] : [i]
  }
  return [
    { key: 'all', label: 'All agents', indices: null },
    { key: 'O', label: 'Orange', indices: only('O') },
    { key: 'W', label: 'White', indices: only('W') },
    { key: 'B', label: 'Blue', indices: only('B') },
    { key: 'other', label: 'Other', indices: otherIdx },
  ]
}
