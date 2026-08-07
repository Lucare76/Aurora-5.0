import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'

export function AssistantErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert">
      <div className="flex items-start gap-3">
        <div>
          <StatusBadge tone="critical" label="Operazione non completata" />
          <h2 className="mt-3 font-bold">Non siamo riusciti a completare l’operazione.</h2>
          <p className="mt-1 text-sm leading-6">{message}</p>
          <Button type="button" variant="outline" className="mt-4 border-red-200 bg-white text-red-700 hover:bg-red-100" onClick={onRetry}>
            Riprova
          </Button>
        </div>
      </div>
    </div>
  )
}
