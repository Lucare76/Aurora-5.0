import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = readFileSync('src/app/api/aurora/route.ts', 'utf8')

describe('/api/aurora contract', () => {
  it('espone azioni server-side per conti, movimenti e giroconti Aurora', () => {
    for (const action of ['linkAccount', 'createAccount', 'updateAccount', 'createTransaction', 'updateTransaction', 'deleteTransaction', 'createTransfer']) {
      expect(route).toContain(`z.literal('${action}')`)
    }
  })

  it('impone lo scope Aurora lato server e non accetta user_id dal client', () => {
    expect(route).toContain('purpose: AURORA_SCOPE')
    expect(route).toContain('assertAuroraAccount')
    expect(route).not.toContain('body.user_id')
  })

  it('riusa la RPC atomica esistente per movimenti e giroconti', () => {
    expect(route.match(/create_transaction_atomic/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(route).toContain('update_transaction_atomic')
    expect(route).toContain('delete_transaction_atomic')
    expect(route).toContain("p_type: 'transfer'")
    expect(route).toContain('p_destination_account_id: body.destinationAccountId')
  })

  it('richiede motivazione quando il patrimonio Aurora torna verso personale', () => {
    expect(route).toContain("direction === 'AURORA_TO_PERSONAL'")
    expect(route).toContain('PERSONAL_DESTINATION_REASON_REQUIRED')
  })

  it('non usa service role nella route browser-facing', () => {
    expect(route).not.toMatch(/service[_-]?role/i)
  })
})
