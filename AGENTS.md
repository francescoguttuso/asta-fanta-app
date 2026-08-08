# AGENTS.md

Contesto operativo per agenti AI che lavorano su **Asta Fanta App**.

Aggiornato il 9 agosto 2026. Leggere anche `REFACTORING_KANBAN.md` prima di iniziare o proseguire il refactoring.

## Progetto

SPA React 19 + Vite per gestire un'asta di fantacalcio tra amici. Firebase Firestore sincronizza in tempo reale un server/banditore e i controller mobile dei partecipanti.

- Fork di lavoro: `https://github.com/emanuelefavero/asta-fanta-app`
- Repository originale: `https://github.com/francescoguttuso/asta-fanta-app`
- Deploy: `https://asta-fanta-app.vercel.app/`
- Vista server/admin: `/`
- Vista partecipante: `/?mobile=true`

È un MVP personale mantenuto da due sviluppatori. Priorità: leggibilità, facilità di orientamento e modifiche piccole. Evitare over-engineering.

## Comandi

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

Non esiste al momento una suite di test automatizzata. Per modifiche strutturali eseguire almeno lint e build; usare smoke test manuali mirati e Playwright solo quando serve verificare la UI.

## Configurazione locale

Firebase usa queste variabili Vite in un file `.env` locale non tracciato:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Non leggere, stampare o committare segreti del file `.env`. Non inserire credenziali nel codice.

## Struttura corrente

```text
src/
  App.jsx               # azioni d'asta e composizione delle viste admin/mobile
  data/
    auctionDefaults.js  # giocatori/partecipanti iniziali, limiti, alfabeto e filtri ruolo
  features/
    auction/
      auctionActions.js        # salvataggio, transazioni asta/STOP e calcolo assegnazione
      components/
        AppHeader.jsx          # titolo e azioni import/export/reset
        AppNavigation.jsx      # navigazione tra le viste admin
        AuctionPanel.jsx       # banditore, timer, offerte e assegnazioni
        AvailablePlayers.jsx   # filtri ed elenco dei giocatori disponibili
        PlaceholderView.jsx    # placeholder Calendario/Classifica
        RostersView.jsx        # dettaglio rose di tutti i partecipanti
        TeamConfiguration.jsx  # configurazione e modifica nomi squadre
        TeamsSummary.jsx       # riepilogo crediti e rose della Dashboard
      hooks/
        useAuctionSession.js   # stato condiviso, snapshot, salvataggio e timer asta/STOP
    mobile/
      MobileController.jsx     # selezione locale, validazioni e orchestrazione mobile
      components/
        BidHistory.jsx         # storico delle ultime offerte
        MobileAuctionPanel.jsx # giocatore, timer, rilanci e richiesta STOP
        TeamSelector.jsx       # selettore squadra e riepilogo crediti/rosa
  utils/
    playerUtils.js      # normalizzazione, sort, filtri, conteggi e prossimo giocatore
  firebaseConfig.js     # inizializzazione Firebase/Firestore da import.meta.env
  timerUtils.js         # durate e calcoli timer condivisi
  giocatori.json        # dataset iniziale (494 calciatori al 2026-08-08)
  App.css               # stili condivisi desktop/mobile
  index.css             # background globale
  main.jsx              # entry point React con StrictMode
```

`App.jsx` è il principale obiettivo del refactoring. Shell, Dashboard e viste secondarie admin sono separate in componenti presentazionali; stato condiviso, snapshot e timer sono isolati in `useAuctionSession`. Le operazioni Firestore e il calcolo condiviso dell'assegnazione sono in `auctionActions.js`; `App.jsx` mantiene orchestrazione, validazioni e messaggi della vista admin. La vista mobile è organizzata sotto `features/mobile/`, con logica nel controller e markup nei tre componenti dedicati. Non riportare markup o logica già estratti nei controller.

## Funzionamento attuale

La vista server configura 10 fanta-squadre da 500 crediti, chiama i giocatori, avvia il timer di 10 secondi, può offrire come squadra ID 1, assegna il vincitore, importa JSON, esporta CSV e resetta la sessione. Offre filtri alfabetici/ruolo, riepilogo e dettaglio rose. Calendario e Classifica sono placeholder.

La vista `?mobile=true` permette di scegliere liberamente una squadra, offrire `+1`/`+5`, vedere crediti/rosa/storico e usare 2 STOP da 30 secondi. Non esiste autenticazione o autorizzazione per squadra.

Limiti rosa:

- P: 3
- D: 8
- C: 8
- A: 6

## Modello Firestore

Tutta la sessione è nel documento:

```text
asta_fantacalcio/sessione_asta
```

Campi principali:

```text
giocatori
partecipanti
isConfigMode
giocatoreInAsta
offertaCorrente
isTimerStarted
ultimoOfferenteId
isPaused
stopChiamatoDa
stopIniziatoAt
ultimoAcquisto
storicoOfferte
timer
timerEndsAt
timerRimanenteMs   # usato durante uno STOP
```

Forma essenziale dei dati:

```js
player = { id, nome, squadra, ruolo }
acquiredPlayer = { ...player, prezzo }
participant = {
  id,
  nome,
  crediti,
  rosa: acquiredPlayer[],
  stopDisponibili,
}
```

`ultimoOfferenteId` può essere una stringa perché proviene dal valore di un `<select>` mobile. Il codice attuale usa `parseInt` durante i confronti. Non cambiare tipi o nomi dei campi persistiti senza una migrazione esplicita.

Le offerte e gli STOP usano le transazioni definite in `auctionActions.js`. Timer e STOP condivisi si basano su timestamp assoluti e vengono derivati da `useAuctionSession` per restare coerenti tra client. Auto-assegnazione e fine automatica dello STOP vengono eseguiti soltanto dalla vista server aperta.

## Regole per le modifiche

- Il refactoring corrente è strutturale: UI e comportamento devono restare invariati.
- Preferire estrazioni meccaniche e piccoli componenti di feature con props esplicite.
- Creare componenti UI generici solo quando esiste riuso reale.
- Preferire funzioni pure per parse, sort, filtri, conteggi e scelta del prossimo giocatore.
- Tenere in `useAuctionSession` stato condiviso, snapshot e timer; non spostarvi azioni d'asta non correlate.
- Passare oggetti nominati alle azioni di `auctionActions.js`; mantenere espliciti gli input e i campi Firestore aggiornati.
- Non introdurre Redux, Zustand, router, TypeScript, librerie UI o nuove dipendenze senza richiesta.
- Non usare Context API solo per evitare prop drilling limitato.
- Non dividere prematuramente `App.css`; preservare classi e markup durante gli spostamenti.
- Non modificare insieme struttura e logica d'asta. Le correzioni funzionali vanno isolate e concordate.
- Preservare il supporto ai JSON `{ players: [...] }` e agli array importati direttamente.
- Non modificare il documento Firestore o resettare dati reali durante test non autorizzati.
- Trattare modifiche già presenti nel worktree come lavoro dell'utente; non sovrascriverle.

## Verifica e problemi noti

Baseline del 2026-08-08:

- `npm run lint` passa senza warning dopo RF-05.
- `npm run build` passa; Vite segnala il chunk principale sopra 500 kB.
- Lint e build non hanno intercettato un riferimento non importato nel callback `onSnapshot`: dopo spostamenti di import usati in callback asincroni, eseguire anche uno smoke test browser mirato.
- Assegnazione normale/manuale non è transazionale e può essere vulnerabile a più tab server.
- Il credito disponibile è verificato in assegnazione, non durante ogni offerta.
- Manca un `.env.example`; il README è ancora quello del template Vite.

Questi problemi sono preesistenti: non mascherarli in un refactoring meccanico. Consultare il Kanban per piano, rischi e checklist completa.

## Manutenzione di questo file

Aggiornare `AGENTS.md` in modo breve quando cambiano:

- struttura e responsabilità dei file;
- comandi o configurazione;
- feature e flussi principali;
- modello Firestore o invarianti importanti;
- baseline di verifica e problemi noti rilevanti.

Non trasformarlo in un changelog e non documentare dettagli temporanei di implementazione.
