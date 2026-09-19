import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const api = readFileSync('src/app/api/patrimonio/route.ts', 'utf8')
const patchRoute = readFileSync('src/app/api/patrimonio/[id]/route.ts', 'utf8')
const page = readFileSync('src/app/(app)/patrimonio/page.tsx', 'utf8')

describe('patrimonio nice-to-have', () => {
  it('separates invested capital from returns and exposes composition', () => {
    expect(api).toContain('totalReturn: externalValue - investedAmount')
    expect(api).toContain('totalReturnPercentage')
    expect(api).toContain('composition: [...compositionMap.entries()]')
  })

  it('offers the guided quick update and the two insight panels', () => {
    expect(page).toContain('Aggiorna tutto in 2 minuti')
    expect(page).toContain('Da cosa nasce il risultato')
    expect(page).toContain('Composizione investimenti')
    expect(page).toContain('I trasferimenti tra conti e portafogli non sono rendimento')
  })

  it('records a consolidated snapshot after manual value updates', () => {
    expect(patchRoute).toContain('recordConsolidatedPatrimonioSnapshot')
  })
})
