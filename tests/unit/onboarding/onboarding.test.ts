import { describe, expect, it } from 'vitest'

import { isOnboardingCoreComplete, onboardingProgress, type OnboardingStatus } from '@/lib/onboarding'

function status(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    onboardingDone: false,
    hasAccount: false,
    hasCategory: false,
    hasMovement: false,
    hasBudget: false,
    ...overrides,
  }
}

describe('guided onboarding', () => {
  it('requires account, category and movement to complete the core setup', () => {
    expect(isOnboardingCoreComplete(status())).toBe(false)
    expect(isOnboardingCoreComplete(status({ hasAccount: true, hasCategory: true }))).toBe(false)
    expect(isOnboardingCoreComplete(status({ hasAccount: true, hasCategory: true, hasMovement: true }))).toBe(true)
  })

  it('does not require a budget to complete onboarding', () => {
    expect(isOnboardingCoreComplete(status({
      hasAccount: true,
      hasCategory: true,
      hasMovement: true,
      hasBudget: false,
    }))).toBe(true)
  })

  it('calculates progress only from the three required steps', () => {
    expect(onboardingProgress(status())).toBe(0)
    expect(onboardingProgress(status({ hasAccount: true }))).toBe(33)
    expect(onboardingProgress(status({ hasAccount: true, hasCategory: true }))).toBe(67)
    expect(onboardingProgress(status({ hasAccount: true, hasCategory: true, hasMovement: true }))).toBe(100)
  })
})
