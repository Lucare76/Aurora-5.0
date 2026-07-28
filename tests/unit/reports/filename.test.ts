import { describe, expect, it } from 'vitest'
import { buildReportFilename } from '@/lib/reports/filename'

describe('buildReportFilename', () => {
  it('generates CSV filename with type label', () => {
    const name = buildReportFilename('2026-01-01', '2026-01-31', 'MONTHLY', 'csv')
    expect(name).toBe('aurora-mensile-2026-01-01-2026-01-31.csv')
  })

  it('generates XLSX filename with type label', () => {
    const name = buildReportFilename('2026-01-01', '2026-01-31', 'MONTHLY', 'xlsx')
    expect(name).toBe('aurora-mensile-2026-01-01-2026-01-31.xlsx')
  })

  it('uses fallback "report" label when type is null', () => {
    const name = buildReportFilename('2026-03-01', '2026-03-31', null, 'csv')
    expect(name).toBe('aurora-report-2026-03-01-2026-03-31.csv')
  })

  it('generates correct label for ANNUAL', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'ANNUAL', 'xlsx')
    expect(name).toBe('aurora-annuale-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for INCOME', () => {
    const name = buildReportFilename('2026-01-01', '2026-06-30', 'INCOME', 'csv')
    expect(name).toBe('aurora-entrate-2026-01-01-2026-06-30.csv')
  })

  it('generates correct label for EXPENSES', () => {
    const name = buildReportFilename('2026-01-01', '2026-06-30', 'EXPENSES', 'csv')
    expect(name).toBe('aurora-uscite-2026-01-01-2026-06-30.csv')
  })

  it('generates correct label for CASH_FLOW', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'CASH_FLOW', 'xlsx')
    expect(name).toBe('aurora-cashflow-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for NET_WORTH', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'NET_WORTH', 'xlsx')
    expect(name).toBe('aurora-patrimonio-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for FINANCIAL_HEALTH', () => {
    const name = buildReportFilename('2026-01-01', '2026-01-31', 'FINANCIAL_HEALTH', 'csv')
    expect(name).toBe('aurora-salute-finanziaria-2026-01-01-2026-01-31.csv')
  })

  it('generates correct label for SCENARIOS', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'SCENARIOS', 'xlsx')
    expect(name).toBe('aurora-scenari-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for CATEGORIES', () => {
    const name = buildReportFilename('2026-01-01', '2026-03-31', 'CATEGORIES', 'csv')
    expect(name).toBe('aurora-categorie-2026-01-01-2026-03-31.csv')
  })

  it('generates correct label for TRANSACTIONS', () => {
    const name = buildReportFilename('2026-01-01', '2026-01-31', 'TRANSACTIONS', 'csv')
    expect(name).toBe('aurora-movimenti-2026-01-01-2026-01-31.csv')
  })

  it('generates correct label for QUARTERLY', () => {
    const name = buildReportFilename('2026-01-01', '2026-03-31', 'QUARTERLY', 'csv')
    expect(name).toBe('aurora-trimestrale-2026-01-01-2026-03-31.csv')
  })

  it('generates correct label for CUSTOM', () => {
    const name = buildReportFilename('2026-02-01', '2026-05-31', 'CUSTOM', 'csv')
    expect(name).toBe('aurora-personalizzato-2026-02-01-2026-05-31.csv')
  })

  it('generates correct label for ACCOUNTS', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'ACCOUNTS', 'xlsx')
    expect(name).toBe('aurora-conti-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for BUDGETS', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'BUDGETS', 'xlsx')
    expect(name).toBe('aurora-budget-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for GOALS', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'GOALS', 'xlsx')
    expect(name).toBe('aurora-obiettivi-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for LOANS', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'LOANS', 'csv')
    expect(name).toBe('aurora-prestiti-2026-01-01-2026-12-31.csv')
  })

  it('generates correct label for RECURRING', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'RECURRING', 'csv')
    expect(name).toBe('aurora-ricorrenti-2026-01-01-2026-12-31.csv')
  })

  it('generates correct label for DATA_INTEGRITY', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'DATA_INTEGRITY', 'xlsx')
    expect(name).toBe('aurora-integrita-dati-2026-01-01-2026-12-31.xlsx')
  })

  it('generates correct label for TAGS', () => {
    const name = buildReportFilename('2026-01-01', '2026-12-31', 'TAGS', 'csv')
    expect(name).toBe('aurora-tag-2026-01-01-2026-12-31.csv')
  })

  it('falls back to type.toLowerCase() for unknown type code', () => {
    // This branch is unreachable with valid ReportTypeCode but must be covered
    const name = buildReportFilename('2026-01-01', '2026-01-31', 'UNKNOWN_FUTURE_TYPE' as never, 'csv')
    expect(name).toBe('aurora-unknown_future_type-2026-01-01-2026-01-31.csv')
  })
})
