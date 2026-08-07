import { describe, expect, it } from 'vitest'
import { issueStatusLabel, severityLabel, statusToneFromIssueStatus, statusToneFromSeverity } from '@/components/ui/status-badge'

describe('status badge mapping', () => {
  it('maps data integrity severity to consistent tones and Italian labels', () => {
    expect(statusToneFromSeverity('CRITICAL')).toBe('critical')
    expect(statusToneFromSeverity('WARNING')).toBe('warning')
    expect(statusToneFromSeverity('INFO')).toBe('info')
    expect(severityLabel('CRITICAL')).toBe('Critico')
    expect(severityLabel('WARNING')).toBe('Da controllare')
    expect(severityLabel('INFO')).toBe('Informazione')
  })

  it('maps issue statuses to user-facing Italian labels', () => {
    expect(statusToneFromIssueStatus('open')).toBe('info')
    expect(statusToneFromIssueStatus('acknowledged')).toBe('warning')
    expect(statusToneFromIssueStatus('ignored')).toBe('neutral')
    expect(statusToneFromIssueStatus('resolved')).toBe('success')
    expect(statusToneFromIssueStatus('stale')).toBe('neutral')
    expect(issueStatusLabel('stale')).toBe('Non più rilevata')
  })
})
