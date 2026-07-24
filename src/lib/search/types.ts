export type SearchResultType =
  | 'TRANSACTION'
  | 'ACCOUNT'
  | 'CATEGORY'
  | 'BUDGET'
  | 'GOAL'
  | 'LOAN'
  | 'RECURRENCE'

export type SearchResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  metadata: string[]
  href: string
  score: number
}

export type SearchGroup = {
  type: SearchResultType
  label: string
  results: SearchResult[]
}

export type SearchPayload = {
  query: string
  groups: SearchGroup[]
  totalResults: number
  truncated: boolean
}

export type QuickCommand = {
  id: string
  group: 'Azioni rapide' | 'Navigazione'
  title: string
  subtitle: string
  href: string
  keywords: string[]
}
