-- Future installments are metadata only: this migration never posts transactions.
alter table public.installment_plans add column schedule jsonb;
alter table public.installment_plans add constraint installment_schedule_valid check (
  schedule is null or (
    jsonb_typeof(schedule) = 'object'
    and schedule ?& array['amount','frequency','interval','first_due_date','first_installment_number','paused']
    and jsonb_typeof(schedule->'amount') = 'number'
    and (schedule->>'amount')::numeric > 0 and (schedule->>'amount')::numeric <= 1000000000
    and round((schedule->>'amount')::numeric,2) = (schedule->>'amount')::numeric
    and schedule->>'frequency' in ('monthly','weekly')
    and jsonb_typeof(schedule->'interval') = 'number'
    and (schedule->>'interval')::numeric between 1 and 12
    and trunc((schedule->>'interval')::numeric) = (schedule->>'interval')::numeric
    and jsonb_typeof(schedule->'first_installment_number') = 'number'
    and (schedule->>'first_installment_number')::numeric between 1 and total_installments
    and trunc((schedule->>'first_installment_number')::numeric) = (schedule->>'first_installment_number')::numeric
    and schedule->>'first_due_date' ~ '^\d{4}-\d{2}-\d{2}$'
    and to_char((schedule->>'first_due_date')::date, 'YYYY-MM-DD') = schedule->>'first_due_date'
    and jsonb_typeof(schedule->'paused') = 'boolean'
  ) is true
);
create policy "Update own installment schedule" on public.installment_plans
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant update(schedule) on public.installment_plans to authenticated;

create or replace function public.update_installment_schedule(p_plan_id uuid, p_schedule jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.installment_plans set schedule = p_schedule
    where id=p_plan_id and user_id=auth.uid();
  if not found then raise exception 'Installment plan not found'; end if;
end;
$$;
revoke all on function public.update_installment_schedule(uuid,jsonb) from public, anon;
grant execute on function public.update_installment_schedule(uuid,jsonb) to authenticated;

create or replace function public.restore_aurora_backup_with_installments(
  p_token_id uuid, p_token text, p_backup jsonb
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_plans integer := jsonb_array_length(coalesce(p_backup #> '{data,installmentPlans}', '[]'::jsonb));
  v_payments integer := jsonb_array_length(coalesce(p_backup #> '{data,installmentPayments}', '[]'::jsonb));
  v_inserted integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  -- If any metadata fails validation, the base restore and token use roll back too.
  v_result := public.restore_aurora_backup_v1_empty_account(p_token_id, p_token, p_backup);
  create temporary table _installment_plan_map (
    src_id uuid primary key, dst_id uuid not null
  ) on commit drop;
  insert into _installment_plan_map(src_id,dst_id)
    select x.id, gen_random_uuid()
    from jsonb_to_recordset(coalesce(p_backup #> '{data,installmentPlans}', '[]'::jsonb)) x(id uuid);
  insert into public.installment_plans(id,user_id,title,total_installments,created_at,schedule)
    select m.dst_id,v_uid,x.title,x.total_installments,coalesce(x.created_at,now()),x.schedule
    from jsonb_to_recordset(coalesce(p_backup #> '{data,installmentPlans}', '[]'::jsonb))
      x(id uuid,title text,total_installments integer,created_at timestamptz,schedule jsonb)
    join _installment_plan_map m on m.src_id=x.id;
  get diagnostics v_inserted = row_count;
  if v_inserted <> v_plans then raise exception 'INVALID_BACKUP'; end if;
  insert into public.installment_payments(transaction_id,plan_id,user_id,installment_number)
    select tm.dst_id,pm.dst_id,v_uid,x.installment_number
    from jsonb_to_recordset(coalesce(p_backup #> '{data,installmentPayments}', '[]'::jsonb))
      x(transaction_id uuid,plan_id uuid,installment_number integer)
    join _txn_map tm on tm.src_id=x.transaction_id
    join _installment_plan_map pm on pm.src_id=x.plan_id
    join public.transactions t on t.id=tm.dst_id and t.user_id=v_uid and t.type='expense';
  get diagnostics v_inserted = row_count;
  if v_inserted <> v_payments then raise exception 'INVALID_BACKUP'; end if;
  return v_result;
end;
$$;
revoke all on function public.restore_aurora_backup_with_installments(uuid,text,jsonb) from public, anon;
grant execute on function public.restore_aurora_backup_with_installments(uuid,text,jsonb) to authenticated;
