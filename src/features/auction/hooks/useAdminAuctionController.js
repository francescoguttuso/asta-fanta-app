import { useCallback, useEffect, useState } from 'react';
import {
  INITIAL_PARTICIPANTS,
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

        const giocatoriNormalizzati = normalizePlayers(nuoviGiocatori);

        setGiocatori(giocatoriNormalizzati);
        setGiocatoriCatalogo(giocatoriNormalizzati);

        await saveSession({
          players: giocatoriNormalizzati,
          playersCatalog: giocatoriNormalizzati,
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
        players: giocatoriCatalogo,
        playersCatalog: giocatoriCatalogo,
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

  const escapeCsv = (value) => {
    const text = value == null ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };

  const esportaInExcel = () => {
    const righe = [
      ['squadra', 'crediti', 'giocatoreId', 'prezzo'],
    ];

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
        if (lines.length === 0) throw new Error('File vuoto');

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
              values.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current);
          return values.map((value) => value.trim());
        };

        const rows = lines.map(parseCsvLine);
        const header = rows[0].map((value) => value.toLowerCase());
        const hasNewHeader =
          header[0] === 'squadra' &&
          header[1] === 'crediti' &&
          header[2] === 'giocatoreid' &&
          header[3] === 'prezzo';

        const dataRows = hasNewHeader ? rows.slice(1) : rows;
        const grouped = new Map();

        dataRows.forEach((row) => {
          const squadra = row[0]?.trim();
          if (!squadra) return;

          const creditiImportati = hasNewHeader ? Number(row[1]) : NaN;
          const playerId = hasNewHeader ? row[2] : row[1];
          const prezzo = Number(hasNewHeader ? row[3] : row[2]);

          if (!grouped.has(squadra)) {
            grouped.set(squadra, {
              creditiImportati: Number.isFinite(creditiImportati) ? creditiImportati : null,
              giocatori: [],
            });
          }

          if (playerId && Number.isFinite(Number(playerId)) && Number.isFinite(prezzo)) {
            grouped.get(squadra).giocatori.push({
              id: Number(playerId),
              prezzo,
            });
          }
        });

        if (grouped.size === 0) {
          throw new Error('Nessuna squadra trovata nel file.');
        }

        const catalogo = giocatoriCatalogo || giocatori || [];
        const catalogoById = new Map(catalogo.map((player) => [Number(player.id), player]));

        if (grouped.size > partecipanti.length) {
          throw new Error(`Il file contiene ${grouped.size} squadre, ma la lega ne prevede ${partecipanti.length}.`);
        }

        const partecipantiImportati = partecipanti.map((participant) => ({
          ...participant,
          rosa: [],
        }));

        const usedIds = new Set();
        const squadreImportate = Array.from(grouped.entries());

        squadreImportate.forEach(([nomeSquadra, dati], index) => {
          const target = partecipantiImportati[index];
          target.nome = nomeSquadra;

          for (const item of dati.giocatori) {
            if (usedIds.has(item.id)) {
              throw new Error(`Il giocatore con ID ${item.id} è presente più volte nel file.`);
            }

            const catalogPlayer = catalogoById.get(item.id);
            if (!catalogPlayer) {
              throw new Error(`Giocatore con ID ${item.id} non trovato nel catalogo.`);
            }

            usedIds.add(item.id);
            target.rosa.push({
              ...catalogPlayer,
              prezzo: item.prezzo,
            });
          }

          const somma = target.rosa.reduce((totale, player) => totale + Number(player.prezzo || 0), 0);
          target.crediti = dati.creditiImportati != null && Number.isFinite(dati.creditiImportati)
            ? dati.creditiImportati
            : 500 - somma;
        });

        if (!window.confirm(
          'Importare le squadre dal file selezionato? Le rose e i crediti attuali verranno sostituiti.'
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
