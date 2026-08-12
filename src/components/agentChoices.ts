import type { AgentInfo } from '../data/spray'
import { mapConfig } from '../config/mapConfig'

export interface AgentChoice {
  key: string
  label: string
  /** Agent indices this choice selects; null = all. */
  indices: number[] | null
  /** Display colour; null for the neutral "All" choice. */
  color: string | null
}

/**
 * Build the agent filter choices from the dataset legend, grouped and coloured
 * per `mapConfig.agents`. Leads with an "All agents" choice.
 */
export function buildAgentChoices(agents: AgentInfo[]): AgentChoice[] {
  const indexOf = (code: string) => agents.find((a) => a.code === code)?.index
  const choices: AgentChoice[] = [
    { key: 'all', label: 'All', indices: null, color: null },
  ]
  for (const g of mapConfig.agents) {
    const indices = g.codes.map(indexOf).filter((i): i is number => i != null)
    if (indices.length) choices.push({ key: g.key, label: g.label, indices, color: g.color })
  }
  return choices
}
