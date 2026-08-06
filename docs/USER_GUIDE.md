# Guida utente — Aurora

Aurora è uno strumento personale per tenere traccia delle proprie finanze. I dati vengono inseriti manualmente e restano separati per utente grazie all'autenticazione sicura. Aurora non è collegata alla banca e non accede a nessun conto esterno.

---

## Assistente finanziario read-only

Aurora 6.0 introduce le fondamenta server-side dell'assistente finanziario. La funzione è disattivata di default tramite `FINANCIAL_ASSISTANT_ENABLED=false` e, quando abilitata, lavora solo in lettura: può spiegare riepiloghi, budget, obiettivi, salute finanziaria e simulazioni, ma non crea, modifica o elimina movimenti, conti o dati contabili.

Le aree private Aurora e ADI sono disponibili solo all'account autorizzato configurato lato server con `PRIVATE_FINANCE_ACCOUNT_EMAIL`.

### Chiedi ad Aurora

Quando il flag è abilitato, la voce **Chiedi ad Aurora** apre una chat deterministica. Puoi scrivere domande in italiano come:

- Quanto ho speso questo mese?
- Quali categorie pesano di più?
- Quanti mesi copre il mio fondo di emergenza?
- Come stanno andando i miei budget?
- Perché il mio Financial Health è cambiato?
- Posso permettermi una spesa di 2.000 €?

Se l'account è autorizzato, la chat mostra anche suggerimenti per **Risparmi Aurora** e **ADI**. Gli scope disponibili vengono caricati dal server: non puoi selezionare aree non autorizzate.

Ogni risposta mostra:

- una sintesi leggibile;
- il periodo interpretato quando disponibile;
- il perimetro dati usato;
- evidenze e citazioni interne;
- eventuali input mancanti;
- azioni di navigazione verso pagine Aurora autorizzate.

La conversazione vive solo nel browser e viene persa al refresh. In questo sprint nessun dato viene inviato a provider AI esterni e non viene salvata cronologia cloud.

Richieste fuori perimetro, come raccomandazioni su ETF o istruzioni per creare, modificare, eliminare o trasferire denaro, vengono rifiutate perché l'assistente è in modalità sola lettura.

---

## 1. Cos'è Aurora

Aurora è un'applicazione web per la gestione finanziaria personale. Permette di:

- registrare entrate, spese e trasferimenti tra conti;
- monitorare budget mensili;
- seguire obiettivi di risparmio;
- gestire prestiti e rate;
- impostare movimenti ricorrenti;
- analizzare la propria salute finanziaria;
- generare report periodici;
- esportare dati in CSV o Excel;
- creare backup e ripristinare i dati.

Le informazioni mostrate hanno finalità organizzative e informative e non costituiscono consulenza finanziaria.

---

## 2. Primo accesso

1. Apri Aurora nel browser.
2. Registrati con email e password.
3. Conferma la tua email se richiesto.
4. Accedi con le credenziali create.
5. Segui la checklist dei primi passi che appare nella dashboard.

---

## 3. Creare un conto

Un conto rappresenta un luogo dove è depositato il denaro: conto bancario, contanti, carta di credito, investimenti o altro.

Per creare un conto:

1. Vai a **Conti** dal menu laterale.
2. Clicca su **Nuovo conto**.
3. Inserisci nome, tipo e saldo iniziale.
4. Salva.

Il saldo iniziale è il saldo del conto al momento in cui inizi a usare Aurora. I movimenti successivi aggiorneranno il saldo automaticamente.

---

## 4. Registrare una transazione

Per aggiungere un movimento:

1. Vai a **Movimenti**.
2. Clicca su **Nuovo movimento**.
3. Scegli il tipo: **Entrata**, **Uscita** o **Giroconto**.
4. Compila i campi: importo, data, descrizione, conto, categoria.
5. Salva.

Un giroconto sposta denaro tra due tuoi conti. Non è né un'entrata né un'uscita: non influisce sui totali di reddito o spese.

---

## 5. Entrate, spese e giroconti

| Tipo | Significato |
|------|-------------|
| Entrata | Denaro ricevuto (stipendio, rimborso, ecc.) |
| Uscita | Denaro speso (acquisti, bollette, ecc.) |
| Giroconto | Trasferimento tra tuoi conti (es. da conto corrente a conto risparmio) |

I giroconti vengono mostrati nella lista movimenti ma non influenzano entrate totali, spese totali o tasso di risparmio.

---

## 6. Categorie e tag

Le categorie organizzano i movimenti per tipo di spesa o entrata. Aurora include categorie predefinite, che puoi usare o personalizzare.

I tag sono etichette libere che puoi aggiungere ai movimenti per raggrupparli in modo trasversale (ad esempio: "Vacanza estate 2026").

---

## 7. Budget

Un budget imposta un limite di spesa mensile per una categoria.

Per creare un budget:

1. Vai a **Budget**.
2. Clicca su **Nuovo budget**.
3. Seleziona la categoria e l'importo massimo mensile.
4. Salva.

Aurora mostra quanto hai speso rispetto al limite e ti avvisa se stai per superarlo.

---

## 8. Obiettivi

Un obiettivo di risparmio ha un importo target e una data entro la quale vuoi raggiungerlo.

Per creare un obiettivo:

1. Vai a **Obiettivi**.
2. Clicca su **Nuovo obiettivo**.
3. Inserisci nome, importo target, conto di riferimento e data.
4. Aggiungi contributi manuali per tracciare i progressi.

---

## 9. Prestiti

Registra i tuoi prestiti (mutuo, finanziamento auto, ecc.) con le relative rate.

Aurora calcola il residuo, il totale pagato e le prossime scadenze. I pagamenti non vengono inviati automaticamente: devi registrarli manualmente quando effettui il pagamento.

---

## 10. Ricorrenze

Le ricorrenze rappresentano movimenti periodici previsti: affitto mensile, abbonamenti, stipendio.

Aggiungono eventi al Calendario finanziario e servono da base per le previsioni di cassa. Non creano movimenti automaticamente: devi registrare il movimento quando avviene realmente.

---

## 11. Calendario

Il Calendario finanziario mostra in forma visiva le scadenze imminenti: rate, ricorrenze, obiettivi. Ti aiuta a pianificare il mese.

---

## 12. Notifiche

Aurora genera avvisi automatici per eventi importanti:

- budget quasi esauriti o superati;
- ricorrenze in scadenza o scadute;
- rate in scadenza o scadute;
- obiettivi in ritardo.

Puoi filtrarle, segnarle come lette, silenziare tipi specifici o archiviarle.

---

## 13. Dashboard

La dashboard mostra una panoramica della tua situazione finanziaria: patrimonio, entrate, spese, margine, salute finanziaria e avvisi aperti.

Puoi personalizzare i widget visibili e il loro ordine tramite il pulsante delle preferenze. Puoi ripristinare le preferenze predefinite in qualsiasi momento.

---

## 14. Financial Health

La sezione **Salute finanziaria** calcola un punteggio basato su diversi aspetti della tua situazione:

- liquidità;
- capacità di risparmio;
- rispetto dei budget;
- sostenibilità del debito;
- regolarità dei pagamenti;
- progressi sugli obiettivi;
- avvisi critici.

Puoi salvare uno snapshot mensile per tenere traccia dell'andamento nel tempo.

> Le informazioni mostrate hanno finalità organizzative e informative e non costituiscono consulenza finanziaria.

---

## 15. Data Integrity Center

Questa sezione analizza i tuoi dati alla ricerca di possibili incongruenze: movimenti orfani, saldi incoerenti, duplicati sospetti.

La scansione analizza i dati **senza modificarli**. Puoi prendere in carico un'issue, ignorarla con una motivazione o segnarla come risolta manualmente.

Aurora non applica correzioni automatiche.

---

## 16. Scenari

Gli scenari permettono di simulare situazioni finanziarie future: cosa succede se aumenti le spese fisse, se ottieni un aumento di stipendio o se cambi piano di rimborso di un prestito?

> Gli scenari sono simulazioni. Non modificano conti, saldi o transazioni reali.

Ogni scenario ha un orizzonte temporale (da 1 a 60 mesi) e un set di azioni simulate. Puoi calcolare, duplicare, archiviare ed eliminare gli scenari.

---

## 17. Report

I report riassumono l'andamento finanziario in un periodo scelto: entrate, spese, categorie, conti, andamento mensile, confronto con il periodo precedente.

Puoi generare un report per il mese corrente, il trimestre o un periodo personalizzato.

---

## 18. CSV ed Excel

Puoi esportare i dati in:

- **CSV**: file di testo compatibile con Excel, Google Sheets e altri fogli di calcolo.
- **Excel (.xlsx)**: foglio di calcolo strutturato con più schede.

I file vengono generati e scaricati direttamente nel tuo browser. Nessun dato viene inviato a server esterni.

---

## 19. Backup

Il backup esporta tutti i tuoi dati in un file JSON scaricato nel tuo dispositivo.

**Il backup contiene i dati finanziari associati al tuo account. Non include password o credenziali di accesso.**

È consigliabile creare un backup periodico e conservarlo in un luogo sicuro.

Per creare un backup:

1. Vai a **Impostazioni**.
2. Clicca su **Scarica backup**.
3. Il file verrà salvato nel tuo browser.

---

## 20. Restore

Il ripristino importa i dati da un file di backup in un account vuoto.

**Flusso:**

1. Vai a **Impostazioni**.
2. Seleziona il file di backup.
3. Clicca su **Verifica backup** per l'anteprima.
4. Controlla il riepilogo: record, collisioni, eventuali avvisi.
5. Se il risultato è corretto, prepara la conferma.
6. Inserisci la frase di conferma richiesta.
7. Esegui il ripristino.

L'anteprima non modifica i dati. Il ripristino è disponibile solo su account vuoto.

---

## 21. Impostazioni

Dalle impostazioni puoi:

- aggiornare nome e valuta predefinita;
- esportare le transazioni in CSV;
- creare un backup;
- ripristinare un backup;
- effettuare il logout.

---

## 22. Dark mode

Aurora si adatta alla modalità chiara o scura del dispositivo. Se il tuo sistema operativo è impostato in modalità scura, anche Aurora lo sarà automaticamente.

---

## 23. Ricerca e command menu

La ricerca globale (icona 🔍 nell'header) permette di cercare movimenti, conti, categorie e pagine rapidamente.

Puoi anche aprire il command menu con **Ctrl+K** (o **Cmd+K** su Mac) per navigare velocemente tra le sezioni.

---

## 24. Sicurezza

- Ogni utente accede solo ai propri dati.
- I dati sono protetti da Row Level Security sul database.
- Le credenziali di accesso non vengono mai incluse nei backup.
- La chiave di servizio del database non è mai esposta al browser.
- I file di backup sono scaricati localmente — non vengono caricati su server di terze parti.

---

## 25. Privacy

- I dati inseriti in Aurora restano nel tuo account.
- Aurora non è collegata alla banca e non accede a conti esterni.
- I dati non vengono venduti o condivisi con terze parti.
- Puoi eliminare il tuo account contattando il supporto.

---

## 26. Risoluzione problemi

**Dashboard non carica**
Riprova tra qualche secondo. Se il problema persiste, effettua il logout e accedi nuovamente.

**Il backup non si scarica**
Verifica che il browser non blocchi i download. Prova con un browser diverso.

**La verifica del backup mostra errori**
Controlla che il file sia un backup Aurora valido e non sia stato modificato manualmente.

**I movimenti non appaiono nei report**
Verifica che il periodo e i filtri del report includano i movimenti cercati.

**Una ricorrenza non ha creato il movimento**
Le ricorrenze sono previsioni: devi registrare il movimento manualmente quando avviene.

---

## 27. Limiti

- Aurora non è collegata a nessuna banca o servizio finanziario esterno.
- I movimenti devono essere inseriti manualmente.
- Le simulazioni degli scenari sono basate sui dati registrati e non garantiscono risultati futuri.
- Il punteggio Financial Health è un indicatore interno, non una valutazione creditizia.
- Il restore è disponibile solo su account vuoto per evitare conflitti.

---

## 28. Posso permettermelo?

La sezione **Posso permettermelo?** (accessibile dal menu laterale) consente di simulare la sostenibilità di un acquisto in base ai propri dati finanziari registrati in Aurora.

### Come funziona

1. Inserisci il nome dell'acquisto e il prezzo totale.
2. Scegli la modalità di pagamento: **immediata** (pagamento unico) o **rateale** (con rata mensile e numero di rate).
3. Imposta la data dell'acquisto.
4. Facoltativamente aggiungi: anticipo, spese accessorie iniziali, costo mensile o annuale ricorrente, maxi-rata finale, entrata mensile collegata all'acquisto.
5. Premi **Valuta sostenibilità** per ottenere il risultato.

### Cosa viene analizzato

- **Liquidità**: saldo totale dei conti attivi, prima e dopo il pagamento iniziale.
- **Margine mensile**: differenza tra entrate e uscite medie mensili, ridotto delle rate e dei costi ricorrenti.
- **Mesi di copertura**: quanti mesi di spese abituali riesce a coprire la liquidità residua.
- **Proiezione**: stima mese per mese del saldo nei prossimi 12 mesi (configurabile fino a 24).

### Classificazioni

| Risultato | Significato |
|---|---|
| **Sostenibile** | L'acquisto è compatibile con la situazione attuale. |
| **Sostenibile con cautela** | Realizzabile ma almeno un indicatore è vicino alla soglia. |
| **Rischioso** | Uno o più indicatori superano le soglie di attenzione. |
| **Non sostenibile** | L'acquisto non è compatibile con la situazione attuale. |
| **Dati insufficienti** | Non ci sono dati storici sufficienti per una stima affidabile. |

### Nota importante

La valutazione si basa esclusivamente sui dati registrati in Aurora (transazioni, ricorrenze attive, saldo dei conti). Non modifica nessun dato finanziario, non crea transazioni e non si connette a servizi esterni. Ha finalità organizzative e informative: non costituisce consulenza finanziaria.

---

## 29. Valutazione auto — "Posso permettermi questa auto?"

La modalità **Auto** della sezione "Posso permettermelo?" consente di analizzare in dettaglio il costo totale di possesso (TCO) di un'automobile.

### Come funziona

1. Seleziona **Auto** nel selettore di tipo in cima alla pagina.
2. Inserisci le informazioni del veicolo: nome/modello, prezzo, alimentazione, km/anno, anni di utilizzo.
3. Aggiungi facoltativamente: riduzioni del prezzo (sconti, incentivi, permuta), spese iniziali (immatricolazione, consegna), assicurazione, bollo auto, carburante/energia, manutenzione, altri costi ricorrenti.
4. Inserisci i dati dell'auto attuale (se disponibili) per calcolare il costo incrementale.
5. Aggiungi un valore residuo stimato per un calcolo TCO netto più accurato.
6. Premi **Valuta acquisto auto** per ottenere il risultato.

### Metriche calcolate

| Metrica | Descrizione |
|---|---|
| **Costo medio mensile di possesso** | TCO netto diviso per i mesi di utilizzo |
| **Costo mensile ricorrente** | Assicurazione + bollo + carburante + manutenzione |
| **Costo totale di possesso (TCO)** | Tutti i costi nel periodo di utilizzo |
| **Costo netto** | TCO meno il valore residuo stimato |
| **Costo per km** | Costo netto diviso per i km totali percorsi |
| **Costo incrementale** | Differenza rispetto all'auto attuale |

### Confronti disponibili

- **Pagamento immediato vs. finanziamento**: se il pagamento è in finanziamento, vengono confrontate le due modalità.
- **Auto A vs. Auto B**: inserendo un secondo veicolo per il confronto, vengono calcolati TCO, costo mensile e sostenibilità per entrambi.

### Costi non inclusi

Se non vengono inseriti assicurazione, bollo, carburante o manutenzione, la sezione "Costi non inclusi" avvisa che il calcolo è parziale e il costo reale sarà probabilmente più alto.

---

## 30. Disclaimer

Le informazioni mostrate in Aurora hanno finalità organizzative e informative e non costituiscono consulenza finanziaria, creditizia o di investimento. Aurora non è un istituto finanziario e non è sottoposta a vigilanza finanziaria. L'utente è responsabile delle decisioni finanziarie prese sulla base dei propri dati.

---

## 31. Valutazione casa — "Posso permettermi questa casa?"

La modalità **Casa** della sezione "Posso permettermelo?" valuta un acquisto immobiliare senza modificare saldi, movimenti, prestiti o snapshot.

### Cosa inserire

- prezzo richiesto e prezzo concordato;
- sconto, contributi, agevolazioni manuali, ricavi da vendita e caparra già versata;
- pagamento immediato oppure mutuo con anticipo, rata, durata, spese e tasso come semplice etichetta;
- notaio, imposte, agenzia, perizia, istruttoria, assicurazione iniziale, trasloco e altri costi iniziali;
- lavori, margine prudenziale e arredamento, distinguendo le voci rinviabili;
- condominio, utenze, assicurazione, imposte ricorrenti e manutenzione;
- situazione abitativa attuale per calcolare l'incremento reale;
- valore residuo stimato e debito residuo a fine periodo.

### Cosa mostra Aurora

- prezzo effettivo;
- esborso iniziale;
- rata e costo abitativo mensile totale;
- incremento rispetto all'abitazione attuale;
- costo annuale e costo totale nel periodo;
- valore netto stimato, sempre indicato come stima dell'utente;
- costi mancanti e qualità dati;
- rischi, motivazioni, alternative deterministiche e prezzo massimo prudenziale quando i dati sono sufficienti.

### Limiti

Aurora non recupera tassi, valori immobiliari, imposte o agevolazioni online. Non calcola automaticamente requisiti fiscali, non consiglia banche o immobili e non fornisce consulenza finanziaria o fiscale.

---

## 32. Valutazione vacanza — "Posso permettermi questa vacanza?"

La modalità **Vacanza** della sezione "Posso permettermelo?" valuta l'impatto finanziario di un viaggio usando solo costi inseriti manualmente.

### Cosa inserire

- nome simulazione, destinazione, paese, numero viaggiatori, adulti e bambini;
- data prenotazione, partenza e rientro;
- trasporti: auto, aereo, treno, nave o bus, più taxi, transfer, parcheggi e altri costi;
- alloggio: costo totale, acconto, saldo, cauzione, pulizie e tassa soggiorno;
- pasti: budget giornaliero per persona oppure costo totale;
- attività: escursioni, musei, parchi, eventi, sport e noleggi;
- extra: shopping, souvenir, assicurazione viaggio, roaming, mance, imprevisti;
- calendario pagamenti con importo e data prevista.

### Cosa mostra Aurora

- durata viaggio e numero notti;
- costo totale vacanza;
- liquidità residua e mesi di copertura;
- saldo minimo previsto e mesi critici;
- accantonamento mensile suggerito fino alla partenza;
- budget massimo prudenziale quando i dati sono sufficienti;
- confronto opzionale tra due vacanze;
- alternative deterministicamente calcolate.

Aurora non suggerisce destinazioni, non recupera prezzi online, non usa motori di prenotazione, non effettua conversioni valutarie automatiche e non modifica dati reali.

---

## 33. Confronta le tue decisioni

La pagina **Confronta scenari** (raggiungibile dalla sezione "Posso permettermelo?") permette di confrontare fino a 4 ipotesi di acquisto — generico, auto, casa o vacanza, anche di domini diversi tra loro — in base al loro impatto finanziario.

### Cosa inserire

- da 2 a 4 scenari, ciascuno con i dati essenziali del relativo acquisto (nome, prezzo, modalità di pagamento, date);
- un profilo decisionale predefinito (Bilanciato, Proteggi la liquidità, Riduci il costo totale, Riduci l'impegno mensile, Evita il debito, Preserva il fondo di emergenza) oppure pesi personalizzati per ciascun criterio.

### Cosa mostra Aurora

- lo scenario che risulta più adatto in base ai criteri scelti, con relativo punteggio;
- la classifica completa, con eventuali parità o scenari dominati;
- il dettaglio dei punteggi per ciascun criterio (costo, liquidità, debito, valore residuo, ecc.);
- i principali compromessi tra coppie di scenari;
- avvisi su valute incompatibili, dati mancanti o confrontabilità parziale tra domini diversi;
- una spiegazione sintetica del metodo di calcolo (normalizzazione, pesi, punteggio, classifica).

### Origine dei dati

Ogni scenario viene ricalcolato lato server dal motore di confronto usando i dati finanziari reali dell'utente (conti, transazioni, ricorrenze, prestiti, obiettivi) al momento del confronto — nessun risultato viene salvato: se si esce dalla pagina, il confronto va ripetuto.

### Limiti

Il punteggio è un indice relativo utile a ordinare le opzioni tra loro, non una raccomandazione finanziaria assoluta. Il modulo di inserimento rapido copre i campi essenziali di ciascun dominio: per simulazioni con voci di costo dettagliate (assicurazioni, manutenzione, spese condominiali, ecc.) usare i calcolatori dedicati (Auto, Casa, Vacanza) descritti nelle sezioni precedenti.
