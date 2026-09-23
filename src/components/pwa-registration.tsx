'use client'

import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)

    setInstalled(standalone)

    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      const prompt = event as InstallPromptEvent
      ;(window as Window & { __auroraInstallPrompt?: InstallPromptEvent }).__auroraInstallPrompt = prompt
      setInstallPrompt(prompt)
      window.dispatchEvent(new Event('aurora-install-ready'))
    }

    const onInstalled = () => {
      delete (window as Window & { __auroraInstallPrompt?: InstallPromptEvent }).__auroraInstallPrompt
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if ('serviceWorker' in navigator) {
      const register = () => {
        void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
          // Browsing the site still works if installation is unavailable.
        })
      }

      window.addEventListener('load', register, { once: true })
      if (document.readyState === 'complete') register()

      return () => {
        window.removeEventListener('load', register)
        window.removeEventListener('beforeinstallprompt', onInstallPrompt)
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      delete (window as Window & { __auroraInstallPrompt?: InstallPromptEvent }).__auroraInstallPrompt
    }
  }

  if (installed || !installPrompt) return null

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
      aria-label="Installa Aurora"
    >
      <img src="/favicon.svg" alt="" className="h-5 w-5 rounded-sm" aria-hidden="true" />
      Installa Aurora
    </button>
  )
}
