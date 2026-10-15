-- A saved simulation, isolated from transactions and balances.
create function public.valid_seasonal_cash_config(c jsonb) returns boolean
language plpgsql immutable security invoker set search_path = public as $$
declare r jsonb; e jsonb; a numeric; k text; begin
  if jsonb_typeof(c) <> 'object' or not c ?& array['account_ids','reserve','monthly_extra_expenses','reviewed','months','commitments'] then return false; end if;
  if jsonb_typeof(c->'account_ids') <> 'array' or jsonb_array_length(c->'account_ids') not between 1 and 100 then return false; end if;
  for r in select * from jsonb_array_elements(c->'account_ids') loop perform (r #>> '{}')::uuid; end loop;
  if (select count(*) <> count(distinct value) from jsonb_array_elements(c->'account_ids')) then return false; end if;
  foreach k in array array['reserve','monthly_extra_expenses'] loop
    if jsonb_typeof(c->k) <> 'number' then return false; end if;
    a := (c->>k)::numeric; if a < 0 or a > 1000000000 or round(a,2) <> a then return false; end if;
  end loop;
  if jsonb_typeof(c->'reviewed') <> 'boolean' or jsonb_typeof(c->'months') <> 'array' or jsonb_array_length(c->'months') not between 1 and 24 or jsonb_typeof(c->'commitments') <> 'array' or jsonb_array_length(c->'commitments') > 100 then return false; end if;
  if (select count(*) <> count(distinct value->>'month') from jsonb_array_elements(c->'months')) then return false; end if;
  for r in select * from jsonb_array_elements(c->'months') loop
    if not r ?& array['month','kind','amount','day','confidence','received'] or (r->>'month') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or r->>'kind' not in ('SALARY','NASPI','OTHER','NONE') or r->>'confidence' not in ('CONFIRMED','ESTIMATED') or jsonb_typeof(r->'received') <> 'boolean' or jsonb_typeof(r->'amount') <> 'number' or jsonb_typeof(r->'day') <> 'number' then return false; end if;
    a := (r->>'amount')::numeric; if a < 0 or a > 1000000000 or round(a,2) <> a or (r->>'kind'='NONE' and a<>0) then return false; end if;
    a := (r->>'day')::numeric; if a < 1 or a > 31 or trunc(a) <> a then return false; end if;
    if r ? 'extra' then
      e := r->'extra';
      if not e ?& array['amount','day','confidence','received','label'] or jsonb_typeof(e->'amount') <> 'number' or jsonb_typeof(e->'day') <> 'number' or e->>'confidence' not in ('CONFIRMED','ESTIMATED') or jsonb_typeof(e->'received') <> 'boolean' or jsonb_typeof(e->'label') <> 'string' or length(btrim(e->>'label')) not between 1 and 100 then return false; end if;
      a := (e->>'amount')::numeric; if a < 0 or a > 1000000000 or round(a,2) <> a then return false; end if;
      a := (e->>'day')::numeric; if a < 1 or a > 31 or trunc(a) <> a then return false; end if;
    end if;
  end loop;
  if (select count(*) <> count(distinct value->>'id') from jsonb_array_elements(c->'commitments')) then return false; end if;
  for r in select * from jsonb_array_elements(c->'commitments') loop
    if not r ?& array['id','title','kind','amount','start_date','end_date','confidence'] then return false; end if;
    if jsonb_typeof(r->'title') <> 'string' then return false; end if;
    perform (r->>'id')::uuid;
    if length(btrim(r->>'title')) not between 1 and 100 or r->>'kind' not in ('FIXED','PAC','OTHER') or r->>'confidence' not in ('CONFIRMED','ESTIMATED') or jsonb_typeof(r->'amount') <> 'number' then return false; end if;
    a := (r->>'amount')::numeric; if a <= 0 or a > 1000000000 or round(a,2) <> a then return false; end if;
    foreach k in array array['start_date','end_date'] loop
      if (r->>k) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((r->>k)::date,'YYYY-MM-DD') <> r->>k then return false; end if;
    end loop;
    if (r->>'start_date')::date > (r->>'end_date')::date then return false; end if;
  end loop;
  -- Reject explicit JSON nulls, including required string properties.
  if jsonb_path_exists(c, '$.** ? (@ == null)') then return false; end if;
  return true;
exception when others then return false;
end; $$;
revoke all on function public.valid_seasonal_cash_config(jsonb) from public,anon;
grant execute on function public.valid_seasonal_cash_config(jsonb) to authenticated;
create table public.seasonal_cash_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null check (public.valid_seasonal_cash_config(config) is true),
  updated_at timestamptz not null default now()
);
alter table public.seasonal_cash_plans enable row level security;
revoke all on public.seasonal_cash_plans from anon,authenticated;
grant select,insert,update,delete on public.seasonal_cash_plans to authenticated;
create policy "Read own seasonal plan" on public.seasonal_cash_plans for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own seasonal plan" on public.seasonal_cash_plans for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own seasonal plan" on public.seasonal_cash_plans for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Delete own seasonal plan" on public.seasonal_cash_plans for delete to authenticated using ((select auth.uid())=user_id);

create function public.restore_aurora_backup_with_seasonal_plan(p_token_id uuid,p_token text,p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; c jsonb; mapped jsonb; original_count int; begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  result := public.restore_aurora_backup_with_installments(p_token_id,p_token,p_backup);
  c := p_backup #> '{data,seasonalPlan}';
  if c is not null and c <> 'null'::jsonb then
    if not public.valid_seasonal_cash_config(c) then raise exception 'INVALID_BACKUP'; end if;
    original_count := jsonb_array_length(c->'account_ids');
    select jsonb_agg(m.dst_id order by x.n) into mapped
      from jsonb_array_elements_text(c->'account_ids') with ordinality x(id,n)
      join _account_map m on m.src_id=x.id::uuid;
    if mapped is null or jsonb_array_length(mapped) <> original_count then raise exception 'INVALID_BACKUP'; end if;
    c := jsonb_set(jsonb_set(c,'{account_ids}',mapped),'{reviewed}','false'::jsonb);
    insert into public.seasonal_cash_plans(user_id,config) values(auth.uid(),c)
      on conflict(user_id) do update set config=excluded.config,updated_at=now();
  end if;
  return result;
end; $$;
revoke all on function public.restore_aurora_backup_with_seasonal_plan(uuid,text,jsonb) from public,anon;
grant execute on function public.restore_aurora_backup_with_seasonal_plan(uuid,text,jsonb) to authenticated;
