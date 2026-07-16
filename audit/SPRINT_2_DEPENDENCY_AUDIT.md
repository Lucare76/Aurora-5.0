# Sprint 2 - Dependency audit

## Comando eseguito

```bash
npm audit --json
```

Primo tentativo: fallito per accesso all'endpoint npm.

Secondo tentativo: completato con accesso rete consentito.

Nessun fix automatico eseguito.

## Riepilogo

| Severita | Numero |
|---|---:|
| Moderate | 2 |
| High | 1 |
| Critical | 0 |
| Totale | 3 |

## 1. `postcss`

- Pacchetto: `postcss`
- Severita: moderate
- Dipendenza: transitiva
- Percorso: `next -> postcss`
- Nodo: `node_modules/next/node_modules/postcss`
- Advisory: GHSA-qx2v-qp2m-jg93
- Titolo: PostCSS has XSS via Unescaped `</style>` in CSS Stringify Output
- Range vulnerabile: `<8.5.10`
- Versione corretta disponibile: `postcss >= 8.5.10`
- Fix proposto da npm: downgrade/override tramite `next@9.3.3`
- Breaking change: si, il fix suggerito da npm e' semanticamente non accettabile per Aurora perche' propone una major incompatibile/downgrade di Next.

### Sfruttabilita in Aurora

Rischio reale basso/medio nel contesto attuale. Aurora non espone editing CSS utente general-purpose, ma Next include PostCSS nella toolchain. Il rischio aumenta se in futuro CSS generato da input utente o import esterni viene serializzato direttamente.

### Raccomandazione

Aggiornare in sprint separato monitorando Next.js. Non usare `npm audit fix --force`.

## 2. `next`

- Pacchetto: `next`
- Severita: moderate
- Dipendenza: diretta
- Percorso: dipendenza diretta `next`
- Nodo: `node_modules/next`
- Via: `postcss`
- Range vulnerabile: `9.3.4-canary.0 - 16.3.0-canary.5`
- Fix proposto da npm: `next@9.3.3`
- Breaking change: si, il fix proposto e' incompatibile con l'app corrente basata su Next 16.

### Sfruttabilita in Aurora

La vulnerabilita deriva da PostCSS incluso in Next. Non e' un bug applicativo diretto della route transazioni o del modello contabile. Resta da monitorare perche' Next e' dipendenza runtime/build centrale.

### Raccomandazione

Accettare temporaneamente e aggiornare Next/PostCSS appena disponibile un fix coerente con Next 16. Non applicare downgrade.

## 3. `xlsx`

- Pacchetto: `xlsx`
- Severita: high
- Dipendenza: diretta
- Percorso: dipendenza diretta `xlsx`
- Nodo: `node_modules/xlsx`
- Advisory 1: GHSA-4r6h-8v6p-xvw6
- Advisory 2: GHSA-5pgg-2g8v-p4x9
- Titoli:
  - Prototype Pollution in SheetJS
  - SheetJS Regular Expression Denial of Service
- Range vulnerabile:
  - `<0.19.3`
  - `<0.20.2`
- Fix disponibile da npm: false
- Breaking change: non valutabile tramite npm audit perche' non viene proposto un fix automatico.

### Sfruttabilita in Aurora

Rischio reale medio/alto per Aurora perche' l'app gestisce import di file. Se un file XLSX malevolo viene caricato dall'utente, possono esistere rischi di blocco parsing o manipolazione oggetti in memoria. Il rischio e' limitato dal fatto che Aurora e' app personale e il file viene caricato consapevolmente, ma la superficie esiste.

### Raccomandazione

Aggiornare in sprint separato o valutare sostituzione libreria. Priorita alta rispetto alle altre vulnerabilita perche' `xlsx` e' usata su input file utente. Nel frattempo limitare import a file fidati, dimensioni contenute e formati strettamente necessari.

## Decisione Sprint 2

Nessuna dipendenza e' stata aggiornata in questo sprint.

Motivo: lo sprint e' dedicato al contratto transazioni/giroconti; correzioni dependency possono cambiare lockfile e comportamento build/import, quindi vanno trattate in uno sprint dedicato.
