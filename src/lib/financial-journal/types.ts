export type JournalInsightTone = 'POSITIVE' | 'WARNING' | 'INFO'

export type JournalInsight = {
  id: string
  tone: JournalInsightTone
  title: string
  message: string
  href: string
}

export type FinancialMonthClosure = {
  id: string
  period_key: string
  period_start: string
  period_end: string
  income: number
  expenses: number
  savings: number
  savings_rate: number | null
  account_net_worth: number
  consolidated_net_worth: number
  investment_value: number
  transaction_count: number
  top_expense_category: string | null
  top_expense_amount: number
  generated_insights: JournalInsight[]
  closed_at: string
}

export type FinancialClosurePreview = Omit<FinancialMonthClosure, 'id' | 'closed_at' | 'generated_insights'> & {
  generated_insights: JournalInsight[]
}

export type FinancialTimelineEvent = {
  id: string
  date: string
  type: 'CLOSURE' | 'PATRIMONY' | 'INCOME' | 'EXPENSE' | 'BUDGET'
  title: string
  description: string
  amount: number | null
  tone: JournalInsightTone
}

export type FinancialJournalPayload = {
  preview: FinancialClosurePreview
  closures: FinancialMonthClosure[]
  insights: JournalInsight[]
  timeline: FinancialTimelineEvent[]
  staleInvestmentCount: number
  generatedAt: string
}
