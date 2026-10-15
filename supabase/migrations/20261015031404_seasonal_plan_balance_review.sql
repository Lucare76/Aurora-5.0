-- Mark previously reviewed plans stale when the underlying account balances change.
alter table public.seasonal_cash_plans add column balance_signature text
  check (balance_signature is null or balance_signature ~ '^[0-9a-f]{64}$');
