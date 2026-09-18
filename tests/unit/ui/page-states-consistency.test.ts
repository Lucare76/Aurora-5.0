import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const component = readFileSync('src/components/shared/PageState.tsx', 'utf8')

describe('shared page states', () => {
  it('provides accessible loading and empty states', () => {
    expect(component).toContain('role="status"')
    expect(component).toContain('aria-live="polite"')
    expect(component).toContain('motion-reduce:animate-none')
    expect(component).toContain('InlineEmptyState')
  })

  it.each([
    'src/app/(app)/adi/AdiPageClient.tsx',
    'src/app/(app)/aurora/AuroraPageClient.tsx',
    'src/app/(app)/timeline/TimelinePageClient.tsx',
    'src/app/(app)/deadlines/DeadlinesPageClient.tsx',
    'src/app/(app)/leave/LeavePageClient.tsx',
    'src/app/(app)/reconciliation/page.tsx',
    'src/app/(app)/scenarios/page.tsx',
  ])('uses the shared states in %s', (path) => {
    expect(readFileSync(path, 'utf8')).toContain("@/components/shared/PageState")
  })
})
