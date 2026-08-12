import { runTransaction, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { ALPHABET, ROLE_LIMITS } from '@/data/auctionDefaults';
import {
  AUCTION_DURATION_MS,
  getRemainingMilliseconds,
} from '@/utils/timerUtils';
import { filterPlayers, findNextPlayer, sortPlayersAlphabetically } from '@/utils/playerUtils';

const sameId = (a, b) => String(a) === String(b);

const createReadyAuctionState = (playerInAuction) => ({
  giocatoreInAsta: playerInAuction,
  offertaCorrente: 0,
  isTimerStarted: false,
  ultimoOfferenteId: null,
  isPaused: false,
  stopChiamatoDa: null,
  stopIniziatoAt: null,
  storicoOfferte: [],
  timer: 10,
  timerEndsAt: null,
});

/*
 * IMPORTANTISSIMO:
 * questa funzione NON salva più l'intera sessione locale.
 * Scrive solamente i campi realmente richiesti dal chiamante.
 * Questo evita che un dispositivo con stato vecchio possa
 * sovrascrivere le modifiche fatte contemporaneamente dagli altri.
 */
export const saveAuctionSession = async ({ docRef, changes = {} }) => {
  const payload = {};

  const fieldMap = {
    players: 'giocatori',
    participants: 'partecipanti',
    configMode: 'isConfigMode',
    playerInAuction: 'giocatoreInAsta',
    currentBid: 'offertaCorrente',
    timerStarted: 'isTimerStarted',
    lastBidderId: 'ultimoOfferenteId',
    paused: 'isPaused',
    stopCalledBy: 'stopChiamatoDa',
    stopStartedAt: 'stopIniziatoAt',
    lastPurchase: 'ultimoAcquisto',
    bidHistory: 'storicoOfferte',
    timer: 'timer',
    timerEndsAt: 'timerEndsAt',
  };

  Object.entries(fieldMap).forEach(([sourceKey, firestoreKey]) => {
    if (Object.prototype.hasOwnProperty.call(changes, sourceKey)) {
      const value = changes[sourceKey];
      payload[firestoreKey] =
        sourceKey === 'players' && Array.isArray(value)
          ? sortPlayersAlphabetically(value)
          : value;
    }
  });

  if (Object.keys(payload).length === 0) return;

  await setDoc(docRef, payload, { merge: true });
};

export const startAuctionTimer = async ({ docRef }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);
    if (!sessionSnapshot.exists()) return;

    const session = sessionSnapshot.data();

    if (!session.giocatoreInAsta || session.isPaused || session.isTimerStarted) {
      return;
    }

    transaction.update(docRef, {
      isTimerStarted: true,
      timer: 10,
      timerEndsAt: Date.now() + AUCTION_DURATION_MS,
    });
  });
};

export const placeBid = async ({ docRef, bidderId, bidderName, increment }) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);
    if (!sessionSnapshot.exists()) return;

    const session = sessionSnapshot.data();

    if (
      !session.giocatoreInAsta ||
      session.isPaused ||
      !session.isTimerStarted ||
      getRemainingMilliseconds(session.timerEndsAt) === 0
    ) {
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
      timerRimanenteMs: null,
      storicoOfferte: bidHistory,
    });
  });
};

export const requestAuctionStop = async ({
  docRef,
  participantId,
  participantName,
}) => {
  await runTransaction(db, async (transaction) => {
    const sessionSnapshot = await transaction.get(docRef);
    if (!sessionSnapshot.exists()) return;

    const session = sessionSnapshot.data();

    if (session.isPaused || !session.isTimerStarted || !session.giocatoreInAsta) {
      return;
    }

    const currentBid = session.offertaCorrente || 0;
    if (currentBid <= 30) return;

    const currentParticipants = session.partecipanti || [];
    const participant = currentParticipants.find((p) =>
      sameId(p.id, participantId),
    );

    if (!participant) return;

    const remainingStops = participant.stopDisponibili ?? 2;
    if (remainingStops <= 0) return;

    const remainingTimerMs = session.timerEndsAt
      ? getRemainingMilliseconds(session.timerEndsAt)
      : Math.max(0, (session.timer ?? 0) * 1000);

    if (remainingTimerMs === 0) return;

    const updatedParticipants = currentParticipants.map((p) =>
      sameId(p.id, participantId)
        ? { ...p, stopDisponibili: remainingStops - 1 }
        : p,
    );

    transaction.update(docRef, {
      isPaused: true,
      stopChiamatoDa: participantName,
      stopIniziatoAt: Date.now(),
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
      timerEndsAt:
        remainingTimerMs > 0 ? Date.now() + remainingTimerMs : null,
    });
  });
};

/*
 * Cambio manuale del giocatore eseguito come transaction.
 * In questo modo un browser non può usare una lista vecchia
 * per sovrascrivere la lista aggiornata da un altro browser.
 */
export const changePlayerManual = async ({
  docRef,
  direction,
  selectedLetter,
  activeRoleFilters,
}) => {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) return false;

    const session = snapshot.data();
    if (session.isConfigMode || !session.giocatoreInAsta) return false;

    const players = (session.giocatori || []).slice();
    const currentIndex = players.findIndex((p) =>
      sameId(p.id, session.giocatoreInAsta.id),
    );

    if (currentIndex < 0) return false;

    const filteredPlayers = filterPlayers(
      players,
      selectedLetter,
      activeRoleFilters,
    );

    const filteredIndex = filteredPlayers.findIndex((p) =>
      sameId(p.id, session.giocatoreInAsta.id),
    );

    if (filteredIndex < 0) return false;

    const nextIndex = direction === 'avanti' ? filteredIndex + 1 : filteredIndex - 1;
    if (nextIndex < 0 || nextIndex >= filteredPlayers.length) return false;

    const nextPlayer = filteredPlayers[nextIndex];
    const participants = (session.partecipanti || []).map((p) => ({
      ...p,
      stopDisponibili: 2,
    }));

    const firstLetter = String(nextPlayer.nome || '').charAt(0).toUpperCase();

    transaction.update(docRef, {
      giocatoreInAsta: nextPlayer,
      offertaCorrente: 0,
      isTimerStarted: false,
      ultimoOfferenteId: null,
      isPaused: false,
      stopChiamatoDa: null,
      stopIniziatoAt: null,
      storicoOfferte: [],
      timer: 10,
      timerEndsAt: null,
      timerRimanenteMs: null,
      partecipanti: participants,
    });

    return { nextPlayer, nextLetter: firstLetter };
  });
};

/*
 * Assegnazione ATOMICA.
 * È il punto più importante della correzione:
 * se 10 dispositivi arrivano contemporaneamente a timer=0,
 * solo il primo che completa la transaction può assegnare il giocatore.
 */
export const assignPlayer = async ({
  docRef,
  winnerId,
  price,
  selectedLetter,
  activeRoleFilters,
  expectedPlayerId,
}) => {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) return { assigned: false, reason: 'missing' };

    const session = snapshot.data();
    const player = session.giocatoreInAsta;

    if (!player || !sameId(player.id, expectedPlayerId)) {
      return { assigned: false, reason: 'already-assigned' };
    }

    const participants = session.partecipanti || [];
    const winner = participants.find((p) => sameId(p.id, winnerId));
    if (!winner) return { assigned: false, reason: 'winner-not-found' };

    const currentBid = session.offertaCorrente || 0;
    const finalPrice = Number(price);

    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      return { assigned: false, reason: 'invalid-price' };
    }

    if (winner.crediti < finalPrice) {
      return { assigned: false, reason: 'insufficient-credits' };
    }

    const role = player.ruolo;
    const roleCount = (winner.rosa || []).filter(
      (ownedPlayer) => ownedPlayer.ruolo === role,
    ).length;

    if (roleCount >= (ROLE_LIMITS[role] || 0)) {
      return { assigned: false, reason: 'role-limit' };
    }

    const remainingPlayers = (session.giocatori || []).filter(
      (availablePlayer) => !sameId(availablePlayer.id, player.id),
    );

    const { player: nextPlayer, letter: nextLetter } = findNextPlayer(
      remainingPlayers,
      selectedLetter,
      activeRoleFilters,
      ALPHABET,
    );

    const updatedParticipants = participants.map((participant) => {
      if (sameId(participant.id, winner.id)) {
        return {
          ...participant,
          crediti: participant.crediti - finalPrice,
          rosa: [
            ...(participant.rosa || []),
            { ...player, prezzo: finalPrice },
          ],
          stopDisponibili: 2,
        };
      }

      return {
        ...participant,
        stopDisponibili: 2,
      };
    });

    const lastPurchase = {
      id: player.id,
      calciatore: player.nome,
      squadra: player.squadra,
      ruolo: player.ruolo,
      vincitoreNome: winner.nome,
      prezzo: finalPrice,
    };

    transaction.update(docRef, {
      giocatori: sortPlayersAlphabetically(remainingPlayers),
      partecipanti: updatedParticipants,
      giocatoreInAsta: nextPlayer || null,
      offertaCorrente: 0,
      isTimerStarted: false,
      ultimoOfferenteId: null,
      isPaused: false,
      stopChiamatoDa: null,
      stopIniziatoAt: null,
      storicoOfferte: [],
      timer: 10,
      timerEndsAt: null,
      timerRimanenteMs: null,
      ultimoAcquisto: lastPurchase,
    });

    return {
      assigned: true,
      nextPlayer,
      nextLetter,
      lastPurchase,
      currentBid,
    };
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
    id: player.id,
    calciatore: player.nome,
    squadra: player.squadra,
    ruolo: player.ruolo,
    vincitoreNome: winner.nome,
    prezzo: price,
  };

  const updatedParticipants = participants.map((participant) => {
    if (sameId(participant.id, winner.id)) {
      return {
        ...participant,
        crediti: participant.crediti - price,
        rosa: [
          ...(participant.rosa || []),
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
    (availablePlayer) => !sameId(availablePlayer.id, player.id),
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
