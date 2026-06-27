import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'glass-strong !rounded-xl !border-white/10 !bg-[#12142a]/95 !text-white',
          title: '!text-white',
          description: '!text-white/50',
        },
      }}
    />
  )
}
