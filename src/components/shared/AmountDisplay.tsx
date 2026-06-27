import { cn, formatCurrency } from '@/lib/utils'

interface AmountDisplayProps {
  amount: number
  type?: 'income' | 'expense' | 'neutral'
  currency?: string
  className?: string
}

export function AmountDisplay({ amount, type = 'neutral', currency = 'EUR', className }: AmountDisplayProps) {
  return (
    <span
      className={cn(
        'tabular-nums font-medium',
        type === 'income' && 'text-success',
        type === 'expense' && 'text-danger',
        className
      )}
    >
      {type === 'income' && '+'}
      {type === 'expense' && '-'}
      {formatCurrency(Math.abs(amount), currency)}
    </span>
  )
}
