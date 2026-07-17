# Aurora 5.0 - Audit funzionale utente finale 2026

Data audit: 17 luglio 2026

## 1. Sintesi generale

Aurora 5.0 oggi e' gia' una buona applicazione personale per tracciare conti, movimenti, categorie, budget, report, import, export, prestiti, ricorrenze e compleanni. La copertura funzionale e' ampia, il tono visivo e' coerente, le azioni principali sono presenti e i flussi contabili fondamentali risultano comprensibili.

Dal punto di vista di un utente reale, il limite principale non e' la mancanza di funzioni di base, ma la mancanza di guida, spiegazioni operative e protezioni nei momenti ad alto rischio: primo avvio, import, giroconti, backup/ripristino, ricorrenze e prestiti.

Aurora sembra pensata per un utente motivato e gia' abbastanza consapevole. Per diventare un gestionale personale da usare serenamente per molti anni deve ridurre il carico mentale: meno presupposti, piu' percorsi guidati, conferme migliori, una ricerca piu' potente e una strategia chiara di backup/ripristino.

## 2. Voto complessivo

**7.2 / 10**

Motivazione:

- alta completezza funzionale;
- buona chiarezza visuale generale;
- dashboard utile e ricca;
- import/export presenti;
- ma onboarding, mobile, import, ricorrenze, prestiti e fiducia sul recupero dati non sono ancora al livello di un prodotto maturo da 10 anni.

## 3. Punti di forza

1. **Copertura ampia delle aree personali**: conti, transazioni, budget, report, ricorrenze, prestiti, compleanni, import/export.
2. **Dashboard ricca**: patrimonio, andamento, budget, ricorrenze, scadenze e ultimi movimenti sono nello stesso posto.
3. **Transazioni complete**: entrate, uscite, giroconti, note, filtri, ricerca, import CSV e raggruppamento temporale.
4. **Import dedicato Bancoposta/American Express**: e' una funzione concreta, non generica, utile nel tuo uso reale.
5. **Categorie con sottocategorie collassabili**: ora la gerarchia scala meglio e riduce rumore visivo.

## 4. Principali debolezze

1. **Onboarding debole**: un nuovo utente non riceve una sequenza guidata tipo "crea conto -> verifica categorie -> inserisci primo movimento".
2. **Backup senza ripristino visibile**: export CSV/JSON aumenta fiducia, ma manca il percorso inverso chiaro.
3. **Import potente ma rischioso**: anteprima presente, ma rollback, spiegazione duplicati e annullamento non sono abbastanza forti.
4. **Ricorrenze poco rassicuranti**: non e' chiarissimo cosa verra' creato, quando e come evitare duplicati.
5. **Prestiti incompleti come gestione finanziaria reale**: utile per tracciare debiti semplici, ma non per rate, interessi, piano pagamenti e collegamento ai movimenti.

## 5. Esperienza utente nuovo

Profilo simulato: persona che apre Aurora per la prima volta e vuole iniziare.

Esperienza:

- vede una navigazione completa e comprensibile;
- se non ha conti, la dashboard propone di aggiungere il primo conto;
- capisce che "Conti" e "Transazioni" sono aree centrali;
- non riceve pero' una guida passo-passo;
- non e' esplicitato se prima debba creare categorie, conti o importare estratti;
- non c'e' una checklist di setup iniziale;
- alcune sezioni avanzate, come Ricorrenti, Prestiti, Importa estratti e Report, possono sembrare premature.

Valutazione: **buona base, ma non ancora autoesplicativa**.

Rischio principale: l'utente nuovo crea un conto con saldo iniziale errato, importa dati senza capire bene duplicati/giroconti, oppure abbandona per incertezza.

## 6. Esperienza utente abituale

Profilo simulato: persona che usa Aurora ogni giorno per registrare spese, controllare saldi e consultare budget.

Esperienza:

- la pagina Transazioni offre ricerca, filtri, mese navigabile e riepilogo;
- registrare una spesa comune e' possibile in pochi passaggi, ma il form resta abbastanza ricco;
- la lista movimenti e' leggibile e raggruppata per data;
- dashboard e conti danno un controllo rapido;
- budget e report aiutano, ma richiedono un po' di interpretazione;
- mancano scorciatoie quotidiane tipo "ripeti ultima spesa", template o inserimento ultra-rapido.

Valutazione: **adatta all'uso quotidiano, con frizioni riducibili**.

## 7. Esperienza utente avanzato

Profilo simulato: persona con molti conti, giroconti, import, storico, prestiti, ricorrenze, export.

Esperienza:

- Aurora ha molte delle funzioni necessarie;
- i giroconti sono riconoscibili e separati dai conteggi principali;
- import Bancoposta/Amex e report sono un grande vantaggio;
- categorie collassabili aiutano quando le categorie crescono;
- la gestione avanzata soffre pero' su rollback import, audit trail visibile, backup/ripristino, ricerca storica profonda e prestiti complessi.

Valutazione: **promettente, ma non ancora "senza ansia" per 10 anni di dati**.

## 8. Analisi per area

### 8.1 Primo accesso e orientamento

La navigazione e' chiara: Dashboard, Transazioni, Conti, Categorie, Budget, Report, Ricorrenti, Prestiti, Compleanni, Impostazioni.

Punti positivi:

- nomi menu comprensibili;
- empty state presenti;
- dashboard senza conti invita ad aggiungere il primo conto.

Problemi:

- manca una sequenza guidata;
- manca una spiegazione "come funziona Aurora";
- import e transazioni sono disponibili prima che l'utente abbia capito il modello dati;
- non c'e' un controllo setup tipo "hai almeno un conto attivo?".

Risposta: un nuovo utente capisce qualcosa, ma non tutto. Aurora guida solo parzialmente.

### 8.2 Dashboard

La dashboard risponde abbastanza bene alla domanda: "Come stanno andando le mie finanze?".

Punti positivi:

- patrimonio totale;
- entrate/uscite;
- risparmio netto;
- grafici;
- budget da tenere d'occhio;
- movimenti recenti;
- ricorrenze, scadenze, compleanni.

Problemi:

- e' molto ricca e rischia di diventare densa;
- non sempre e' chiaro il periodo di riferimento di ogni widget;
- alcune informazioni laterali possono distrarre dalla salute finanziaria;
- manca un giudizio sintetico tipo "mese positivo/negativo", "stai spendendo piu' del solito", "attenzione a X".

Valutazione: utile, ma va resa piu' decisionale.

### 8.3 Conti

Punti positivi:

- saldo totale evidente;
- creazione/modifica conto presenti;
- tipo conto e stato attivo/inattivo visibili;
- import disponibile sui conti rilevanti;
- avviso sulla modifica diretta del saldo.

Problemi:

- modifica diretta del saldo resta rischiosa;
- non e' chiarissimo cosa succede eliminando un conto con movimenti storici;
- tabella con `min-w` puo' essere scomoda su mobile;
- ordine conti e raggruppamenti potrebbero diventare difficili con molti conti.

Valutazione: solida, ma servono conferme piu' didattiche per azioni distruttive.

### 8.4 Categorie e sottocategorie

Punti positivi:

- sezioni Entrate/Uscite;
- sottocategorie visivamente indentate;
- categorie padre collassabili;
- blocco eliminazione se ci sono transazioni o sottocategorie;
- menu con modifica/elimina/aggiungi sottocategoria.

Problemi:

- non c'e' prevenzione duplicati visibile;
- "Entrambe" puo' essere potente ma ambiguo;
- con centinaia di categorie manca ricerca o filtro nella pagina categorie;
- non e' chiaro quando convenga usare categoria padre o sottocategoria.

Valutazione: ora molto piu' scalabile visivamente, ma servono ricerca e regole anti-duplicato.

### 8.5 Movimenti

Punti positivi:

- nuova entrata/uscita/giroconto nello stesso dialog;
- import CSV;
- ricerca per descrizione/note;
- filtri per tipo, conto, categoria, importo;
- raggruppamento per data;
- modifica ed eliminazione disponibili;
- categoria opzionale.

Problemi:

- form non e' ancora rapidissimo per una spesa quotidiana;
- molti filtri possono occupare spazio;
- non si vede sempre un saldo post-operazione nel momento di salvataggio;
- manca duplicazione/ripetizione rapida di movimento;
- assenza di undo dopo eliminazione.

Stima spesa comune: circa 15-30 secondi e 5-8 interazioni, dipende da conto/categoria gia' corretti.

### 8.6 Trasferimenti

Punti positivi:

- tipo giroconto presente;
- conto origine/destinazione;
- categoria disabilitata per transfer;
- lista riconosce giroconti;
- neutralita' contabile gia' verificata nei test e nell'uso reale.

Problemi:

- nel toggle del form compare "Transfer", mentre altrove "Giroconti": termine non coerente;
- l'utente non riceve una spiegazione esplicita "non conta come entrata o uscita";
- modifica/cancellazione di giroconti richiede molta fiducia.

Valutazione: funziona, ma va spiegato meglio.

### 8.7 Budget

Punti positivi:

- mese navigabile;
- riepilogo budget/speso/rimanente;
- barre di avanzamento;
- alert per categorie vicine o oltre limite;
- dialog semplice.

Problemi:

- aiuta a vedere numeri, meno a decidere cosa fare;
- manca notifica/insight piu' esplicito;
- non e' chiaro come vengono trattate sottocategorie e categorie padre;
- mancano budget ricorrenti/precompilati o copia mese precedente.

Valutazione: utile ma ancora descrittivo.

### 8.8 Report

Punti positivi:

- periodo selezionabile;
- entrate, uscite, netto;
- categorie;
- grafici;
- confronto annuale;
- export CSV.

Problemi:

- puo' richiedere molti click per rispondere a domande comuni;
- mancano report salvati o preset;
- la relazione con dashboard non e' sempre esplicitata;
- mobile probabilmente denso per grafici/tabelle.

Valutazione: buono per consultazione, migliorabile per insight.

### 8.9 Ricorrenze

Punti positivi:

- importo, frequenza, data inizio/fine;
- pausa/riprendi;
- categoria/conto;
- auto-crea transazione;
- scadenze evidenziate in dashboard.

Problemi:

- non e' chiaro come viene gestita una singola occorrenza;
- rischio duplicati non spiegato;
- manca anteprima delle prossime generazioni;
- l'utente non vede un calendario delle occorrenze.

Valutazione: presente, ma da rendere piu' rassicurante.

### 8.10 Prestiti

Punti positivi:

- prestiti dati/ricevuti;
- saldo residuo;
- pagamento parziale;
- segna saldato;
- scadenza evidenziabile.

Problemi:

- mancano interessi;
- mancano rate/piano pagamento;
- non e' chiaro il collegamento con movimenti reali;
- potrebbe diventare solo descrittivo per casi complessi.

Valutazione: utile per prestiti semplici, incompleto per gestione avanzata.

### 8.11 Importazione

Punti positivi:

- import Aurora CSV;
- import Bancoposta XLSX;
- import American Express CSV;
- anteprima;
- duplicati esclusi;
- rilevamento giroconti BP/Amex;
- progress import.

Problemi:

- import speciale richiede conti con nomi esatti;
- rollback/annullamento non evidente;
- duplicati e match automatici richiedono fiducia;
- gestione righe non riconosciute andrebbe spiegata meglio;
- import e CSV import sono in due aree diverse, potenzialmente confusivo.

Valutazione: molto utile, ma e' il flusso piu' delicato.

### 8.12 Esportazione e backup

Punti positivi:

- CSV report;
- CSV transazioni;
- backup JSON completo da Impostazioni.

Problemi:

- manca ripristino backup;
- non e' chiaro se il backup JSON sia importabile;
- manca strategia di backup periodico;
- manca verifica integrita' export.

Valutazione: export buono, fiducia incompleta senza restore.

### 8.13 Ricerca e filtri

Punti positivi:

- transazioni hanno ricerca testuale;
- filtri conto, categoria, tipo, importo;
- reset filtri;
- mese navigabile.

Problemi:

- manca ricerca globale;
- filtri avanzati non sembrano salvabili;
- ricerca su storico pluriennale potrebbe essere scomoda;
- categorie/conti non hanno ricerca dedicata per grandi numeri.

Valutazione: buona per uso medio, limitata per storico lungo.

### 8.14 Mobile e responsive

Valutazione basata su struttura UI e classi responsive, non su device lab.

Punti positivi:

- layout mobile con navigazione inferiore;
- dialog con `max-h` e overflow;
- molte griglie collassano;
- tabelle hanno overflow orizzontale.

Problemi:

- tabelle conti/import/report possono richiedere scroll orizzontale;
- import estratti ha tabella molto larga;
- modali ricche possono essere faticose su smartphone;
- report/grafici potrebbero essere leggibili ma non comodi;
- molte azioni sono in menu a tre punti piccoli.

Valutazione: usabile per consultazione e inserimenti semplici; non ideale per import/report avanzati.

### 8.15 Feedback, errori e conferme

Punti positivi:

- toast success/error diffusi;
- loading skeleton in molte pagine;
- empty state presenti;
- conferme su eliminazioni importanti.

Problemi:

- toast spesso generici;
- undo assente;
- errori import possono essere numerosi e difficili da leggere;
- non sempre viene spiegato l'effetto contabile dell'azione.

Valutazione: feedback buono ma non ancora didattico.

### 8.16 Accessibilita' e leggibilita'

Punti positivi:

- contrasto generale buono nella light mode;
- testi abbastanza chiari;
- bottoni con icone e label nei comandi principali;
- numeri tabulari.

Problemi:

- alcune azioni sono solo icone;
- uso del colore per entrata/uscita richiede supporto testuale costante;
- focus tastiera non verificato;
- tabelle dense su mobile.

Valutazione: funzionale, ma non audit WCAG completo.

### 8.17 Coerenza generale

Punti positivi:

- stile card/form coerente;
- colori entrata/uscita abbastanza coerenti;
- modali simili.

Problemi:

- "Transazioni" e "movimenti" convivono;
- "Transfer" compare accanto a "Giroconti";
- import CSV e import estratti sono separati;
- date e periodi non sempre sono descritti nello stesso modo;
- alcune aree sono piu' mature di altre.

## 9. Problemi con severita'

### P0

Nessun P0 funzionale evidente nell'audit. Non sono emersi blocchi certi o rischi immediati di perdita dati osservabili dai flussi.

### P1

- **F-01 Onboarding assente o troppo implicito**: nuovo utente non ha una sequenza guidata.
- **F-02 Backup senza restore visibile**: esportare non basta per fidarsi per 10 anni.
- **F-03 Import ad alto rischio senza rollback evidente**: potente ma delicato.
- **F-04 Ricorrenze poco verificabili**: auto-creazione e duplicati non abbastanza chiari.
- **F-05 Prestiti incompleti per casi reali complessi**: mancano rate/interessi/collegamento movimenti.
- **F-06 Mobile non ideale per flussi avanzati**: import/report/tabelle risultano pesanti.

### P2

- **F-07 Dashboard ricca ma poco decisionale**.
- **F-08 Inserimento spesa quotidiana non ancora ultra-rapido**.
- **F-09 Terminologia incoerente Transfer/Giroconto/Transazioni/Movimenti**.
- **F-10 Eliminazioni senza undo**.
- **F-11 Modifica diretta saldo conto ancora rischiosa**.
- **F-12 Budget descrittivi, non abbastanza prescrittivi**.
- **F-13 Ricerca globale assente**.
- **F-14 Categorie senza ricerca/anti-duplicato**.
- **F-15 Import dipendente da nomi conto esatti**.
- **F-16 Report senza preset o viste salvate**.
- **F-17 Mancano template/duplicazione movimento**.
- **F-18 Manca storico decisionale su modifiche importanti visibile all'utente**.

### P3

- **F-19 Empty state non sempre orientati a una sequenza**.
- **F-20 Alcuni menu a tre punti piccoli su mobile**.
- **F-21 Compleanni utile ma laterale nel contesto finanza**.
- **F-22 Icone/colore a volte portano troppo significato**.
- **F-23 Testi errore spesso generici**.
- **F-24 Import CSV e import estratti separati possono confondere**.
- **F-25 Grafici/report possono avere troppa densita' visiva**.
- **F-26 Mancano microcopy esplicativi sui giroconti**.
- **F-27 Mancano scorciatoie da tastiera o quick actions**.
- **F-28 Mancano preferenze utente per viste predefinite**.

## 10. Funzioni mancanti

- Wizard iniziale.
- Ripristino da backup.
- Ricerca globale.
- Undo per eliminazioni/import.
- Preset report salvati.
- Template movimenti frequenti.
- Anteprima prossime ricorrenze.
- Piano rate/interessi prestiti.
- Audit/log utente leggibile per azioni importanti.
- Backup periodico guidato.

## 11. Funzioni presenti ma poco utili

- Compleanni: utile come extra personale, ma meno centrale rispetto alla gestione finanziaria.
- Alcuni widget dashboard secondari: possono distrarre se non personalizzabili.
- Export report CSV senza un percorso chiaro di uso successivo.

## 12. Funzioni presenti ma incomplete

- Backup: manca restore.
- Ricorrenze: manca anteprima/gestione singola occorrenza.
- Prestiti: manca piano pagamenti/interessi/collegamento movimenti.
- Budget: manca copia mese precedente e suggerimenti.
- Import: manca rollback evidente e spiegazione completa dei duplicati.

## 13. Problemi mobile

- Tabelle larghe su Conti, Import, Report.
- Dialog molto pieni per transazioni/import.
- Menu a tre punti piccoli.
- Report avanzati probabilmente poco comodi.
- Import estratti non e' un flusso ideale da smartphone.

## 14. Problemi di chiarezza

- Sequenza iniziale non esplicita.
- Differenza tra "Transazioni" e "Movimenti".
- "Transfer" vs "Giroconto".
- Effetto contabile dei giroconti non spiegato.
- Backup JSON non spiegato come ripristinabile o meno.
- Modifica saldo conto rischiosa anche con avviso.

## 15. Problemi di affidabilita' percepita

- Mancanza restore.
- Mancanza undo.
- Import delicati senza rollback.
- Ricorrenze auto-create non abbastanza trasparenti.
- Prestiti non collegati chiaramente ai movimenti.

## 16. Domande finali

1. **Aurora e' oggi facile da usare?** Si', per un utente motivato. Non ancora per un utente completamente nuovo.
2. **Un nuovo utente capirebbe cosa fare?** Capirebbe di creare un conto, ma non avrebbe una sequenza completa.
3. **Qual e' il flusso piu' debole?** Import/backup/ripristino, perche' combina rischio alto e fiducia incompleta.
4. **Qual e' la funzione piu' urgente da migliorare?** Onboarding guidato e sicurezza percepita di import/backup.
5. **Quale funzione manca maggiormente?** Restore da backup.
6. **Quale funzione esistente e' meno utile?** Compleanni, rispetto al core finanziario.
7. **La dashboard e' sufficiente?** Si' come panoramica; no come guida decisionale.
8. **La versione mobile e' realmente usabile?** Si' per consultazione/inserimento semplice; no per import/report avanzati.
9. **Aurora trasmette fiducia?** Abbastanza, ma non piena finche' backup, restore e rollback non sono chiarissimi.
10. **E' pronta per essere usata per 10 anni?** Come base personale si'; come gestionale sereno e duraturo serve consolidare backup, ricerca, import e ricorrenze.
11. **Quali sono le 5 priorita' assolute?** Onboarding, restore backup, rollback import, ricorrenze trasparenti, ricerca globale.
12. **Quale deve essere il prossimo sprint?** Sprint breve su onboarding iniziale e checklist setup.

## 17. Conclusione

Aurora 5.0 e' gia' molto piu' di un prototipo: ha una struttura funzionale ampia e molte parti pronte per l'uso reale. Il prossimo salto non e' aggiungere tante funzioni, ma rendere quelle esistenti piu' sicure, guidate e rassicuranti.

La direzione consigliata e': meno espansione, piu' fiducia. Prima onboarding, backup/restore, import rollback e ricorrenze trasparenti. Dopo, ricerca globale e prestiti evoluti.
