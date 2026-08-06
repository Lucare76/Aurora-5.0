import { describe, expect, it } from 'vitest'
import { getMoreItems, getNavItems } from '@/components/app-layout-client'
import { getQuickCommands } from '@/components/global-command-menu'

describe('private finance navigation visibility', () => {
  it('non include Aurora e ADI in sidebar e mobile per utenti non autorizzati', () => {
    expect(getNavItems(false).some((item) => item.path === '/aurora' || item.path === '/adi')).toBe(false)
    expect(getMoreItems(false).some((item) => item.path === '/aurora' || item.path === '/adi')).toBe(false)
  })

  it('include Aurora e ADI in sidebar e mobile per utenti autorizzati', () => {
    expect(getNavItems(true).some((item) => item.path === '/aurora')).toBe(true)
    expect(getNavItems(true).some((item) => item.path === '/adi')).toBe(true)
    expect(getMoreItems(true).some((item) => item.path === '/aurora')).toBe(true)
    expect(getMoreItems(true).some((item) => item.path === '/adi')).toBe(true)
  })

  it('non include comandi privati nel command menu per utenti non autorizzati', () => {
    expect(getQuickCommands(false).some((command) => command.href.startsWith('/aurora') || command.href.startsWith('/adi'))).toBe(false)
  })

  it('include comandi privati nel command menu per utenti autorizzati', () => {
    expect(getQuickCommands(true).filter((command) => command.href.startsWith('/aurora') || command.href.startsWith('/adi')).map((command) => command.id)).toEqual([
      'aurora-savings-open',
      'aurora-new-account',
      'aurora-new-income',
      'aurora-new-transfer',
      'adi-open',
      'adi-credit',
      'adi-debit',
    ])
  })
})
