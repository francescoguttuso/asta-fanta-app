# Separazione dati

Questa versione separa definitivamente i dati applicativi:

- Asta: `asta_fantacalcio/sessione_asta`
- FantaSchedina: `fanta_schedina/stagione`
- Highlander: `highlander/stagione`

Al primo accesso alle rispettive sezioni, se il nuovo documento non esiste, i dati legacy presenti in `sessione_asta.fantaSchedina` e `sessione_asta.highlander` vengono copiati nel relativo documento.

La FantaSchedina inizializza automaticamente tutte le 38 giornate come `open: true`. Dopo la prima inizializzazione, lo stato della singola giornata viene modificato solo manualmente dall'Admin.

Le schedine confermate restano non modificabili dal fantallenatore.

Non viene eliminata la vecchia struttura legacy dal documento dell'asta in questa fase: serve come rete di sicurezza durante la migrazione. Le nuove scritture di FantaSchedina e Highlander vanno esclusivamente nei rispettivi documenti separati.
