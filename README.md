# Aurora 5.0

Applicazione personale per gestione finanziaria, pianificazione e strumenti operativi, basata su Next.js e Supabase.

## Stato

Aurora 5.0 e in produzione su `https://aurora-5-0.vercel.app`.

La baseline attuale include:

- mutazioni finanziarie protette e hardening del ledger prestiti;
- CI con typecheck, test, production build e Playwright E2E, inclusi movimento → saldo, giroconto e riconciliazione → Patrimonio;
- onboarding guidato;
- osservabilita e health check produzione;
- navigazione desktop/mobile raggruppata per aree prodotto;
- backup/restore e controlli di integrita dati.

## Documentazione operativa

- `audit/AURORA_5_PRODUCTION_READINESS_2026-09-25.md` — fotografia corrente dello stato prodotto, dei flussi E2E critici e del debito tecnico residuo.
- `audit/AURORA_5_PRODUCTION_READINESS_2026-09-17.md` — snapshot precedente, mantenuto come storico.
- `docs/PRODUCTION_RUNBOOK.md` — controlli post-deploy, health check, rollback e smoke test.
- `audit/AUDIT_COMPLETO_AURORA_5.md` — audit storico di luglio 2026; non rappresenta piu lo stato corrente di tutte le aree.

## Sviluppo

Il flusso raccomandato e: branch dedicato -> pull request -> CI verde -> Vercel Preview verde -> merge su `main` -> smoke test produzione quando necessario.
