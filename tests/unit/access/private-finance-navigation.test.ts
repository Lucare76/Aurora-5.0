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

  it('include Chiedi ad Aurora quando il flag server e attivo', () => {
    expect(getNavItems(false, true).map((item) => item.path)).toContain('/assistant')
    expect(getMoreItems(false, true).map((item) => item.path)).toContain('/assistant')
    expect(getQuickCommands(false, true).map((command) => command.href)).toContain('/assistant')
  })

  it('esclude Chiedi ad Aurora quando il flag server e disattivo', () => {
    expect(getNavItems(false, false).map((item) => item.path)).not.toContain('/assistant')
    expect(getMoreItems(false, false).map((item) => item.path)).not.toContain('/assistant')
    expect(getQuickCommands(false, false).some((command) => command.href.startsWith('/assistant'))).toBe(false)
  })

  it('mantiene ordine stabile con gli stessi input props', () => {
    const first = getNavItems(true, true).map((item) => item.path)
    const second = getNavItems(true, true).map((item) => item.path)
    expect(second).toEqual(first)
    expect(first.slice(0, 3)).toEqual(['/dashboard', '/assistant', '/transactions'])
  })

  it('gestisce insieme account privato e assistant senza cambiare ordine delle voci private', () => {
    const paths = getNavItems(true, true).map((item) => item.path)
    expect(paths).toContain('/assistant')
    expect(paths).toContain('/aurora')
    expect(paths).toContain('/adi')
    expect(paths.indexOf('/aurora')).toBeLessThan(paths.indexOf('/adi'))
  })
})
