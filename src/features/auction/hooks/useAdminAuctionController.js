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
  calculateMaximumBid,
  createContextualSwitch,
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
  pendingSwitch: null,
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
  const [serverBidderId, setServerBidderId] = useState(() =>
    localStorage.getItem('fantaServerBidderId') || '1',
  );
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
      pendingSwitch: null,
    });
    setTimer(10);
  };

  const esportaInExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    // Formato compatibile con l'importatore: ogni rosa è separata da $,$,$.
    partecipanti.forEach((partecipante) => {
      csvContent += '$,$,$\n';
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

  const importaSquadre = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const resetInput = () => {
      event.target.value = '';
    };

    const parseCsvLine = (line) => {
      const values = [];
      let value = '';
      let inQuotes = false;

      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (char === '"') {
          if (inQuotes && line[index + 1] === '"') {
            value += '"';
            index += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(value.trim());
          value = '';
        } else {
          value += char;
        }
      }

      values.push(value.trim());
      return values;
    };

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const text = String(loadEvent.target.result || '').replace(/^\uFEFF/, '');
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (!lines.length) {
          throw new Error('Il file CSV è vuoto.');
        }

        // IMPORTANTISSIMO: `giocatori` contiene solo i giocatori ancora
        // disponibili all'asta. I giocatori già acquistati vengono rimossi
        // da questa lista, ma devono comunque poter essere ricostruiti durante
        // l'importazione di una rosa. Per questo usiamo il catalogo completo
        // INITIAL_PLAYERS come base e sovrascriviamo con eventuali dati presenti
        // nella lista corrente.
        const catalogById = new Map(
          [...(INITIAL_PLAYERS || []), ...(giocatori || [])].map((player) => [
            String(player.id),
            player,
          ]),
        );

        // Il formato storico esportato dall'app usa $,$,$ come separatore
        // tra le rose. Supportiamo anche un CSV senza separatori, raggruppando
        // le righe consecutive per nome squadra.
        const gruppi = [];
        let gruppoCorrente = [];
        let nomeGruppoCorrente = null;

        lines.forEach((line) => {
          const row = parseCsvLine(line);
          const isSeparator =
            row.length >= 3 && row[0] === '$' && row[1] === '$' && row[2] === '$';

          if (isSeparator) {
            if (gruppoCorrente.length) {
              gruppi.push(gruppoCorrente);
              gruppoCorrente = [];
              nomeGruppoCorrente = null;
            }
            return;
          }

          if (row.length < 3) return;

          const nomeSquadra = String(row[0] || '').trim();
          if (!nomeSquadra) return;

          if (nomeGruppoCorrente !== null && nomeSquadra !== nomeGruppoCorrente) {
            gruppi.push(gruppoCorrente);
            gruppoCorrente = [];
          }

          nomeGruppoCorrente = nomeSquadra;
          gruppoCorrente.push(row);
        });

        if (gruppoCorrente.length) gruppi.push(gruppoCorrente);

        if (gruppi.length !== partecipanti.length) {
          throw new Error(
            `Il file contiene ${gruppi.length} squadre, ma la lega ne prevede ${partecipanti.length}.`,
          );
        }

        const giocatoriUsati = new Set();

        const nuoviPartecipanti = partecipanti.map((participant, participantIndex) => {
          const gruppo = gruppi[participantIndex];
          const nomeSquadra = String(gruppo[0]?.[0] || '').trim();

          if (!nomeSquadra) {
            throw new Error(`Nome squadra mancante per la squadra ${participantIndex + 1}.`);
          }

          if (gruppo.length !== 25) {
            throw new Error(
              `La squadra "${nomeSquadra}" contiene ${gruppo.length} giocatori invece dei 25 previsti.`,
            );
          }

          const rosa = gruppo.map((row, rowIndex) => {
            const playerId = String(row[1] || '').trim();
            const prezzo = Number(String(row[2] || '').trim().replace(',', '.'));

            if (!playerId) {
              throw new Error(
                `ID giocatore mancante nella rosa "${nomeSquadra}", riga ${rowIndex + 1}.`,
              );
            }

            if (!Number.isFinite(prezzo) || prezzo < 0) {
              throw new Error(
                `Prezzo non valido per il giocatore con ID ${playerId}.`,
              );
            }

            const catalogPlayer = catalogById.get(playerId);
            if (!catalogPlayer) {
              throw new Error(`Giocatore con ID ${playerId} non trovato nel catalogo.`);
            }

            if (giocatoriUsati.has(playerId)) {
              throw new Error(
                `Il giocatore con ID ${playerId} compare più di una volta nel file.`,
              );
            }

            giocatoriUsati.add(playerId);
            return { ...catalogPlayer, prezzo };
          });

          const spesa = rosa.reduce(
            (totale, player) => totale + Number(player.prezzo || 0),
            0,
          );

          if (spesa > 500) {
            throw new Error(
              `La squadra "${nomeSquadra}" supera i 500 FM (${spesa} FM).`,
            );
          }

          return {
            ...participant,
            // Il nome esportato fa parte del backup e viene quindi ripristinato.
            nome: nomeSquadra,
            rosa,
            crediti: 500 - spesa,
          };
        });

        // Salviamo solo le rose/nomi/crediti: lo stato dell'asta corrente
        // (timer, giocatore in asta, offerte, ecc.) non viene toccato.
        saveSession({ participants: nuoviPartecipanti });
        setPartecipanti(nuoviPartecipanti);
        alert('Rose importate con successo!');
      } catch (error) {
        console.error('Errore importazione squadre:', error);
        alert(`Errore importazione squadre: ${error.message}`);
      } finally {
        resetInput();
      }
    };

    reader.onerror = () => {
      alert('Impossibile leggere il file CSV.');
      resetInput();
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

    const offerenteServer = partecipanti.find(
      (partecipante) => String(partecipante.id) === String(serverBidderId),
    );

    if (!offerenteServer) {
      alert('Seleziona la squadra per cui il Server deve rilanciare.');
      return;
    }

    try {
      await placeBid({
        docRef,
        bidderId: String(offerenteServer.id),
        bidderName: offerenteServer.nome || `Squadra ${offerenteServer.id}`,
        increment: incremento,
      });
    } catch (error) {
      console.error('Errore nel rilancio server: ', error);
      alert(error?.message || 'Impossibile effettuare il rilancio dal Server.');
    }
  };

  const preparaTaglioContestuale = useCallback(
    async (vincitore, prezzo) => {
      try {
        await createContextualSwitch({
          docRef,
        winnerId: vincitore.id,
        price: prezzo,
        players: giocatori,
        selectedLetter: filtroLettera,
        activeRoleFilters: filtriRuoliAttivi,
        });
        return true;
      } catch (error) {
        console.error("Errore creazione taglio contestuale:", error);
        alert(error?.message || "Errore durante la preparazione del taglio contestuale.");
        return false;
      }
    },
    [docRef, giocatori, filtroLettera, filtriRuoliAttivi],
  );

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
      alert("Impossibile assegnare: nessuna offerta ricevuta per questo calciatore.");
      return;
    }

    const vincitore = partecipanti.find(
      (p) => p.id === parseInt(ultimoOfferenteId),
    );
    if (!vincitore) return;

    const ruolo = giocatoreInAsta.ruolo;
    const giocatoriNelRuolo = (vincitore.rosa || []).filter(
      (p) => String(p.ruolo) === String(ruolo),
    ).length;
    const roleIsFull = giocatoriNelRuolo >= (ROLE_LIMITS[ruolo] || 0);

    const maximumBid = calculateMaximumBid({
      participant: vincitore,
      role: ruolo,
    });

    if (offertaCorrente > maximumBid) {
      alert(
        `Errore: ${vincitore.nome} non può sostenere ${offertaCorrente} FM. Massimo consentito: ${maximumBid} FM.`,
      );
      return;
    }

    if (roleIsFull) {
      await preparaTaglioContestuale(vincitore, offertaCorrente);
      return;
    }

    if (vincitore.crediti < offertaCorrente) {
      alert(`Errore: ${vincitore.nome} non possiede crediti sufficienti!`);
      return;
    }

    await completaAssegnazione(vincitore, offertaCorrente);
  }, [
    giocatoreInAsta,
    ultimoOfferenteId,
    partecipanti,
    offertaCorrente,
    completaAssegnazione,
    preparaTaglioContestuale,
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

    const ruolo = giocatoreInAsta.ruolo;
    const giocatoriNelRuolo = (vincitore.rosa || []).filter(
      (p) => String(p.ruolo) === String(ruolo),
    ).length;
    const roleIsFull = giocatoriNelRuolo >= (ROLE_LIMITS[ruolo] || 0);

    const maximumBid = calculateMaximumBid({
      participant: vincitore,
      role: ruolo,
    });

    if (prezzo > maximumBid) {
      alert(
        `Attenzione: ${vincitore.nome} può sostenere al massimo ${maximumBid} FM.`,
      );
      return;
    }

    setSquadraManualeId('');
    setPrezzoManuale('');

    if (roleIsFull) {
      await preparaTaglioContestuale(vincitore, prezzo);
      return;
    }

    if (vincitore.crediti < prezzo) {
      alert(
        `Attenzione: ${vincitore.nome} ha solo ${vincitore.crediti} FM e non può spendere ${prezzo} FM!`,
      );
      return;
    }

    await completaAssegnazione(vincitore, prezzo);
  };


  const rimuoviGiocatoreDallaRosa = async (participantId, playerId) => {
    try {
      const participant = partecipanti.find(
        (item) => String(item.id) === String(participantId),
      );

      if (!participant) {
        throw new Error("Squadra non trovata.");
      }

      const playerIndex = (participant.rosa || []).findIndex(
        (player) => String(player.id) === String(playerId),
      );

      if (playerIndex === -1) {
        throw new Error("Giocatore non trovato nella rosa.");
      }

      const player = participant.rosa[playerIndex];
      const prezzoRestituito = Number(player.prezzo || 0);

      const nuovaRosa = participant.rosa.filter(
        (_, index) => index !== playerIndex,
      );

      const nuovaListaGiocatori = [...(giocatori || [])];

      const giaNelListone = nuovaListaGiocatori.some(
        (item) => String(item.id) === String(player.id),
      );

      if (!giaNelListone) {
        nuovaListaGiocatori.push(player);
      }

      const nuoviPartecipanti = partecipanti.map((item) => {
        if (String(item.id) !== String(participantId)) {
          return item;
        }

        return {
          ...item,
          rosa: nuovaRosa,
          crediti: Number(item.crediti || 0) + prezzoRestituito,
        };
      });

      await saveSession({
        participants: nuoviPartecipanti,
        players: nuovaListaGiocatori,
      });
    } catch (error) {
      console.error("Errore rimozione giocatore:", error);
      alert(`Errore rimozione giocatore: ${error.message}`);
    }
  };

  const cambiaOfferenteServer = (value) => {
    const normalized = String(value || '');
    setServerBidderId(normalized);
    if (normalized) localStorage.setItem('fantaServerBidderId', normalized);
  };

  const offerenteServer = partecipanti.find(
    (partecipante) => String(partecipante.id) === String(serverBidderId),
  );

  return {
    vistaCorrente,
    setVistaCorrente,
    squadraManualeId,
    setSquadraManualeId,
    prezzoManuale,
    setPrezzoManuale,
    serverBidderId,
    setServerBidderId: cambiaOfferenteServer,
    offerenteServer,
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
    rimuoviGiocatoreDallaRosa,
  };
}
