import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard for the production bug: reports/page.tsx used to seed its
 * filter state with `useState(() => initialParams())`, where initialParams read
 * `window.location.search` directly. That lazy initializer runs exactly once, at
 * mount — Next.js App Router reuses the same mounted page instance when
 * navigating between two /reports?... URLs (same route, only the query string
 * changes), so the component never noticed tpl/range/type actually changing:
 * every template looked identical because none of them were ever applied after
 * the very first render.
 *
 * There is no React Testing Library in this repo (no way to mount the component
 * and simulate a client-side navigation), so this guard asserts the fix at the
 * source level: the page must read live search params via the Next.js router
 * hook (the only thing that re-renders this component on a search-param-only
 * navigation) and must never reintroduce the one-shot window.location pattern.
 */

const PAGE_SOURCE = readFileSync(
  join(process.cwd(), 'src/app/(app)/reports/page.tsx'),
  'utf-8',
)

describe('reports/page.tsx wiring (fix for the frozen tpl/range/type bug)', () => {
  it('reads search params via the reactive useSearchParams() hook', () => {
    expect(PAGE_SOURCE).toMatch(/import\s*\{[^}]*useSearchParams[^}]*\}\s*from\s*'next\/navigation'/)
    expect(PAGE_SOURCE).toMatch(/useSearchParams\(\)/)
  })

  it('does not reintroduce the one-shot window.location-seeded useState pattern', () => {
    expect(PAGE_SOURCE).not.toMatch(/useState\(\s*\(\)\s*=>\s*initialParams\(\)\s*\)/)
    expect(PAGE_SOURCE).not.toContain('window.location.search')
  })

  it('updates the URL through the Next.js router (router.replace), not a manual history mutation', () => {
    expect(PAGE_SOURCE).toMatch(/useRouter\(\)/)
    expect(PAGE_SOURCE).toMatch(/router\.replace\(/)
    expect(PAGE_SOURCE).not.toContain('window.history.replaceState')
  })

  it('wraps the page in a Suspense boundary, as required by useSearchParams() and to avoid a hydration mismatch', () => {
    expect(PAGE_SOURCE).toMatch(/<Suspense[\s\S]*?<ReportsPageContent\s*\/>[\s\S]*?<\/Suspense>/)
  })

  it('derives params from the live searchParams on every render (useMemo keyed on searchParams), not from a one-time useState', () => {
    expect(PAGE_SOURCE).toMatch(/const params = useMemo\(\(\) => resolveInitialFilters\(new URLSearchParams\(searchParams\.toString\(\)\)\), \[searchParams\]\)/)
  })
})
