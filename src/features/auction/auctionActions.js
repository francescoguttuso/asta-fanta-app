import { runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { ALPHABET, ROLE_LIMITS } from "@/data/auctionDefaults";
import {
  AUCTION_DURATION_MS,
  getRemainingMilliseconds,
} from "@/utils/timerUtils";
import { findNextPlayer, sortPlayersAlphabetically } from "@/utils/playerUtils";

const TOTAL_SQUAD_SIZE = Object.values(ROLE_LIMITS).reduce(
  (total, limit) => total + limit,
  0,
);

/**
 * Calcola la massima cifra totale che una squadra può offrire per il
 * giocatore corrente, lasciando almeno 1 FM per ogni posto ancora da
 * completare dopo questo acquisto.
 */
export const getMaximumBid = (participant, playerRole) => {
  if (!participant) return 0;

  const rosa = Array.isArray(participant.rosa) ? participant.rosa : [];
  const roleLimit = ROLE_LIMITS[playerRole] || 0;
  const roleCount = rosa.filter(
    (player) => player.ruolo === playerRole,
  ).length;

  if (!roleLimit || roleCount >= roleLimit) {
    return 0;
  }

  const crediti = Math.max(0, Number(participant.crediti) || 0);
  const remainingSlotsAfterPurchase = Math.max(
    0,
    TOTAL_SQUAD_SIZE - (rosa.length + 1),
  );

  return Math.max(0, Math.floor(crediti - remainingSlotsAfterPurchase));
};

export const saveAuctionSession = async ({
  docRef,
  players,
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
  timerDurationMs,
  serverNow,
}) => {
  await setDoc(docRef, {
    giocatori: sortPlayersAlphabetically(players),
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
    ...(timerDurationMs !== undefined ? { timerDurationMs } : {}),
    ...(serverNow !== undefined ? { serverNow } : {}),
  }, { merge: true });
};

export const startAuctionTimer = async ({ docRef }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) return;

    transaction.update(docRef, {
      isTimerStarted: true,
      timer: 10,
      timerEndsAt: Date.now() + AUCTION_DURATION_MS,
      timerDurationMs: AUCTION_DURATION_MS,
      serverNow: serverTimestamp(),
    });
  });
};

export const placeBid = async ({ docRef, bidderId, bidderName, increment }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) return;

    const session = sessionSnapshot.data();

    if (session.isPaused || !session.isTimerStarted) return;

    if (session.timerEndsAt && Date.now() >= session.timerEndsAt) {
      return;
    }

    const player = session.giocatoreInAsta;
    if (!player) return;

    const currentParticipants = session.partecipanti || [];
    const bidder = currentParticipants.find(
      (participant) => String(participant.id) === String(bidderId),
    );

    if (!bidder) return;

    const maximumBid = getMaximumBid(bidder, player.ruolo);
    const newBid = (session.offertaCorrente || 0) + Number(increment || 0);

    // Controllo definitivo lato Firestore: il dispositivo non può
    // superare la reale potenza economica della squadra.
    if (newBid > maximumBid) {
      console.warn(
        `Offerta rifiutata: ${bidder.nome} può arrivare al massimo a ${maximumBid} FM.`,
      );
      return;
    }

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
      timerDurationMs: AUCTION_DURATION_MS,
      serverNow: serverTimestamp(),
      isPaused: false,
      stopChiamatoDa: null,
      stopIniziatoAt: null,
      storicoOfferte: bidHistory,
    });
  });
};

export const requestAuctionStop = async ({
  docRef,
  participantId,
  participantName,
  participants,
  timer,
}) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) return;

    const session = sessionSnapshot.data();

    /*
     * Lo STOP non può essere richiesto:
     * - se l'asta è già in pausa
     * - se il timer non è partito
     */
    if (session.isPaused || !session.isTimerStarted) return;

    /*
     * Lo STOP diventa disponibile SOLO dopo
     * un'offerta superiore a 30 FM.
     *
     * 30 FM -> NO
     * 31 FM -> SI
     */
    const currentBid = session.offertaCorrente || 0;

    if (currentBid <= 30) return;

    const currentParticipants = session.partecipanti || participants;

    const participant = currentParticipants.find((p) => p.id === participantId);

    if (!participant) return;

    /*
     * Ogni squadra parte con 2 STOP.
     */
    const remainingStops = participant.stopDisponibili ?? 2;

    /*
     * Se la squadra ha già utilizzato entrambi gli STOP
     * per questo giocatore, non può richiederne altri.
     */
    if (remainingStops <= 0) return;

    const remainingTimerMs = session.timerEndsAt
      ? getRemainingMilliseconds(session.timerEndsAt)
      : Math.max(0, (session.timer ?? timer) * 1000);

    /*
     * Il timer deve essere ancora attivo.
     */
    if (remainingTimerMs === 0) return;

    /*
     * Consuma UNO STOP della squadra che lo ha richiesto.
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
       * Conserviamo il tempo residuo dell'asta
       * per poterla riprendere dopo i 30 secondi.
       */
      timerRimanenteMs: remainingTimerMs,
      timer: Math.ceil(remainingTimerMs / 1000),
      timerEndsAt: null,

      partecipanti: updatedParticipants,
    });
  });
};

export const resumeAuctionAfterStop = async ({ docRef, stopStartedAt }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);

    if (!sessionSnapshot.exists()) return;

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
      timerDurationMs: remainingTimerMs,
      serverNow: serverTimestamp(),
    });
  });
};

export const buildPlayerAssignment = ({
  players,
  participants,
  player,
  winner,
  price,
  selectedLetter,
  activeRoleFilters,
}) => {
  const lastPurchase = {
    calciatore: player.nome,
    ruolo: player.ruolo,
    vincitoreNome: winner.nome,
    prezzo: price,
  };

  /*
   * IMPORTANTE:
   *
   * Alla fine dell'asta del giocatore gli STOP
   * vengono completamente resettati.
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

  const remainingPlayers = players.filter(
    (availablePlayer) => availablePlayer.id !== player.id,
  );

  const { player: nextPlayer, letter: nextLetter } = findNextPlayer(
    remainingPlayers,
    selectedLetter,
    activeRoleFilters,
    ALPHABET,
  );

  return {
    lastPurchase,
    updatedParticipants,
    remainingPlayers,
    nextPlayer,
    nextLetter,
  };
};
