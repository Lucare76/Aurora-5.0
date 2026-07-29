-- Migration 00029: rimuove la policy RLS extra su birthday_reminder_log.
--
-- Durante l'audit di sola lettura del 2026-07-29 e' stata rilevata sul
-- database remoto una policy "own reminder log" (ALL, user_id = auth.uid())
-- non tracciata da nessuna migrazione locale. La migrazione 00005 imposta
-- deliberatamente birthday_reminder_log come accessibile solo dal service
-- role (policy "Service role only" con using(false)); la policy extra
-- concedeva invece agli utenti autenticati accesso diretto in lettura/
-- scrittura/cancellazione al proprio log promemoria compleanni, ampliando
-- di fatto i permessi rispetto all'intento originale.
--
-- Verificato che nessuna funzione dell'app dipende da questo accesso diretto:
-- le uniche query client-side su questa tabella (backup export, restore
-- dry-run) sono gia' progettate per tollerare un risultato vuoto quando RLS
-- nega la lettura (vedi audit/BACKUP_SPRINT_3_RESULTS.md). L'unico accesso
-- funzionale reale avviene lato server con service role (cron promemoria
-- compleanni), che non e' soggetto a RLS.
--
-- Questa migrazione ripristina l'intento originale di 00005 rimuovendo la
-- policy non tracciata.

drop policy if exists "own reminder log"
  on public.birthday_reminder_log;
