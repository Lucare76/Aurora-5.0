'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch('/api/observability/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: error.name,
        message: error.message,
        digest: error.digest,
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }, [error])

  return (
    <html lang="it">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8f9fc', padding: 24, fontFamily: 'Arial, sans-serif' }}>
          <section style={{ maxWidth: 520, textAlign: 'center', background: '#fff', border: '1px solid #e5e7f0', borderRadius: 24, padding: 32 }}>
            <h1 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>Aurora ha incontrato un errore</h1>
            <p style={{ marginTop: 12, color: '#64748b', lineHeight: 1.6 }}>
              L’errore è stato registrato automaticamente. Puoi riprovare ora.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 20, border: 0, borderRadius: 12, background: '#4f46e5', color: '#fff', padding: '11px 18px', fontWeight: 700, cursor: 'pointer' }}
            >
              Riprova
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
