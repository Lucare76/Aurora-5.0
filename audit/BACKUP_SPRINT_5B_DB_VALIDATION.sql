-- Backup Sprint 5B - DB/RPC validation harness
--
-- Uso previsto: Supabase locale/staging, mai produzione.
-- Questo file e' una traccia operativa: sostituire i placeholder con JWT
-- utente test e payload generato dai test fixture. Non contiene dati reali.
--
-- Obiettivi:
-- 1. dimostrare che la RPC esiste;
-- 2. dimostrare che anon non puo' chiamarla;
-- 3. dimostrare restore valido;
-- 4. dimostrare token monouso;
-- 5. dimostrare rollback su errore a meta' restore;
-- 6. dimostrare blocco account non vuoto.

-- Verifica oggetti.
select proname
from pg_proc
where proname = 'restore_aurora_backup_v1_empty_account';

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('backup_restore_tokens', 'backup_restore_runs');

-- Verifica grants RPC.
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'restore_aurora_backup_v1_empty_account';

-- Esempio setup auth context per test SQL diretto.
-- select set_config('request.jwt.claim.sub', '<TEST_USER_UUID>', true);
-- select set_config('request.jwt.claim.role', 'authenticated', true);

-- Inserire token tecnico come farebbe /api/backup/restore/prepare.
-- insert into public.backup_restore_tokens (
--   id, user_id, token_hash, backup_checksum, schema_version, mode, readiness, expires_at
-- ) values (
--   '<TOKEN_UUID>',
--   '<TEST_USER_UUID>',
--   encode(digest('<RAW_TOKEN>', 'sha256'), 'hex'),
--   '<BACKUP_CHECKSUM>',
--   1,
--   'empty_account_restore',
--   'ready',
--   now() + interval '5 minutes'
-- );

-- Restore valido.
-- select public.restore_aurora_backup_v1_empty_account(
--   '<TOKEN_UUID>'::uuid,
--   '<RAW_TOKEN>',
--   '<AURORA_BACKUP_V1_JSON>'::jsonb
-- );

-- Token monouso: deve fallire TOKEN_INVALID/TOKEN_ALREADY_USED.
-- select public.restore_aurora_backup_v1_empty_account(
--   '<TOKEN_UUID>'::uuid,
--   '<RAW_TOKEN>',
--   '<AURORA_BACKUP_V1_JSON>'::jsonb
-- );

-- Rollback: creare nuovo token e passare payload con FK volutamente mancante.
-- Dopo il fallimento, questi conteggi devono restare zero per il test user.
-- select count(*) from public.accounts where user_id = '<TEST_USER_UUID>';
-- select count(*) from public.transactions where user_id = '<TEST_USER_UUID>';
-- select count(*) from public.categories where user_id = '<TEST_USER_UUID>' and is_default is not true;

-- Account non vuoto: creare un conto test, poi chiamare RPC con nuovo token.
-- Deve fallire ACCOUNT_NOT_EMPTY e non inserire ulteriori record.
