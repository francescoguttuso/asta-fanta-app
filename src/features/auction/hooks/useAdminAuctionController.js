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

  const escapeCsv = (value) => {
    const text = value == null ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  const esportaInExcel = () => {
    const righe = [['squadra', 'crediti', 'giocatoreId', 'prezzo']];

    partecipanti.forEach((partecipante) => {
      if (!partecipante.rosa?.length) {
        righe.push([partecipante.nome, partecipante.crediti ?? 500, '', '']);
        return;
      }

      partecipante.rosa.forEach((giocatore) => {
        righe.push([
          partecipante.nome,
          partecipante.crediti ?? 0,
          giocatore.id,
          giocatore.prezzo ?? 0,
        ]);
      });
    });

    const csvContent = '\uFEFF' + righe
      .map((riga) => riga.map(escapeCsv).join(';'))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fantariggio_rosters.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importaSquadre = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const text = String(loadEvent.target.result || '').replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
        if (!lines.length) throw new Error('File vuoto.');

        const parseCsvLine = (line) => {
          const values = [];
          let current = '';
          let quoted = false;

          for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
              if (quoted && line[i + 1] === '"') {
                current += '"';
                i += 1;
              } else {
                quoted = !quoted;
              }
            } else if (char === ';' && !quoted) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }

          values.push(current.trim());
          return values;
        };

        const rows = lines.map(parseCsvLine);
        const header = rows[0].map((value) => value.toLowerCase());
        const hasHeader =
          header[0] === 'squadra' &&
          header[1] === 'crediti' &&
          header[2] === 'giocatoreid' &&
          header[3] === 'prezzo';

        const dataRows = hasHeader ? rows.slice(1) : rows;
        const grouped = new Map();

        dataRows.forEach((row) => {
          const nomeSquadra = row[0]?.trim();
          if (!nomeSquadra) return;

          const crediti = hasHeader ? Number(row[1]) : null;
          const playerId = hasHeader ? row[2] : row[1];
          const prezzo = Number(hasHeader ? row[3] : row[2]);

          if (!grouped.has(nomeSquadra)) {
            grouped.set(nomeSquadra, {
              crediti: Number.isFinite(crediti) ? crediti : null,
              rosa: [],
            });
          }

          if (playerId && Number.isFinite(Number(playerId)) && Number.isFinite(prezzo)) {
            grouped.get(nomeSquadra).rosa.push({
              id: Number(playerId),
              prezzo,
            });
          }
        });

        if (!grouped.size) {
          throw new Error('Nessuna squadra trovata nel file.');
        }

        if (grouped.size > partecipanti.length) {
          throw new Error(
            `Il file contiene ${grouped.size} squadre, ma la lega ne prevede ${partecipanti.length}.`,
          );
        }

        const catalogo = giocatori || [];
        const catalogoById = new Map(
          catalogo.map((player) => [Number(player.id), player]),
        );
        const usedIds = new Set();
        const importate = Array.from(grouped.entries());

        const partecipantiImportati = partecipanti.map((participant) => ({
          ...participant,
          rosa: [],
        }));

        importate.forEach(([nomeSquadra, dati], index) => {
          const target = partecipantiImportati[index];
          target.nome = nomeSquadra;

          dati.rosa.forEach((item) => {
            if (usedIds.has(item.id)) {
              throw new Error(`Il giocatore con ID ${item.id} è presente più volte nel file.`);
            }

            const player = catalogoById.get(item.id);
            if (!player) {
              throw new Error(`Giocatore con ID ${item.id} non trovato nel catalogo.`);
            }

            usedIds.add(item.id);
            target.rosa.push({ ...player, prezzo: item.prezzo });
          });

          const speso = target.rosa.reduce(
            (totale, player) => totale + Number(player.prezzo || 0),
            0,
          );

          target.crediti =
            dati.crediti != null && Number.isFinite(dati.crediti)
              ? dati.crediti
              : 500 - speso;
        });

        if (!window.confirm(
          'Importare le squadre dal file selezionato? Le rose e i crediti attuali verranno sostituiti.',
        )) {
          return;
        }

        await saveSession({ participants: partecipantiImportati });
        setPartecipanti(partecipantiImportati);
        alert('Squadre importate con successo!');
      } catch (error) {
        console.error('Errore importazione squadre:', error);
        alert(`Errore importazione squadre: ${error.message}`);
      }
    };

    reader.readAsText(file, 'utf-8');
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
      alert(
        'Impossibile assegnare: nessuna offerta ricevuta per questo calciatore.',
      );
      return;
    }

    const vincitore = partecipanti.find(
      (partecipante) => partecipante.id === parseInt(ultimoOfferenteId),
    );
    if (!vincitore) return;
    if (vincitore.crediti < offertaCorrente) {
      alert(`Errore: ${vincitore.nome} non possiede crediti sufficienti!`);
      return;
    }

    const ruolo = giocatoreInAsta.ruolo;
    const giocatoriNelRuolo = vincitore.rosa.filter(
      (giocatore) => giocatore.ruolo === ruolo,
    ).length;
    if (giocatoriNelRuolo >= (ROLE_LIMITS[ruolo] || 0)) {
      alert(
        `❌ Limite raggiunto! ${vincitore.nome} ha già completato i ${ruolo} (${ROLE_LIMITS[ruolo]}/${ROLE_LIMITS[ruolo]}). Assegnazione bloccata.`,
      );
      return;
    }

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
    importaSquadre,
    cambiaNomeSquadra,
    impostaModalitaConfigurazione,
    chiamaGiocatore,
    cambiaFiltroRuolo,
    faiOfferta,
    assegnaGiocatore,
    assegnaGiocatoreManualmente,
  };
}
