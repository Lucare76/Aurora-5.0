import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('mobile hardening guards', () => {
  it('keeps the app shell narrow-screen safe', () => {
    const source = readFileSync('src/components/app-layout-client.tsx', 'utf8')
    expect(source).toContain('overflow-x-clip')
    expect(source).toContain('min-[360px]:grid-cols-2')
    expect(source).toContain('min-[340px]:block')
    expect(source).toContain('min-w-0 max-w-7xl')
  })

  it('keeps dense financial tables locally scrollable instead of widening the page', () => {
    const accounts = readFileSync('src/app/(app)/accounts/page.tsx', 'utf8')
    const transactions = readFileSync('src/app/(app)/transactions/page.tsx', 'utf8')
    const reports = readFileSync('src/app/(app)/reports/page.tsx', 'utf8')
    const imports = readFileSync('src/app/(app)/import-estratti/page.tsx', 'utf8')

    expect(accounts).toContain('overflow-x-auto overscroll-x-contain')
    expect(transactions).toContain('max-h-72 overflow-auto overscroll-x-contain')
    expect(transactions).toContain('min-w-[640px]')
    expect(reports).toContain('overflow-x-auto overscroll-x-contain')
    expect(reports).toContain('min-w-[680px]')
    expect(imports).toContain('overflow-x-auto overscroll-x-contain')
    expect(imports).toContain('min-w-[920px]')
  })

  it('stacks patrimonio metrics and actions before they become cramped', () => {
    const source = readFileSync('src/app/(app)/patrimonio/page.tsx', 'utf8')
    expect(source).toContain('min-[390px]:grid-cols-3')
    expect(source).toContain('min-[360px]:flex-row')
    expect(source).toContain('w-[calc(100vw-1.5rem)]')
  })
})
