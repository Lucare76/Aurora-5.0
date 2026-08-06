'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AssistantErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-bold">Aurora non è disponibile</h2>
          <p className="mt-1 text-sm leading-6">{message}</p>
          <Button type="button" variant="outline" className="mt-4 border-red-200 bg-white text-red-700 hover:bg-red-100" onClick={onRetry}>
            Riprova
          </Button>
        </div>
      </div>
    </div>
  )
}
