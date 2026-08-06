import { listAssistantTools } from './tool-registry'
import type { FinancialAssistantScope } from './types'

export function listAssistantCapabilities(allowedScopes: FinancialAssistantScope[]) {
  return listAssistantTools()
    .filter((tool) => allowedScopes.includes(tool.scope))
    .map((tool) => ({
      intent: tool.intent,
      label: tool.label,
      description: tool.description,
      scope: tool.scope,
      readOnly: tool.readOnly,
    }))
}

