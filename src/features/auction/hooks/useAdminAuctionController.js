import { useCallback, useEffect, useState } from 'react';
import {
  INITIAL_PARTICIPANTS,
  INITIAL_PLAYERS,
  INITIAL_ROLE_FILTERS,
  ROLE_LIMITS,
} from '@/data/auctionDefaults';
import { filterPlayers, normalizePlayers } from '@/utils/playerUtils';
import {
  buildPlayerAssignment,
  completeContextualSwitch,
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
    pendingSwitch,
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

  const cambiaGiocatoreManuale = (direzione) => {
    if (!giocatoreInAsta || isConfigMode) return;

    const indiceAttuale = giocatoriFiltrati.findIndex(
      (giocatore) => giocatore.id === giocatoreInAsta.id,
    );
    const nuovoIndice =
      direzione === 'avanti' ? indiceAttuale + 1 : indiceAttuale - 1;

    if (nuovoIndice >= 0 && nuovoIndice < giocatoriFiltrati.length) {
      setTimer(10);
      saveSession({
        ...createReadyAuctionState(giocatoriFiltrati[nuovoIndice]),
      });
    }
  };

  const resettaTutto = () => {
    if (
      !window.confirm(
        "Attenzione! Vuoi resettare l'intera sessione d'asta e ricaricare i giocatori dal file JSON?",
      )
    ) {
      return;
    }

    saveSession({
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

    setTimer(10);
    saveSession({
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

    const admin = partecipanti.find((partecipante) => partecipante.id === 1);
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
      const assegnazione = buildPlayerAssignment({
        players: giocatori,
        participants: partecipanti,
        player: giocatoreInAsta,
        winner: vincitore,
        price: prezzo,
        selectedLetter: filtroLettera,
        activeRoleFilters: filtriRuoliAttivi,
      });

      setFiltroLettera(assegnazione.nextLetter);
      setTimer(10);
      await saveSession({
        players: assegnazione.remainingPlayers,
        participants: assegnazione.updatedParticipants,
        ...createReadyAuctionState(assegnazione.nextPlayer),
        lastPurchase: assegnazione.lastPurchase,
      });
    },
    [
      giocatori,
      partecipanti,
      giocatoreInAsta,
      filtroLettera,
      filtriRuoliAttivi,
      saveSession,
      setTimer,
    ],
  );

  const assegnaGiocatore = useCallback(async () => {
    if (!giocatoreInAsta) return;

    if (!ultimoOfferenteId) {
      alert('Impossibile assegnare: nessuna offerta ricevuta per questo calciatore.');
      return;
    }

    const vincitore = partecipanti.find(
      (partecipante) => partecipante.id === parseInt(ultimoOfferenteId),
    );
    if (!vincitore) return;

    const ruolo = giocatoreInAsta.ruolo;
    const repartoPieno =
      vincitore.rosa.filter((giocatore) => giocatore.ruolo === ruolo).length >=
      (ROLE_LIMITS[ruolo] || 0);
    const creditiInsufficienti =
      Number(vincitore.crediti || 0) < Number(offertaCorrente || 0);

    if (creditiInsufficienti || repartoPieno) {
      const switchCandidates = vincitore.rosa.filter(
        (giocatore) => giocatore.ruolo === ruolo,
      );

      alert(
        creditiInsufficienti
          ? `Errore: ${vincitore.nome} non possiede crediti sufficienti! Ora scegli il giocatore da svincolare.`
          : `${vincitore.nome} ha già completato il reparto dei ${ruolo}. Ora scegli il giocatore da svincolare.`,
      );

      await saveSession({
        pendingSwitch: {
          winnerId: vincitore.id,
          winnerName: vincitore.nome,
          player: giocatoreInAsta,
          price: Number(offertaCorrente || 0),
          switchCandidates,
          selectedLetter: filtroLettera,
          activeRoleFilters: filtriRuoliAttivi,
        },
        timerStarted: false,
        timer: 0,
        paused: true,
      });
      return;
    }

    await completaAssegnazione(vincitore, offertaCorrente);
  }, [
    giocatoreInAsta,
    ultimoOfferenteId,
    partecipanti,
    offertaCorrente,
    completaAssegnazione,
    saveSession,
    filtroLettera,
    filtriRuoliAttivi,
  ]);

  const completaSwitch = useCallback(async (candidateId) => {
    if (!pendingSwitch) return;

    try {
      await completeContextualSwitch({
        docRef,
        winnerId: pendingSwitch.winnerId,
        candidateId,
      });
    } catch (error) {
      console.error('Errore nel taglio contestuale:', error);
      alert(error.message || 'Errore nel completamento dello switch.');
    }
  }, [docRef, pendingSwitch]);


  useEffect(() => {
    if (
      timer === 0 &&
      giocatoreInAsta &&
      ultimoOfferenteId &&
      !isPaused &&
      isTimerStarted
    ) {
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

    const prezzo = parseInt(prezzoManuale);
    if (isNaN(prezzo) || prezzo < 0) {
      alert('Inserisci un prezzo di acquisto valido!');
      return;
    }

    const vincitore = partecipanti.find(
      (partecipante) => partecipante.id === parseInt(squadraManualeId),
    );
    if (!vincitore) return;
    if (vincitore.crediti < prezzo) {
      alert(
        `Attenzione: ${vincitore.nome} ha solo ${vincitore.crediti} FM e non può spendere ${prezzo} FM!`,
      );
      return;
    }

    const ruolo = giocatoreInAsta.ruolo;
    const giocatoriNelRuolo = vincitore.rosa.filter(
      (giocatore) => giocatore.ruolo === ruolo,
    ).length;
    if (giocatoriNelRuolo >= (ROLE_LIMITS[ruolo] || 0)) {
      alert(
        `❌ Limite raggiunto! ${vincitore.nome} ha già completato i ${ruolo} (${ROLE_LIMITS[ruolo]}/${ROLE_LIMITS[ruolo]}).`,
      );
      return;
    }

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
      (partecipante) => partecipante.id === parseInt(ultimoOfferenteId),
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
    completaSwitch,
    assegnaGiocatoreManualmente,
  };
}
