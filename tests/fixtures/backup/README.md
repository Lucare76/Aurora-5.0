# Backup Fixtures

Queste fixture statiche documentano i casi principali del formato backup senza
toccare database, API, RPC o logica contabile.

- `valid-minimal-v1.json`: struttura minima valida del formato Aurora Backup v1.
- `invalid-root-array.json`: root non oggetto.
- `invalid-wrong-format.json`: formato non riconosciuto.
- `invalid-future-schema-version.json`: versione schema futura.
- `invalid-dangerous-key.json`: chiave pericolosa da bloccare.

Le fixture più articolate e i casi combinatori sono generati in
`backup-fixtures.ts`, così i test possono alterare un singolo campo per volta
mantenendo checksum e conteggi coerenti quando necessario.
