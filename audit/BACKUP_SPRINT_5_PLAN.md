# Backup Sprint 5 - Plan

## Strategia atomica

Il restore reale viene abilitato solo per `empty_account_restore` e solo dopo
dry-run server-side con `readiness === "ready"`.

La scrittura dati viene delegata a una singola RPC PostgreSQL:

`restore_aurora_backup_v1_empty_account`

In PostgreSQL ogni chiamata funzione avviene dentro una transazione. Qualsiasi
eccezione sollevata dalla funzione annulla tutte le scritture fatte dalla
funzione stessa.

## File da creare

- migration Supabase per token, log tecnico e RPC atomica;
- `src/lib/backup/restore/prepare.ts`;
- `src/lib/backup/restore/restore-payload.ts`;
- `src/app/api/backup/restore/prepare/route.ts`;
- `src/app/api/backup/restore/route.ts`;
- test unit/API dedicati;
- documentazione Sprint 5.

## File da modificare

- `src/app/(app)/settings/page.tsx`;
- `src/lib/backup/restore/index.ts`;
- `src/lib/backup/index.ts`, se necessario;
- `src/types/database.ts`.

## RPC e SECURITY

La RPC sara `SECURITY DEFINER` con `set search_path = public, pg_temp`.

Motivazione:

- `birthday_reminder_log` ha policy RLS service-role-only;
- `audit_logs` non ha policy insert per utenti normali;
- il restore deve essere atomicamente completo senza sequenza client-side.

Guardrail:

- `auth.uid()` obbligatorio;
- nessun `user_id` accettato;
- nessun SQL dinamico;
- input ristretto JSON Backup v1;
- token monouso consumato dentro la RPC;
- lock advisory per utente;
- grant solo ad `authenticated`.

## Ordine reale scritture

1. token restore e lock;
2. controllo account vuoto;
3. profilo tecnico ristretto;
4. conti;
5. categorie padre;
6. sottocategorie;
7. prestiti;
8. ricorrenze;
9. transazioni normali;
10. trasferimenti validi;
11. pagamenti prestiti;
12. budget;
13. compleanni;
14. birthday reminder log;
15. audit log marcati come storico ripristinato;
16. verifiche finali conteggi/saldi.

## Ownership

La ownership deriva solo da `auth.uid()`. Qualsiasi `user_id` nel backup e'
ignorato.

## Conferma utente

Frase esatta:

`RIPRISTINA AURORA`

Il token dura 5 minuti, e' monouso e legato a utente, checksum, schemaVersion e
modalita.

## Idempotenza e replay

Il token viene salvato hashato e marcato `used_at` nella stessa transazione del
restore. Un secondo uso dello stesso token fallisce.

## Rollback

La prova di rollback si basa sulla singola transazione RPC. I test API mockano
il fallimento RPC; i test DB reali sono documentati come da eseguire in ambiente
Supabase locale quando Docker/Supabase locale sono disponibili.

## Rischi residui

- Senza ambiente Supabase locale non e' possibile eseguire qui una prova reale
  di rollback database.
- Il restore reale richiede applicazione migration su ambiente target.
- `ready_with_warnings` resta bloccato.
