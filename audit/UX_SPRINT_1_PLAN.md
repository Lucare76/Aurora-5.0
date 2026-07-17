# UX Sprint 1 - Piano

## Obiettivo

Migliorare la prima esperienza d'uso di Aurora 5.0 senza introdurre nuove funzionalita' contabili e senza modificare database, API, RPC, import, export, report o calcoli.

## Analisi interfaccia esistente

### Testi poco chiari o non uniformi

- La navigazione usa "Transazioni", mentre diversi stati vuoti e descrizioni usano "movimenti".
- Nel form movimenti il tipo "transfer" appare come "Transfer", mentre nel resto dell'app il concetto e' espresso come "Giroconto" o trasferimento.
- Alcuni empty state spiegano cosa manca, ma non sempre indicano chiaramente quale pulsante usare.
- La Dashboard orienta bene quando mancano conti, ma non mostra una sequenza completa di primo utilizzo.

### Pulsanti con naming migliorabile

- "Nuova transazione" puo' essere reso piu' naturale come "Nuovo movimento".
- "Importa CSV" e "Importa estratti conto" sono entrambi validi, ma vanno spiegati meglio per evitare confusione.
- "Nuovo" in Ricorrenti e Compleanni e' comprensibile nel contesto, ma meno descrittivo di "Nuova ricorrenza" o "Nuovo compleanno".

### Pagine prive di spiegazione sufficiente

- Dashboard: manca una checklist iniziale per i primi passi.
- Budget: serve una frase breve che spieghi a cosa serve il budget.
- Ricorrenti: serve una frase breve sull'auto-creazione dei movimenti futuri.
- Prestiti: serve una frase breve su capitale residuo e pagamenti.
- Trasferimenti: serve una frase breve sulla neutralita' patrimoniale.

### Stati vuoti da migliorare

- Transazioni/Movimenti: deve indicare di usare "Nuovo movimento".
- Categorie: puo' spiegare categoria/sottocategoria.
- Budget: puo' spiegare che monitora spesa rispetto a obiettivo.
- Ricorrenti: puo' spiegare generazione futura.
- Prestiti: puo' spiegare residuo e pagamenti.

### Terminologia scelta

- Movimento: registrazione generale in entrata, uscita o trasferimento.
- Trasferimento: spostamento tra due conti, neutro sul patrimonio.
- Conto: luogo in cui si trova il denaro.
- Categoria/Sottocategoria: classificazione dei movimenti.
- Entrata/Uscita: flusso positivo/negativo reale.
- Budget: obiettivo di spesa per periodo/categoria.
- Prestito: denaro dato o ricevuto con capitale residuo.

## Implementazione prevista

- Aggiungere una checklist di primo utilizzo in Dashboard.
- Farla apparire solo quando i passi principali non sono completati.
- Aggiornare microcopy e empty state delle pagine principali.
- Uniformare "Transazioni" verso "Movimenti" dove visibile all'utente, senza rinominare route o logica.
- Uniformare "Transfer" verso "Trasferimento".
- Aggiungere test per il nuovo componente checklist.

## Vincoli rispettati

- Nessuna modifica a DB.
- Nessuna migration.
- Nessuna modifica API/RPC.
- Nessuna modifica a logica contabile, AppTransaction, calcoli, report, import/export.
- Nessun commit/push durante lo sprint.
