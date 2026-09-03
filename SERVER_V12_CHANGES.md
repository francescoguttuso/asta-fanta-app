# FantaRiggio Server v12

Correzione esclusivamente di layout/overflow del Server.

- Il contenitore principale del Server ora usa box-sizing: border-box, evitando che padding + width:100% generino overflow orizzontale.
- Il shell Server impedisce overflow orizzontale accidentale.
- La vista Rose mantiene box-sizing: border-box.
- Nessuna modifica a logica asta, dati Firestore, Rose, Schedina, Highlander o Mobile Client.
- Base: Server Dashboard v11.
