import { runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { ALPHABET } from "@/data/auctionDefaults";
import {
  AUCTION_DURATION_MS,
  getRemainingMilliseconds,
} from "@/utils/timerUtils";
import { findNextPlayer, sortPlayersAlphabetically } from "@/utils/playerUtils";

// =====================================================
// SALVATAGGIO SESSIONE ASTA
// =====================================================

export const saveAuctionSession = async ({
  docRef,
  players,
  playersCatalog,
  participants,
  configMode,
  playerInAuction,
  currentBid,
  timerStarted,
  lastBidderId,
  paused,
  stopCalledBy,
  stopStartedAt,
  lastPurchase,
  bidHistory,
  timer,
  timerEndsAt,
}) => {
  await setDoc(docRef, {
    giocatori: sortPlayersAlphabetically(players),

    // Catalogo completo: non viene consumato durante l'asta.
    playersCatalog: sortPlayersAlphabetically(
      playersCatalog || players || [],
    ),

    partecipanti: participants,

    isConfigMode: configMode,

    giocatoreInAsta: playerInAuction,

    offertaCorrente: currentBid,

    isTimerStarted: timerStarted,

    ultimoOfferenteId: lastBidderId,

    isPaused: paused,

    stopChiamatoDa: stopCalledBy,

    stopIniziatoAt: stopStartedAt,

    ultimoAcquisto: lastPurchase,

    storicoOfferte: bidHistory,

    timer,

    timerEndsAt,
  });
};

// =====================================================
// AVVIO TIMER ASTA
// =====================================================

export const startAuctionTimer = async ({ docRef }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) {
      return;
    }

    transaction.update(docRef, {
      isTimerStarted: true,

      timer: 10,

      timerEndsAt: Date.now() + AUCTION_DURATION_MS,
    });
  });
};

// =====================================================
// OFFERTA
// =====================================================

export const placeBid = async ({ docRef, bidderId, bidderName, increment }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) {
      return;
    }

    const session = sessionSnapshot.data();

    if (session.isPaused || !session.isTimerStarted) {
      return;
    }

    const newBid = (session.offertaCorrente || 0) + increment;

    const newHistoryEntry = {
      nome: bidderName,
      importo: newBid,
      ora: new Date().toLocaleTimeString(),
    };

    const bidHistory = [
      newHistoryEntry,
      ...(session.storicoOfferte || []),
    ].slice(0, 5);

    transaction.update(docRef, {
      offertaCorrente: newBid,

      ultimoOfferenteId: bidderId,

      timer: 10,

      timerEndsAt: Date.now() + AUCTION_DURATION_MS,

      isPaused: false,

      stopChiamatoDa: null,

      stopIniziatoAt: null,

      storicoOfferte: bidHistory,
    });
  });
};

// =====================================================
// RICHIESTA STOP
// =====================================================

export const requestAuctionStop = async ({
  docRef,
  participantId,
  participantName,
  participants,
  timer,
}) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) {
      return;
    }

    const session = sessionSnapshot.data();

    /*
     * Lo STOP non può essere richiesto:
     *
     * - se l'asta è già in pausa
     * - se il timer non è partito
     */

    if (session.isPaused || !session.isTimerStarted) {
      return;
    }

    /*
     * Lo STOP diventa disponibile SOLO dopo
     * un'offerta superiore a 30 FM.
     *
     * 30 FM -> NO
     * 31 FM -> SI
     */

    const currentBid = session.offertaCorrente || 0;

    if (currentBid <= 30) {
      return;
    }

    const currentParticipants = session.partecipanti || participants;

    const participant = currentParticipants.find((p) => p.id === participantId);

    if (!participant) {
      return;
    }

    /*
     * Ogni squadra parte con 2 STOP.
     */

    const remainingStops = participant.stopDisponibili ?? 2;

    /*
     * Se la squadra ha già utilizzato entrambi
     * gli STOP per questo giocatore,
     * non può richiederne altri.
     */

    if (remainingStops <= 0) {
      return;
    }

    const remainingTimerMs = session.timerEndsAt
      ? getRemainingMilliseconds(session.timerEndsAt)
      : Math.max(0, (session.timer ?? timer) * 1000);

    /*
     * Il timer deve essere ancora attivo.
     */

    if (remainingTimerMs === 0) {
      return;
    }

    /*
     * Consuma UNO STOP della squadra
     * che lo ha richiesto.
     */

    const updatedParticipants = currentParticipants.map((participant) => {
      if (participant.id === participantId) {
        return {
          ...participant,

          stopDisponibili: remainingStops - 1,
        };
      }

      return participant;
    });

    transaction.update(docRef, {
      isPaused: true,

      stopChiamatoDa: participantName,

      stopIniziatoAt: Date.now(),

      /*
       * Conserviamo il tempo residuo
       * dell'asta per poterla riprendere
       * dopo i 30 secondi.
       */

      timerRimanenteMs: remainingTimerMs,

      timer: Math.ceil(remainingTimerMs / 1000),

      timerEndsAt: null,

      partecipanti: updatedParticipants,
    });
  });
};

// =====================================================
// RIPRESA ASTA DOPO STOP
// =====================================================

export const resumeAuctionAfterStop = async ({ docRef, stopStartedAt }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) {
      return;
    }

    const session = sessionSnapshot.data();

    /*
     * Evita che una vecchia chiamata possa
     * riattivare uno STOP diverso.
     */

    if (!session.isPaused || session.stopIniziatoAt !== stopStartedAt) {
      return;
    }

    const remainingTimerMs = Math.max(
      0,
      session.timerRimanenteMs ?? (session.timer || 0) * 1000,
    );

    transaction.update(docRef, {
      isPaused: false,

      stopChiamatoDa: null,

      stopIniziatoAt: null,

      timerRimanenteMs: null,

      timer: Math.ceil(remainingTimerMs / 1000),

      timerEndsAt: remainingTimerMs > 0 ? Date.now() + remainingTimerMs : null,
    });
  });
};

// =====================================================
// ASSEGNAZIONE GIOCATORE
// =====================================================

export const buildPlayerAssignment = ({
  players,
  playersCatalog,
  participants,
  player,
  winner,
  price,
  selectedLetter,
  activeRoleFilters,
}) => {
  // ===================================================
  // ULTIMO ACQUISTO
  // ===================================================

  const lastPurchase = {
    // ID DEL GIOCATORE
    // Serve per recuperare il campioncino
    id: player.id,

    // Nome
    calciatore: player.nome,

    // Squadra reale
    squadra: player.squadra,

    // Ruolo
    ruolo: player.ruolo,

    // Squadra che ha vinto
    vincitoreNome: winner.nome,

    // Prezzo di acquisto
    prezzo: price,
  };

  /*
   * IMPORTANTE:
   *
   * Alla fine dell'asta del giocatore
   * gli STOP vengono completamente resettati.
   *
   * Ogni squadra riparte quindi con 2 STOP
   * quando viene messo all'asta il giocatore successivo.
   */

  const updatedParticipants = participants.map((participant) => {
    if (participant.id === winner.id) {
      return {
        ...participant,

        crediti: participant.crediti - price,

        rosa: [
          ...participant.rosa,

          {
            ...player,

            prezzo: price,
          },
        ],

        stopDisponibili: 2,
      };
    }

    return {
      ...participant,

      stopDisponibili: 2,
    };
  });

  // ===================================================
  // RIMUOVI GIOCATORE DALLA LISTA
  // ===================================================

  const remainingPlayers = players.filter(
    (availablePlayer) => availablePlayer.id !== player.id,
  );

  // ===================================================
  // TROVA PROSSIMO GIOCATORE
  // ===================================================

  const { player: nextPlayer, letter: nextLetter } = findNextPlayer(
    remainingPlayers,
    selectedLetter,
    activeRoleFilters,
    ALPHABET,
  );

  // ===================================================
  // RISULTATO
  // ===================================================

  return {
    lastPurchase,

    updatedParticipants,

    remainingPlayers,

    nextPlayer,

    nextLetter,
  };
};
