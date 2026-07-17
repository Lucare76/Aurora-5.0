import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  FirstUseChecklist,
  isFirstUseChecklistComplete,
} from '@/components/onboarding/FirstUseChecklist'

describe('FirstUseChecklist', () => {
  it('mostra i primi passi quando il setup iniziale non e completato', () => {
    const html = renderChecklist({ hasAccount: false, hasCategory: false, hasMovement: false })

    expect(html).toContain('Benvenuto in Aurora')
    expect(html).toContain('Crea il primo conto')
    expect(html).toContain('Verifica o crea le categorie')
    expect(html).toContain('Inserisci il primo movimento')
    expect(html).toContain('Esplora la Dashboard')
    expect(html).toContain('Crea il primo budget')
  })

  it('segna come completati i passi gia svolti', () => {
    const html = renderChecklist({ hasAccount: true, hasCategory: true, hasMovement: false })

    expect(html).toContain('Completato: Crea il primo conto')
    expect(html).toContain('Completato: Verifica o crea le categorie')
    expect(html).toContain('Da completare: Inserisci il primo movimento')
  })

  it('sparisce quando i passi principali sono completati', () => {
    const html = renderChecklist({ hasAccount: true, hasCategory: true, hasMovement: true })

    expect(html).toBe('')
    expect(isFirstUseChecklistComplete({ hasAccount: true, hasCategory: true, hasMovement: true })).toBe(true)
  })

  it('non richiede il budget facoltativo per considerare completato il primo utilizzo', () => {
    expect(isFirstUseChecklistComplete({
      hasAccount: true,
      hasCategory: true,
      hasMovement: true,
      hasBudget: false,
    })).toBe(true)
  })
})

function renderChecklist(status: React.ComponentProps<typeof FirstUseChecklist>['status']): string {
  return renderToStaticMarkup(React.createElement(FirstUseChecklist, { status }))
}
