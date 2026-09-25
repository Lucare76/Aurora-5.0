import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const deadlines = readFileSync('src/app/(app)/deadlines/DeadlinesPageClient.tsx', 'utf8')
const transactions = readFileSync('src/app/(app)/transactions/page.tsx', 'utf8')
const importStatements = readFileSync('src/app/(app)/import-estratti/page.tsx', 'utf8')
const leave = readFileSync('src/app/(app)/leave/LeavePageClient.tsx', 'utf8')
const travel = readFileSync('src/app/(app)/affordability/TravelEvaluation.tsx', 'utf8')
const notifications = readFileSync('src/app/api/notifications/daily-check/route.ts', 'utf8')

describe('Italian date formatting in user-facing views', () => {
  it('formats deadline dates instead of rendering raw ISO strings', () => {
    expect(deadlines).toContain('formatDate(deadline.due_date)')
    expect(deadlines).not.toContain('{deadline.due_date} ·')
  })

  it('formats dates in import previews and leave history', () => {
    expect(transactions).toContain('formatDate(row.date)')
    expect(importStatements).toContain('formatDate(pair.bancRow.date)')
    expect(importStatements).toContain('formatDate(pair.amexRow.date)')
    expect(leave).toContain('formatDate(entry.start_date)')
    expect(leave).toContain('formatDate(entry.end_date)')
  })

  it('formats travel payment and notification dates', () => {
    expect(travel).toContain('formatDate(payment.date)')
    expect(notifications).toContain('formatDate(nextDue)')
    expect(notifications).toContain('formatDate(r.next_due_date)')
  })
})
