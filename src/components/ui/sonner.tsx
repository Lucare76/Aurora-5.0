import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'glass-strong !rounded-xl !border-slate-200 !bg-white/95 !text-slate-900',
          title: '!text-slate-900',
          description: '!text-slate-500',
        },
      }}
    />
  )
}
