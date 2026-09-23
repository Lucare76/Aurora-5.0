'use client'

import { useEffect } from 'react'

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    window.addEventListener('load', register, { once: true })
    const onInstallPrompt = (event: Event) => {
      event.preventDefault()
      ;(window as Window & { __auroraInstallPrompt?: Event }).__auroraInstallPrompt = event
      window.dispatchEvent(new Event('aurora-install-ready'))
    }
    window.addEventListener('beforeinstallprompt', onInstallPrompt)

    function register() {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Browsing the site still works if installation is unavailable.
      })
    }

    if (document.readyState === 'complete') register()
    return () => {
      window.removeEventListener('load', register)
      window.removeEventListener('beforeinstallprompt', onInstallPrompt)
    }
  }, [])

  return null
}
