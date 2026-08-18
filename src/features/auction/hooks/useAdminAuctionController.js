import { useCallback, useEffect, useState } from 'react';
import {
  INITIAL_PARTICIPANTS,
  INITIAL_ROLE_FILTERS,
  ROLE_LIMITS,
} from '@/data/auctionDefaults';
import { filterPlayers, normalizePlayers } from '@/utils/playerUtils';
import {
  placeBid,
  removePlayerFromRoster,
  settleAuctionWinner,
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
  pendingSwitch: null,
});

export default function useAdminAuctionController() {
  const session = useAuctionSessionContext();
  const {
    docRef,
    giocatori,
    setGiocatori,
    giocatoriCatalogo,
    setGiocatoriCatalogo,
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
    pendingSwitch,
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
    reader.onload = async (loadEvent) => {
      try {
        const contenutoJson = JSON.parse(loadEvent.target.result);
        const nuoviGiocatori = normalizePlayers(
          contenutoJson.players || contenutoJson,
        );

        setGiocatori(nuoviGiocatori);
        setGiocatoriCatalogo(nuoviGiocatori);
        await saveSession({
          players: nuoviGiocatori,
          playersCatalog: nuoviGiocatori,
        });
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
    if (!giocatoreInAsta || isConfigMode || pendingSwitch) return;

    const indiceAttuale = giocatoriFiltrati.findIndex(
      (giocatore) => giocatore.id === giocatoreInAsta.id,
    );
    const nuovoIndice =
      direzione === 'avanti' ? indiceAttuale + 1 : indiceAttuale - 1;

    if (nuovoIndice >= 0 && nuovoIndice < giocatoriFiltrati.length) {
      setTimer(10);
      await saveSession({
        ...createReadyAuctionState(giocatoriFiltrati[nuovoIndice]),
      });
    }
  };

  const resettaTutto = async () => {
    if (
      !window.confirm(
        "Attenzione! Vuoi resettare l'intera sessione d'asta usando l'ultimo JSON caricato?",
      )
    ) {
      return;
    }

    const catalogo = giocatoriCatalogo?.length
      ? giocatoriCatalogo
      : giocatori;

    await saveSession({
      players: catalogo,
      playersCatalog: catalogo,
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
      pendingSwitch: null,
    });
    setTimer(10);
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

  const cambiaNomeSquadra = (id, nuovoNome) => {
    const partecipantiAggiornati = partecipanti.map((partecipante) =>
      partecipante.id === id
        ? { ...partecipante, nome: nuovoNome }
        : partecipante,
    );

    setPartecipanti(partecipantiAggiornati);
    saveSession({ participants: partecipantiAggiornati });
  };

  const impostaModalitaConfigurazione = (configMode) => {
    setIsConfigMode(configMode);
    saveSession({ configMode });
  };

  const chiamaGiocatore = (giocatore) => {
    if (isConfigMode) {
      alert('Completa e salva la configurazione prima di iniziare!');
      return;
    }
    if (pendingSwitch) return;

    setTimer(10);
    saveSession({ ...createReadyAuctionState(giocatore) });
  };

  const cambiaFiltroRuolo = (ruolo) => {
    setFiltriRuoliAttivi((filtriCorrenti) => ({
      ...filtriCorrenti,
      [ruolo]: !filtriCorrenti[ruolo],
    }));
  };

  const faiOfferta = async (incremento = 1) => {
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const admin = partecipanti.find((partecipante) => partecipante.id === 1);
    if (!admin) return;

    try {
      const result = await placeBid({
        docRef,
        bidderId: '1',
        bidderName: admin.nome || 'Admin',
        increment: incremento,
      });

      if (result?.accepted === false && result.reason === 'budget') {
        alert(
          `⛔ Offerta non consentita. Potenza economica massima: ${result.maxBid} FM.`,
        );
      }
    } catch (error) {
      console.error('Errore nel rilancio server: ', error);
    }
  };

  const completaAssegnazione = useCallback(
    async (vincitore, prezzo, switchPlayerId = null) => {
      if (!giocatoreInAsta) return;

      try {
        const result = await settleAuctionWinner({
          docRef,
          winnerId: vincitore.id,
          price: prezzo,
          selectedLetter: filtroLettera,
          activeRoleFilters: filtriRuoliAttivi,
          expectedPlayerId: giocatoreInAsta.id,
          switchPlayerId,
        });

        if (result?.needsSwitch) {
          // La transaction ha creato pendingSwitch su Firestore.
          setTimer(0);
          return result;
        }

        if (result?.assigned) {
          if (result.nextLetter) setFiltroLettera(result.nextLetter);
          setTimer(10);
        }

        return result;
      } catch (error) {
        console.error("Errore nell'assegnazione atomica:", error);
        alert(error.message || "Errore durante l'assegnazione.");
        return null;
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
    if (!giocatoreInAsta || pendingSwitch) return;
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
    pendingSwitch,
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
      isTimerStarted &&
      !pendingSwitch
    ) {
      assegnaGiocatore();
    }
  }, [
    timer,
    giocatoreInAsta,
    ultimoOfferenteId,
    isPaused,
    isTimerStarted,
    pendingSwitch,
    assegnaGiocatore,
  ]);

  const completaSwitch = async (switchPlayerId) => {
    if (!pendingSwitch) return;

    const winner = partecipanti.find((p) =>
      String(p.id) === String(pendingSwitch.winnerId),
    );
    if (!winner) return;

    return completaAssegnazione(
      winner,
      Number(pendingSwitch.price),
      switchPlayerId,
    );
  };

  const rimuoviGiocatoreDallaRosa = async (participantId, playerId) => {
    try {
      const result = await removePlayerFromRoster({
        docRef,
        participantId,
        playerId,
      });
      return result;
    } catch (error) {
      console.error('Errore rimozione giocatore:', error);
      alert(error.message || 'Errore durante la rimozione del giocatore.');
      return null;
    }
  };

  const assegnaGiocatoreManualmente = async () => {
    if (!giocatoreInAsta) return;
    if (!squadraManualeId) {
      alert('Seleziona una squadra a cui assegnare il giocatore!');
      return;
    }

    const prezzo = parseInt(prezzoManuale, 10);
    if (Number.isNaN(prezzo) || prezzo < 0) {
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
      (partecipante) => String(partecipante.id) === String(ultimoOfferenteId),
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
    completaSwitch,
    rimuoviGiocatoreDallaRosa,
    pendingSwitch,
  };
}
