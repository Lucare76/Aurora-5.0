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

## Piano stagionale

In **Pianificazione → Piano stagionale** puoi simulare i prossimi 12 mesi con stipendio, NASpI e una seconda entrata mensile, distinguendo importi confermati, stimati e già incassati. Il modello 8 mesi/4 mesi è modificabile e richiede di scegliere il primo mese di stipendio; la NASpI rimane una stima inserita dall’utente.

La disponibilità spendibile usa la liquidità personale selezionata, protegge la riserva e considera il saldo minimo lungo il percorso (uscite prima degli incassi nello stesso giorno). Il limite prudente esclude entrate stimate, ma include tutte le uscite. Il saldo iniziale limita sempre quanto è spendibile oggi.

Uscite ricorrenti e rate pianificate sono incluse automaticamente. Le entrate ricorrenti vengono sostituite dagli importi mensili espliciti nella sola simulazione; gli importi già incassati non si aggiungono di nuovo al saldo. Spese quotidiane extra e impegni mensili/PAC mancanti vanno inseriti senza duplicare gli automatici. Gli impegni manuali anteriori a oggi sono esclusi: indica il prossimo addebito ancora da pagare. Budget e prestiti non rappresentati non vengono aggiunti automaticamente. Rivedi il piano dopo ogni incasso/addebito o variazione.

Il piano non crea transazioni, non cambia saldi, calendario o score. Il backup lo include e al ripristino rimappa i conti e richiede una nuova verifica. Conti investiti, ADI e fondi dei beneficiari sono esclusi; le carte personali con saldo negativo devono essere comprese. Nessuna disponibilità viene mostrata finché il piano non è verificato o se mancano mesi/conti.
