# Refactoring Kanban

Documento operativo per il refactoring strutturale di **Asta Fanta App**.

Ultimo aggiornamento: 9 agosto 2026
Stato: refactoring in corso; RF-06 completata

## Obiettivo

Ridurre soprattutto `src/App.jsx` (attualmente circa 1.230 righe), separando UI, logica di feature, dati e utility in file facili da trovare. Il refactoring deve mantenere invariati comportamento, dati Firestore e UI.

Il progetto è un MVP gestito da due sviluppatori: privilegiare codice diretto e leggibile, evitare architetture generiche, livelli superflui, nuove dipendenze o migrazioni non necessarie.

## Regole del refactoring

- Procedere per piccoli step verificabili e commit facilmente revisionabili.
- Non cambiare contemporaneamente struttura, comportamento e stile.
- Conservare nomi e forma dei campi del documento Firestore.
- Non modificare durate, limiti di ruolo, crediti iniziali o numero di partecipanti.
- Non introdurre Context API finché props e un custom hook di feature restano sufficienti.
- Non aggiungere uno state manager esterno.
- Tenere inizialmente `App.css` unico: dividere il CSS non è l'obiettivo prioritario.
- Usare componenti UI semplici e componenti di feature che orchestrano le azioni.
- Dopo ogni step eseguire almeno `npm run lint` e `npm run build`.
- Fare uno smoke test manuale dei flussi interessati; usare Playwright solo per verifiche UI che portano valore reale.
- Aggiornare questo file quando una card cambia stato, emerge un rischio o cambia il piano.
- Aggiornare `AGENTS.md` solo quando cambiano struttura, comandi, invarianti o feature rilevanti.

## Baseline prima del refactoring

Verificata l'8 agosto 2026:

- `npm run lint`: completato, con 3 warning `react-hooks/exhaustive-deps` in `src/App.jsx`.
- `npm run build`: completato con successo.
- Vite segnala un chunk JavaScript di circa 798 kB; non è un problema prioritario dell'MVP.
- Nessuna verifica browser eseguita in questa fase, perché non sono state apportate modifiche alla UI.
- `package-lock.json` era già modificato prima di creare questo documento (aggiornamento transitorio di `nanoid`); non attribuire questa modifica al refactoring.

## Funzionalità da preservare

### Vista server/admin (`/`)

- Configurazione dei nomi delle 10 fanta-squadre e blocco/sblocco configurazione.
- Navigazione tra Dashboard, Rose e placeholder Calendario/Classifica.
- Ricerca dei calciatori disponibili tramite filtri alfabetici e di ruolo.
- Chiamata di un calciatore e navigazione manuale precedente/successivo.
- Avvio manuale del timer da 10 secondi.
- Offerte admin `+1` e `+5` attribuite alla squadra con ID `1`.
- Visualizzazione migliore offerente, timer e storico delle ultime 5 offerte.
- Assegnazione automatica allo scadere e assegnazione manuale d'emergenza.
- Aggiornamento crediti, rosa e limiti per ruolo (P 3, D 8, C 8, A 6).
- Selezione automatica del prossimo calciatore rispettando i filtri correnti.
- Riepilogo rose, vista dettagliata rose e ultimo acquisto.
- Importazione di un nuovo JSON giocatori.
- Esportazione rose in CSV.
- Reset completo della sessione.
- Gestione e sblocco server-side dello STOP dopo 30 secondi.

### Vista controller mobile (`/?mobile=true`)

- Selezione libera di una delle 10 squadre.
- Visualizzazione crediti, rosa e STOP disponibili.
- Offerte `+1` e `+5` tramite transazione Firestore.
- Richiesta di massimo 2 STOP da 30 secondi per squadra.
- Visualizzazione sincrona di calciatore, offerta, timer, pausa e ultime 5 offerte.

## Invarianti tecniche

- Singolo documento Firestore: `asta_fantacalcio/sessione_asta`.
- Timer asta: 10.000 ms; STOP: 30.000 ms.
- I timer condivisi usano timestamp assoluti (`timerEndsAt`, `stopIniziatoAt`), non solo contatori locali.
- Le offerte concorrenti e l'attivazione dello STOP usano `runTransaction`.
- La rosa acquistata contiene i dati del calciatore più `prezzo`.
- Gli ID partecipante sono numeri nei dati, ma `ultimoOfferenteId` può arrivare come stringa e viene normalizzato con `parseInt`.
- `giocatori.json` può avere un oggetto con `players` e campi inglesi; l'import runtime tollera anche un array e alcuni campi italiani.
- Firebase è configurato esclusivamente con variabili `VITE_FIREBASE_*`; `.env` non va tracciato.

## Struttura proposta

La struttura è una destinazione indicativa, non un obbligo a creare tutti i file subito:

```text
src/
  App.jsx                         # sceglie server o mobile, composizione minima
  components/
    ui/                           # solo componenti davvero condivisi (es. Button/Card), se utili
  features/
    auction/
      AdminAuctionPage.jsx        # orchestration della vista server
      components/
        AppHeader.jsx
        AppNavigation.jsx
        TeamConfiguration.jsx
        AuctionPanel.jsx
        PlayerFilters.jsx
        AvailablePlayers.jsx
        TeamsSummary.jsx
        RostersView.jsx
        PlaceholderView.jsx
      hooks/
        useAuctionSession.js       # snapshot, stato condiviso e timer
      auctionActions.js            # azioni Firestore specifiche dell'asta, se l'estrazione resta chiara
    mobile/
      MobileController.jsx
      components/                  # estrarre solo se MobileController resta troppo grande
  data/
    auctionDefaults.js             # partecipanti iniziali, limiti e alfabeto
    giocatori.json
  utils/
    playerUtils.js                 # parse, sort, filter e scelta prossimo giocatore
    timerUtils.js
    csvUtils.js                    # solo se l'export migliora davvero la leggibilità
  firebaseConfig.js
  App.css
  index.css
  main.jsx
```

Evitare barrel file (`index.js`) e directory con un solo wrapper privo di valore. Se un'estrazione richiede molte props ma il componente rappresenta una feature chiara, le props esplicite sono preferibili a un Context prematuro.

## Kanban

### Da fare

#### RF-07 — Alleggerire il controller mobile (solo se utile)

- Spostare il file sotto `features/mobile/`.
- Estrarre selettore squadra, pannello offerta e storico soltanto se il file resta difficile da leggere.
- Valutare la condivisione dell'azione di offerta con l'admin, mantenendo distinta la UI.

Verifica: selezione squadra, offerte, STOP esauriti e aggiornamento rosa.

#### RF-08 — Pulizia finale e documentazione

- Rimuovere import, helper e CSS certamente inutilizzati solo dopo il completamento degli spostamenti.
- Aggiornare README con descrizione reale, setup `.env`, comandi e URL delle due viste.
- Aggiornare `AGENTS.md` e questo Kanban con la struttura finale.
- Eseguire smoke test finale server/mobile e annotare eventuali problemi preesistenti non risolti.

Verifica: `npm run lint`, `npm run build`, stato Git limitato ai file previsti.

### In corso

Nessuna card. Il prossimo step consigliato è **RF-07**.

### Completato

#### RF-00 — Esplorazione e baseline

- Analizzati struttura, script, dataset, UI server/mobile e modello Firestore.
- Eseguiti lint e build iniziali.
- Registrati rischi e comportamento da preservare.
- Creati `REFACTORING_KANBAN.md` e `AGENTS.md`.

#### RF-01 — Estrarre dati, costanti e funzioni pure

- Creato `src/data/auctionDefaults.js` per dataset normalizzato, partecipanti iniziali, limiti ruolo, alfabeto e filtri iniziali.
- Creato `src/utils/playerUtils.js` per normalizzazione, ordinamento, filtri, conteggi ruolo e scelta ciclica del prossimo giocatore.
- Riutilizzati i limiti ruolo anche nella vista mobile.
- Rimossa da `App.jsx` la duplicazione della scelta del prossimo giocatore nelle assegnazioni normale e manuale.
- Eliminato `src/database.js`, che non era importato e duplicava dati incompleti.
- Verificati lint e build (restano i 3 warning già presenti nella baseline) e controllati con input mirati normalizzazione, ordinamento, conteggi e selezione ciclica.

#### RF-02 — Estrarre i componenti presentazionali della shell admin

- Creati `AppHeader`, `AppNavigation` e `TeamConfiguration` sotto `src/features/auction/components/`.
- Mantenuti invariati testi, classi CSS, stili inline, struttura DOM visibile e handler di `App.jsx`.
- Lasciata tutta la logica Firestore e di stato nel componente principale.
- Verificati lint e build; restano i 3 warning già presenti nella baseline.
- Eseguito uno smoke test desktop isolato da Firebase: header, navigazione, 10 campi squadra e passaggio Dashboard/Rose corretti; confronto visivo a 1440 px senza regressioni rilevate.

#### RF-03 — Estrarre i blocchi della Dashboard

- Creati `AuctionPanel`, `AvailablePlayers` e `TeamsSummary` sotto `src/features/auction/components/`.
- Lasciati in `App.jsx` stato, timer, offerte, assegnazioni, chiamata giocatore e aggiornamento filtri; i componenti ricevono dati e callback esplicite.
- Conservati classi CSS, testi, struttura DOM e stili esistenti senza ridisegnare la Dashboard.
- `App.jsx` è stato ridotto da 1.081 a circa 800 righe.
- Verificati lint e build; restano i 3 warning già presenti nella baseline.
- Smoke test desktop eseguito con Firebase fittizio: rendering dei tre pannelli, conteggi, filtro ruolo, filtro lettera e navigazione Dashboard/Rose corretti; nessuna scrittura sui dati reali.

#### RF-04 — Estrarre le viste secondarie

- Creati `RostersView` e `PlaceholderView` sotto `src/features/auction/components/`.
- Spostata la vista Rose mantenendo il conteggio ruoli tramite `countRosterRoles` e gli stessi contenuti e stili.
- Condiviso un solo placeholder semplice tra Calendario e Classifica.
- `App.jsx` è stato ridotto da circa 800 a 771 righe.
- Verificati lint e build; restano i 3 warning già presenti nella baseline.
- Smoke test eseguito con Firebase fittizio: navigazione Dashboard, Rose, Calendario e Classifica e relativi contenuti corretti; nessuna scrittura sui dati reali.

#### RF-05 — Isolare sincronizzazione sessione e timer

- Creato `useAuctionSession` per stato condiviso, snapshot Firestore, salvataggio della sessione e timer derivati di asta e STOP.
- Reso stabile il riferimento al documento `asta_fantacalcio/sessione_asta` a livello di modulo.
- Condiviso il countdown STOP tra server e mobile, rimuovendo l'effect duplicato dal controller mobile.
- Mantenuti auto-assegnazione e sblocco automatico dello STOP responsabili esclusivamente della vista server.
- Stabilizzata l'assegnazione automatica con `useCallback`; `npm run lint` passa ora senza i 3 warning degli effect presenti nella baseline.
- Ripristinato in `App.jsx` l'import di `ROLE_LIMITS`, già usato ma mancante nel commit precedente e quindi potenziale errore runtime nei flussi admin.
- `App.jsx` è stato ridotto da 771 a circa 617 righe.
- Verificati lint, build e rendering isolato delle viste server/mobile con Firebase fittizio. Refresh durante timer, offerte e STOP/ripresa richiedono ancora uno smoke test con un Firestore di test o emulatore; nessuna scrittura è stata effettuata sui dati reali.

#### RF-06 — Raggruppare le azioni d'asta

- Creato `src/features/auction/auctionActions.js` con azioni Firestore esplicite per salvataggio sessione, avvio timer, rilancio, richiesta STOP e ripresa.
- Condivisa la stessa transazione di rilancio tra server e mobile, conservando payload, reset del timer e storico massimo di 5 offerte.
- Sostituita la firma posizionale di `salvaSuFirebase` con `saveSession({ ... })`, usando proprietà nominate e mantenendo gli stessi default.
- Estratto `buildPlayerAssignment` per condividere tra assegnazione normale e manuale aggiornamento crediti/rosa, rimozione del giocatore, ultimo acquisto e scelta del successivo.
- Lasciate nei controller le validazioni e i messaggi specifici; l'assegnazione continua intenzionalmente a usare `setDoc` e non una nuova transazione.
- `App.jsx` è stato ridotto da circa 617 a 541 righe; anche `MobileController.jsx` è stato alleggerito dalle transazioni inline.
- Verificati `npm run lint`, `npm run build`, payload Firestore e dipendenze degli effect. I flussi concorrenti completi richiedono ancora un Firestore di test o emulatore e non sono stati eseguiti sui dati reali.
- Dopo il primo smoke test utente, ripristinato l'import di `sortPlayersAlphabetically` ancora necessario allo snapshot; verificato nel browser che il banditore e la sessione Firestore esistente vengano caricati senza errori console.

## Problemi e rischi preesistenti da non confondere con regressioni

Questi punti non vanno corretti durante gli spostamenti meccanici, salvo richiesta esplicita:

- Assegnazione normale/manuale usa stato locale e `setDoc`, non una transazione: più tab server potrebbero creare conflitti.
- Auto-assegnazione allo scadere e sblocco automatico dello STOP dipendono dalla presenza di una vista server aperta.
- L'identità mobile non è autenticata: un utente può selezionare qualsiasi squadra.
- Il limite crediti non blocca l'offerta; viene controllato durante l'assegnazione.
- Non sono presenti `.env.example`, test automatici o gestione esplicita dell'errore di `onSnapshot`.
- Il pulsante “Esporta CSV Pulito” genera correttamente un CSV, non un vero file Excel.
- Calendario e Classifica sono soltanto placeholder.
- Il README è ancora quello predefinito di Vite.

## Checklist di smoke test finale

- [ ] Avvio con `.env` locale tramite `npm run dev`.
- [ ] Configurazione e rinomina delle 10 squadre.
- [ ] Blocco configurazione e chiamata di un calciatore.
- [ ] Filtri lettera/ruolo e precedente/successivo.
- [ ] Avvio timer e rilanci admin `+1`/`+5`.
- [ ] Collegamento mobile con `/?mobile=true` e selezione squadra.
- [ ] Rilanci concorrenti e storico massimo 5 elementi.
- [ ] STOP mobile, decremento disponibilità e ripresa dopo 30 secondi.
- [ ] Assegnazione automatica e manuale, crediti e rosa aggiornati.
- [ ] Limiti P/D/C/A rispettati.
- [ ] Vista Rose e placeholder di navigazione.
- [ ] Import JSON, export CSV e reset (usare una sessione di test).
- [ ] Refresh di server e mobile durante un'asta in corso.
