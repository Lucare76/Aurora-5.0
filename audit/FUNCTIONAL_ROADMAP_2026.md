# Aurora 5.0 - Functional roadmap 2026

Roadmap proposta con sprint piccoli da 2-6 ore. Obiettivo: aumentare fiducia, chiarezza e velocita' senza allargare troppo il prodotto.

## Sprint 1 - Onboarding e linguaggio coerente

Obiettivo: far capire a un nuovo utente cosa fare nei primi 5 minuti.

Problemi risolti: F-01, F-09, F-19, F-26.

File/aree coinvolte:

- Dashboard empty state;
- layout/nav;
- testi Transazioni/Giroconti;
- empty state Conti/Categorie/Transazioni.

Rischio: basso.

Sforzo: 4-6 ore.

Valore utente: riduce incertezza iniziale e concetti ambigui.

Criteri di accettazione:

- checklist iniziale visibile se mancano conti/transazioni;
- "Transfer" sostituito con "Giroconto";
- empty state indicano prossimo passo;
- microcopy giroconto spiega neutralita' su patrimonio.

## Sprint 2 - Fiducia backup e restore

Obiettivo: rendere chiaro come recuperare i dati.

Problemi risolti: F-02.

File/aree coinvolte:

- Impostazioni/Dati;
- export JSON;
- documentazione in-app;
- eventuale flusso restore in area separata.

Rischio: medio.

Sforzo: 6 ore per primo livello documentato; oltre se restore operativo completo.

Valore utente: fiducia per uso pluriennale.

Criteri di accettazione:

- backup JSON indica cosa contiene;
- messaggio chiaro su ripristino supportato/non supportato;
- se implementato restore: anteprima, conferma, nessuna sovrascrittura silenziosa.

## Sprint 3 - Import sicuro e annullabile

Obiettivo: ridurre ansia e rischio negli import.

Problemi risolti: F-03, F-10, F-11, F-15, F-24.

File/aree coinvolte:

- Importa estratti;
- Transazioni import CSV;
- Conti;
- messaggi conferma.

Rischio: medio-alto.

Sforzo: 6 ore per UX/feedback; piu' se rollback tecnico completo.

Valore utente: import piu' affidabile, meno paura di duplicare dati.

Criteri di accettazione:

- riepilogo finale import chiaro;
- spiegazione duplicati e giroconti;
- conti import configurabili o selezionabili;
- conferma forte prima di import massivo;
- azioni distruttive spiegano effetto.

## Sprint 4 - Ricorrenze trasparenti

Obiettivo: far capire cosa verra' creato e quando.

Problemi risolti: F-04, F-23.

File/aree coinvolte:

- Ricorrenti;
- Dashboard scadenze;
- messaggi errore/successo.

Rischio: medio.

Sforzo: 4-6 ore.

Valore utente: evita duplicati e aumenta controllo.

Criteri di accettazione:

- anteprima prossime 3 occorrenze;
- stato "auto-crea" spiegato;
- messaggi duplicato/errore comprensibili;
- pausa/riprendi chiaramente distinguibili.

## Sprint 5 - Dashboard decisionale e budget pratici

Obiettivo: trasformare dati in suggerimenti.

Problemi risolti: F-07, F-12.

File/aree coinvolte:

- Dashboard;
- Budget.

Rischio: basso-medio.

Sforzo: 4-6 ore.

Valore utente: l'utente capisce subito cosa richiede attenzione.

Criteri di accettazione:

- sezione "Da controllare";
- budget oltre soglia con testo azione;
- periodo di riferimento esplicito nei widget;
- widget secondari non oscurano le metriche principali.

## Sprint 6 - Inserimento movimenti piu' rapido

Obiettivo: ridurre tempo/click per spese ricorrenti o comuni.

Problemi risolti: F-08, F-14, F-17, F-27.

File/aree coinvolte:

- Transazioni;
- Categorie.

Rischio: medio.

Sforzo: 4-6 ore.

Valore utente: uso quotidiano piu' veloce.

Criteri di accettazione:

- duplicazione movimento;
- ultimo conto/categoria ricordati;
- ricerca categoria piu' rapida;
- prevenzione duplicati categoria almeno via warning.

## Sprint 7 - Mobile hardening

Obiettivo: rendere smartphone realmente comodo per i flussi frequenti.

Problemi risolti: F-06, F-20, F-22.

File/aree coinvolte:

- layout mobile;
- Transazioni;
- Conti;
- Report;
- Import.

Rischio: medio.

Sforzo: 6 ore.

Valore utente: migliore uso quotidiano fuori casa.

Criteri di accettazione:

- nessun testo critico tagliato;
- tap target principali adeguati;
- tabelle con alternative card dove serve;
- import/report dichiarati come desktop-first se non ottimizzati.

## Sprint 8 - Prestiti realmente operativi

Obiettivo: distinguere prestiti semplici da gestione rateale.

Problemi risolti: F-05.

File/aree coinvolte:

- Prestiti;
- Transazioni, se si collega pagamento.

Rischio: medio-alto.

Sforzo: 6 ore per chiarimento e collegamento base; oltre per rate/interessi completi.

Valore utente: prestiti meno descrittivi, piu' affidabili.

Criteri di accettazione:

- spiegazione limiti modulo;
- pagamento prestito collegabile a movimento;
- residuo sempre chiaro;
- eventuale campo interessi o nota esplicita "non gestisce interessi".

## Sprint 9 - Ricerca e report per storico lungo

Obiettivo: rendere 20 anni di dati consultabili.

Problemi risolti: F-13, F-16, F-25.

File/aree coinvolte:

- Transazioni;
- Report;
- Dashboard.

Rischio: medio.

Sforzo: 6 ore per preset e ricerca migliorata.

Valore utente: ritrovare dati velocemente anche con molto storico.

Criteri di accettazione:

- preset periodo;
- filtri salvabili o ripristinabili;
- ricerca globale minima o linkata a transazioni;
- report piu' leggibili su periodi lunghi.

## Sprint 10 - Fiducia e controllo avanzato

Obiettivo: far vedere cosa e' cambiato e personalizzare le viste.

Problemi risolti: F-18, F-28.

File/aree coinvolte:

- Impostazioni;
- Dashboard;
- Transazioni;
- eventuale audit log visibile.

Rischio: medio.

Sforzo: 4-6 ore per primo livello.

Valore utente: maggiore controllo per uso pluriennale.

Criteri di accettazione:

- cronologia ultime azioni importanti;
- preferenza vista predefinita;
- spiegazione delle modifiche critiche.

## Sprint 11 - Razionalizzazione funzioni laterali

Obiettivo: ridurre rumore senza rimuovere valore.

Problemi risolti: F-21.

File/aree coinvolte:

- Dashboard;
- Compleanni;
- navigazione mobile "Altro".

Rischio: basso.

Sforzo: 2-3 ore.

Valore utente: dashboard piu' focalizzata sulla finanza.

Criteri di accettazione:

- compleanni restano disponibili;
- widget secondari non competono con finanza;
- navigazione mantiene accesso rapido ma non prioritario.

## Prossimo sprint consigliato

**Sprint 1 - Onboarding e linguaggio coerente.**

Motivo: e' a basso rischio, non tocca logica contabile, migliora subito nuovo utente e riduce confusione in tutto il prodotto.
