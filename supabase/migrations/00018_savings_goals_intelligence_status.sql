-- Sprint 8B: clarify automatic savings goal status transitions.
-- Archived goals remain archived. Automatically completed goals return ACTIVE
-- when current_amount goes back below target_amount after contribution deletion.

create or replace function public.set_savings_goal_status()
returns trigger
language plpgsql
as $$
begin
  if new.archived or (tg_op = 'UPDATE' and old.status = 'ARCHIVED') then
    new.status := 'ARCHIVED';
  elsif new.current_amount >= new.target_amount then
    new.status := 'COMPLETED';
  elsif new.status = 'COMPLETED' and new.current_amount < new.target_amount then
    new.status := 'ACTIVE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
