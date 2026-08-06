import { AssistantResult } from './AssistantResult'
import type { AssistantResult as AssistantResultType } from '@/lib/financial-assistant/types'
import { cn } from '@/lib/utils'

export type AssistantChatMessage =
  | { id: string; type: 'USER'; content: string }
  | { id: string; type: 'ASSISTANT_RESULT' | 'ASSISTANT_QUESTION' | 'ASSISTANT_ERROR'; content: string; result?: AssistantResultType }
  | { id: string; type: 'SYSTEM_NOTICE'; content: string }

export function AssistantMessage({ message }: { message: AssistantChatMessage }) {
  if (message.type === 'ASSISTANT_RESULT' && message.result) return <AssistantResult result={message.result} />

  return (
    <div
      className={cn(
        'max-w-[92%] rounded-3xl px-4 py-3 text-sm leading-6 md:max-w-[78%]',
        message.type === 'USER'
          ? 'ml-auto bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
          : message.type === 'ASSISTANT_ERROR'
            ? 'border border-red-200 bg-red-50 text-red-800'
            : 'border border-[#e5e7f0] bg-white text-slate-700',
      )}
    >
      {message.content}
    </div>
  )
}
