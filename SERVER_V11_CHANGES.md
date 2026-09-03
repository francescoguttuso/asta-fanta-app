# Server v11

Correzione della vista Rose desktop rispetto alla prova v10.

- Base: Server v9 approvata.
- Rimossa l'idea di allargare la griglia con larghezze >100% e margini negativi.
- Solo quando `vistaCorrente === "rose"` il contenitore principale usa tutta la larghezza disponibile nella colonna a destra della sidebar.
- La sidebar resta sempre fuori dalla griglia Rose.
- Nessuno scroll orizzontale.
- Mobile invariato.
- Nessuna modifica a logica, dati, Firestore, asta, Schedina o Highlander.
