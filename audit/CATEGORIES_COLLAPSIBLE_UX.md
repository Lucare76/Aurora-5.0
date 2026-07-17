# Categorie - Sottocategorie collassabili

## Modifica

Le sottocategorie nella pagina Categorie sono ora collassate di default.

Ogni categoria padre con sottocategorie mostra un controllo indipendente per espandere o comprimere i figli. Le categorie senza sottocategorie non mostrano il controllo.

## Perimetro

- Nessuna modifica a database.
- Nessuna modifica ad API o RPC.
- Nessuna modifica alla logica CRUD.
- Nessuna modifica al modello dati.

## Test

Sono stati aggiunti test mirati in:

`tests/ui/categories-collapsible.test.ts`

Casi coperti:

- categorie padre con sottocategorie collassate di default;
- sottocategorie nascoste inizialmente;
- apertura categoria con la stessa transizione di stato usata dalla pagina;
- chiusura categoria con secondo toggle;
- apertura/chiusura indipendente di due categorie padre;
- assenza del pulsante di espansione su categorie senza sottocategorie;
- `ChevronRight` quando la categoria e' chiusa;
- `ChevronDown` quando la categoria e' aperta;
- cambio corretto di `aria-expanded`;
- azioni `Modifica`, `Aggiungi sottocategoria` ed `Elimina` ancora renderizzate nel menu;
- rendering senza mutazione di categorie, sottocategorie o conteggi.

## Limiti residui

I test usano rendering statico React e una piccola estrazione presentazionale controllata. Non simulano eventi browser reali con jsdom, perche' il progetto non ha una libreria UI test dedicata installata. La transizione di apertura/chiusura e' comunque coperta tramite `toggleExpandedCategoryIds`, la stessa funzione usata dalla pagina.
