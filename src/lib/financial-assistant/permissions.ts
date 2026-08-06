import { FORBIDDEN_WRITE_OPERATIONS } from './constants'
import { FinancialAssistantError } from './errors'
import type { AssistantTool } from './types'

export function assertToolReadOnly(tool: AssistantTool): void {
  if (tool.readOnly !== true) {
    throw new FinancialAssistantError('ERROR', `Tool non read-only: ${tool.intent}`, 500)
  }
}

export function assertRegistryReadOnly(tools: AssistantTool[]): void {
  for (const tool of tools) assertToolReadOnly(tool)
}

export function assertNoWriteIntent(message?: string): void {
  const normalized = (message ?? '').toLowerCase()
  const matched = FORBIDDEN_WRITE_OPERATIONS.find((operation) => normalized.includes(operation.replaceAll('_', ' ')) || normalized.includes(operation))
  if (matched) {
    throw new FinancialAssistantError('FORBIDDEN', 'L’assistente finanziario e in sola lettura e non puo modificare i dati.', 403)
  }
}

