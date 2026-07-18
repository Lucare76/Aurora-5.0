-- Backup/Restore untouched.
-- Fix minimale per HTTP 500 su Supabase Auth signup:
-- rende il trigger profilo idempotente, null-safe e con search_path esplicito.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'display_name',
        new.raw_user_meta_data ->> 'full_name',
        split_part(coalesce(new.email, ''), '@', 1),
        ''
      )
    ),
    ''
  );

  insert into public.profiles (
    id,
    display_name,
    currency,
    locale,
    timezone,
    onboarding_done
  )
  values (
    new.id,
    v_display_name,
    'EUR',
    'it-IT',
    'Europe/Rome',
    false
  )
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();

  return new;
exception
  when others then
    raise log 'handle_new_user failed for auth user %, sqlstate %, message %',
      new.id,
      sqlstate,
      sqlerrm;
    raise;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;
