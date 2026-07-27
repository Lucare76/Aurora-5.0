// Monetary utilities for the scenario engine.
// Uses the same plain-number + epsilon-rounding pattern as the rest of Aurora.
// Never use floating-point arithmetic for monetary sums without rounding.

const EPSILON = Number.EPSILON

export function roundMoney(value: number): number {
  return Math.round((value + EPSILON) * 100) / 100
}

export function addMoney(a: number, b: number): number {
  return roundMoney(a + b)
}

export function subtractMoney(a: number, b: number): number {
  return roundMoney(a - b)
}

export function multiplyMoney(amount: number, factor: number): number {
  return roundMoney(amount * factor)
}

export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + v, 0))
}

export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value)
}

export function clampAmount(value: number, min = 0): number {
  return Math.max(min, value)
}

// Distributes a total amount across n periods (handles rounding remainder in last period)
export function distributeEvenly(total: number, periods: number): number[] {
  if (periods <= 0) return []
  const base = roundMoney(total / periods)
  const remainder = roundMoney(total - base * (periods - 1))
  return Array.from({ length: periods }, (_, i) => (i === periods - 1 ? remainder : base))
}

// Average of amounts, rounded
export function averageMoney(values: number[]): number {
  if (values.length === 0) return 0
  return roundMoney(sumMoney(values) / values.length)
}
