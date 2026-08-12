import { useCallback, useEffect, useState } from 'react';
import {
  INITIAL_PARTICIPANTS,
  INITIAL_PLAYERS,
  INITIAL_ROLE_FILTERS,
  ROLE_LIMITS,
} from '@/data/auctionDefaults';
import { filterPlayers, normalizePlayers } from '@/utils/playerUtils';
import {
  assignPlayer,
  changePlayerManual,
  placeBid,
  startAuctionTimer,
} from '../auctionActions';
import { useAuctionSessionContext } from '../context/useAuctionContexts';

const createReadyAuctionState = (playerInAuction) => ({
  playerInAuction,
  currentBid: 0,
  timerStarted: false,
  lastBidderId: null,
  paused: false,
  stopCalledBy: null,
  stopStartedAt: null,
  bidHistory: [],
  timer: 10,
  timerEndsAt: null,
});

export default function useAdminAuctionController() {
  const session = useAuctionSessionContext();
  const {
    docRef,
    giocatori,
    setGiocatori,
    partecipanti,
    setPartecipanti,
    isConfigMode,
    setIsConfigMode,
    giocatoreInAsta,
    offertaCorrente,
    isTimerStarted,
    ultimoOfferenteId,
    isPaused,
    setTimer,
    timer,
    saveSession,
  } = session;

  const [vistaCorrente, setVistaCorrente] = useState('dashboard');
  const [squadraManualeId, setSquadraManualeId] = useState('');
  const [prezzoManuale, setPrezzoManuale] = useState('');
  const [filtroLettera, setFiltroLettera] = useState('TUTTE');
  const [filtriRuoliAttivi, setFiltriRuoliAttivi] =
    useState(INITIAL_ROLE_FILTERS);

  const gestisciCaricamentoJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const contenutoJson = JSON.parse(loadEvent.target.result);
        const nuoviGiocatori = normalizePlayers(
          contenutoJson.players || contenutoJson,
        );

        setGiocatori(nuoviGiocatori);
        saveSession({ players: nuoviGiocatori });
        alert('File JSON importato e aggiornato con successo!');
      } catch (errore) {
        console.error('Errore durante il parsing del JSON:', errore);
        alert('Il file selezionato non è un JSON valido.');
      }
    };
    reader.readAsText(file);
  };

  const avviaTimerManualmente = async () => {
    try {
      await startAuctionTimer({ docRef });
    } catch (error) {
      console.error("Errore nell'avvio del timer:", error);
    }
  };

  const giocatoriFiltrati = filterPlayers(
    giocatori,
    filtroLettera,
    filtriRuoliAttivi,
  );

  const cambiaGiocatoreManuale = async (direzione) => {
    if (!giocatoreInAsta || isConfigMode) return;

    try {
      const result = await changePlayerManual({
        docRef,
        direction: direzione,
        selectedLetter: filtroLettera,
        activeRoleFilters: filtriRuoliAttivi,
      });

      if (result?.nextLetter) {
        setTimer(10);
      }
    } catch (error) {
      console.error('Errore nel cambio manuale del giocatore:', error);
    }
  };

  const resettaTutto = async () => {
    if (
      !window.confirm(
        "Attenzione! Vuoi resettare l'intera sessione d'asta e ricaricare i giocatori dal file JSON?",
      )
    ) {
      return;
    }

    try {
      await saveSession({
        players: INITIAL_PLAYERS,
        participants: INITIAL_PARTICIPANTS,
        configMode: true,
        playerInAuction: null,
        currentBid: 0,
        timerStarted: false,
        lastBidderId: null,
        paused: false,
        stopCalledBy: null,
        stopStartedAt: null,
        lastPurchase: null,
        bidHistory: [],
        timer: 10,
        timerEndsAt: null,
      });
      setTimer(10);
    } catch (error) {
      console.error('Errore nel reset della sessione:', error);
    }
  };

  const esportaInExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    partecipanti.forEach((partecipante) => {
      partecipante.rosa?.forEach((giocatore) => {
        csvContent += `${partecipante.nome},${giocatore.id},${giocatore.prezzo}\n`;
      });
    });

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'fantariggio_rosters.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cambiaNomeSquadra = async (id, nuovoNome) => {
    const partecipantiAggiornati = partecipanti.map((partecipante) =>
      String(partecipante.id) === String(id)
        ? { ...partecipante, nome: nuovoNome }
        : partecipante,
    );

    setPartecipanti(partecipantiAggiornati);
    await saveSession({ participants: partecipantiAggiornati });
  };

  const impostaModalitaConfigurazione = async (configMode) => {
    setIsConfigMode(configMode);
    await saveSession({ configMode });
  };

  const chiamaGiocatore = async (giocatore) => {
    if (isConfigMode) {
      alert('Completa e salva la configurazione prima di iniziare!');
      return;
    }

    setTimer(10);
    await saveSession({
      ...createReadyAuctionState(giocatore),
    });
  };

  const cambiaFiltroRuolo = (ruolo) => {
    setFiltriRuoliAttivi((filtriCorrenti) => ({
      ...filtriCorrenti,
      [ruolo]: !filtriCorrenti[ruolo],
    }));
  };

  const faiOfferta = async (incremento = 1) => {
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const admin = partecipanti.find((partecipante) =>
      String(partecipante.id) === '1',
    );

    if (admin) {
      const ruolo = giocatoreInAsta.ruolo;
      const giocatoriNelRuolo = admin.rosa.filter(
        (giocatore) => giocatore.ruolo === ruolo,
      ).length;

      if (giocatoriNelRuolo >= (ROLE_LIMITS[ruolo] || 0)) {
        alert(
          `⛔ Impossibile offrire: hai già completato i ${ruolo} (${ROLE_LIMITS[ruolo]}/${ROLE_LIMITS[ruolo]})!`,
        );
        return;
      }
    }

    try {
      await placeBid({
        docRef,
        bidderId: '1',
        bidderName: admin?.nome || 'Admin',
        increment: incremento,
      });
    } catch (error) {
      console.error('Errore nel rilancio server: ', error);
    }
  };

  const completaAssegnazione = useCallback(
    async (vincitore, prezzo) => {
      if (!giocatoreInAsta) return;

      try {
        const result = await assignPlayer({
          docRef,
          winnerId: vincitore.id,
          price: prezzo,
          selectedLetter: filtroLettera,
          activeRoleFilters: filtriRuoliAttivi,
          expectedPlayerId: giocatoreInAsta.id,
        });

        if (result?.assigned) {
          if (result.nextLetter) {
            setFiltroLettera(result.nextLetter);
          }
          setTimer(10);
        }
      } catch (error) {
        console.error('Errore nell\'assegnazione atomica:', error);
      }
    },
    [
      docRef,
      giocatoreInAsta,
      filtroLettera,
      filtriRuoliAttivi,
      setTimer,
    ],
  );

  const assegnaGiocatore = useCallback(async () => {
    if (!giocatoreInAsta) return;

    if (!ultimoOfferenteId) {
      alert(
        'Impossibile assegnare: nessuna offerta ricevuta per questo calciatore.',
      );
      return;
    }

    const vincitore = partecipanti.find((partecipante) =>
      String(partecipante.id) === String(ultimoOfferenteId),
    );

    if (!vincitore) return;

    await completaAssegnazione(vincitore, offertaCorrente);
  }, [
    giocatoreInAsta,
    ultimoOfferenteId,
    partecipanti,
    offertaCorrente,
    completaAssegnazione,
  ]);

  useEffect(() => {
    if (
      timer === 0 &&
      giocatoreInAsta &&
      ultimoOfferenteId &&
      !isPaused &&
      isTimerStarted
    ) {
      /*
       * Può essere eseguito su tutti i dispositivi.
       * assignPlayer() usa una transaction e quindi solo uno
       * riuscirà ad assegnare il giocatore.
       */
      assegnaGiocatore();
    }
  }, [
    timer,
    giocatoreInAsta,
    ultimoOfferenteId,
    isPaused,
    isTimerStarted,
    assegnaGiocatore,
  ]);

  const assegnaGiocatoreManualmente = async () => {
    if (!giocatoreInAsta) return;

    if (!squadraManualeId) {
      alert('Seleziona una squadra a cui assegnare il giocatore!');
      return;
    }

    const prezzo = parseInt(prezzoManuale, 10);
    if (isNaN(prezzo) || prezzo < 0) {
      alert('Inserisci un prezzo di acquisto valido!');
      return;
    }

    const vincitore = partecipanti.find(
      (partecipante) => String(partecipante.id) === String(squadraManualeId),
    );

    if (!vincitore) return;

    setSquadraManualeId('');
    setPrezzoManuale('');
    await completaAssegnazione(vincitore, prezzo);
  };

  return {
    vistaCorrente,
    setVistaCorrente,
    squadraManualeId,
    setSquadraManualeId,
    prezzoManuale,
    setPrezzoManuale,
    filtroLettera,
    setFiltroLettera,
    filtriRuoliAttivi,
    giocatoriFiltrati,
    ultimoOfferente: partecipanti.find(
      (partecipante) =>
        String(partecipante.id) === String(ultimoOfferenteId),
    ),
    gestisciCaricamentoJson,
    avviaTimerManualmente,
    cambiaGiocatoreManuale,
    resettaTutto,
    esportaInExcel,
    cambiaNomeSquadra,
    impostaModalitaConfigurazione,
    chiamaGiocatore,
    cambiaFiltroRuolo,
    faiOfferta,
    assegnaGiocatore,
    assegnaGiocatoreManualmente,
  };
}
