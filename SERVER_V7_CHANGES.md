# FantaRiggio Server v7 — Rose + listone asta

## Modifiche

### Rose
- Le rose restano orientate verticalmente.
- Nome squadra, crediti e relativa formazione sono nello stesso blocco verticale.
- Eliminato lo scroll orizzontale della schermata Rose.
- Tutte le squadre vengono distribuite nella larghezza disponibile.
- Il cestino per svincolare un giocatore resta sempre presente.
- Lo svincolo restituisce automaticamente i crediti e reinserisce il giocatore nel listone dei disponibili.

### Listone asta — regola fondamentale
`giocatori` rappresenta esclusivamente i giocatori NON assegnati.

- Un giocatore presente in una rosa viene filtrato dal listone.
- L'importazione delle rose ricostruisce il listone escludendo tutti i giocatori assegnati.
- L'importazione del JSON non reinserisce giocatori già presenti nelle rose.
- Anche il caricamento della sessione Firestore normalizza il listone in base alle rose esistenti, così una vecchia sessione con dati duplicati non mostra giocatori già assegnati.
- Quando un giocatore viene svincolato, viene reinserito nel listone.
- L'assegnazione e il taglio contestuale applicano un ulteriore filtro di sicurezza per mantenere questa regola.

## Protezione dati
- Il redesign non modifica i componenti Mobile Client v13.
- Il salvataggio della sessione asta continua a usare `merge: true`, evitando la sostituzione dell'intero documento Firestore condiviso.
- Non sono state modificate le feature Schedina e Highlander.
