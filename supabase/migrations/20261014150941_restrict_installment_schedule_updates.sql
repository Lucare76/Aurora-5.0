-- The invoker RPC can edit schedule metadata only; other plan fields stay RPC-managed.
revoke update on public.installment_plans from authenticated;
grant update(schedule) on public.installment_plans to authenticated;
