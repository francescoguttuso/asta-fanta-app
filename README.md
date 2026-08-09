# Asta Fanta App

SPA React per gestire un'asta di fantacalcio tra amici. Una vista server viene usata dal banditore, mentre i partecipanti usano la vista mobile per rilanciare e richiedere uno STOP. La sessione è sincronizzata in tempo reale tramite Firebase Firestore.

- Deploy: [asta-fanta-app.vercel.app](https://asta-fanta-app.vercel.app/)
- Vista server/admin: `/`
- Vista controller mobile: `/?mobile=true`
- Fork di lavoro: [emanuelefavero/asta-fanta-app](https://github.com/emanuelefavero/asta-fanta-app)
- Repository originale: [francescoguttuso/asta-fanta-app](https://github.com/francescoguttuso/asta-fanta-app)

## Funzionalità

La vista server permette di:

- configurare i nomi delle 10 fanta-squadre;
- filtrare e chiamare i calciatori disponibili;
- avviare il timer d'asta da 10 secondi e inserire rilanci admin;
- assegnare automaticamente o manualmente un calciatore;
- controllare crediti, rose, limiti di ruolo e ultimo acquisto;
- importare un dataset JSON, esportare le rose in CSV e resettare la sessione;
- gestire la ripresa automatica dopo uno STOP da 30 secondi.

La vista mobile permette a ogni partecipante di selezionare una squadra, vedere crediti e rosa, rilanciare di 1 o 5 FM e usare fino a 2 STOP.

## Stack

- React 19
- Vite
- Firebase Firestore
- Oxlint

## Avvio locale

Requisiti: Node.js e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Compilare `.env` con la configurazione Firebase del progetto:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Il file `.env` è ignorato da Git e non deve essere committato.

## Comandi

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia il server Vite di sviluppo |
| `npm run lint` | Esegue Oxlint |
| `npm run build` | Genera la build di produzione in `dist/` |
| `npm run preview` | Avvia localmente la build di produzione |

Non è presente una suite di test automatizzata. Per verificare le modifiche vengono usati lint, build e smoke test browser mirati.

## Dati e sincronizzazione

Tutta la sessione condivisa usa il documento Firestore:

```text
asta_fantacalcio/sessione_asta
```

Offerte e STOP usano transazioni Firestore. I timer condivisi usano timestamp assoluti, così server e controller possono derivare il tempo rimanente dalla stessa sessione.

Lo stato sincronizzato è esposto da un Context di sessione condiviso tra vista server e mobile. La vista server usa un secondo Context, limitato alla feature admin, per filtri, navigazione e comandi dell'asta. Gli aggiornamenti ordinari chiamano `saveSession` passando soltanto i campi modificati; il provider completa il documento con lo stato corrente.

Il dataset iniziale è in `src/giocatori.json`. L'import accetta sia un array di calciatori sia un oggetto `{ "players": [...] }`, con i campi italiani o inglesi supportati dall'app.

## Struttura principale

```text
src/
  App.jsx                         # scelta vista e provider della sessione
  data/auctionDefaults.js
  features/
    auction/
      AdminAuctionPage.jsx
      auctionActions.js
      components/
      context/
      hooks/
        useAdminAuctionController.js
        useAuctionSession.js
    mobile/
      MobileController.jsx
      components/
  utils/playerUtils.js
  firebaseConfig.js
  timerUtils.js
  giocatori.json
```

Per il contesto tecnico completo e le indicazioni operative leggere [AGENTS.md](./AGENTS.md).

## Limiti attuali dell'MVP

- La selezione della squadra mobile non usa autenticazione.
- L'assegnazione del giocatore non è transazionale.
- Auto-assegnazione e fine automatica dello STOP richiedono una vista server aperta.
- Calendario e Classifica sono ancora placeholder.
