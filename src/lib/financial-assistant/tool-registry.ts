import { assertRegistryReadOnly } from './permissions'
import { financialAssistantTools } from './tools/read-only-tools'
import type { AssistantTool, FinancialAssistantIntent } from './types'

const toolsByIntent = new Map<FinancialAssistantIntent, AssistantTool>()

for (const tool of financialAssistantTools) {
  if (toolsByIntent.has(tool.intent)) {
    throw new Error(`Duplicate financial assistant tool: ${tool.intent}`)
  }
  toolsByIntent.set(tool.intent, tool)
}

assertRegistryReadOnly(financialAssistantTools)

export function getAssistantTool(intent: FinancialAssistantIntent): AssistantTool | null {
  return toolsByIntent.get(intent) ?? null
}

export function listAssistantTools(): AssistantTool[] {
  return financialAssistantTools
}

