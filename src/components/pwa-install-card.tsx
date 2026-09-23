'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onPrompt = () => setInstallPrompt((window as Window & { __auroraInstallPrompt?: InstallEvent }).__auroraInstallPrompt ?? null)
    const onInstalled = () => {
      delete (window as Window & { __auroraInstallPrompt?: InstallEvent }).__auroraInstallPrompt
      setInstalled(true)
      setInstallPrompt(null)
    }
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true))
    onPrompt()
    window.addEventListener('aurora-install-ready', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('aurora-install-ready', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    delete (window as Window & { __auroraInstallPrompt?: InstallEvent }).__auroraInstallPrompt
    setInstallPrompt(null)
  }

  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p>{installed ? 'Aurora è già installata su questo dispositivo.' : 'Installa Aurora dalla schermata iniziale per aprirla come un’app.'}</p>
      {!installed && installPrompt && <Button variant="outline" onClick={() => void install()}>Installa Aurora</Button>}
      {!installed && !installPrompt && <p className="text-xs text-slate-500">Su iPhone e iPad: apri Safari, tocca Condividi e scegli “Aggiungi alla schermata Home”. Su altri browser, usa “Installa app” nel menu.</p>}
      <p className="text-xs text-slate-500">Per saldi e movimenti serve una connessione Internet.</p>
    </div>
  )
}
