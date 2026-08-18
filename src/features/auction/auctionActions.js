import { runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { ALPHABET, ROLE_LIMITS } from "@/data/auctionDefaults";
import {
  AUCTION_DURATION_MS,
  getRemainingMilliseconds,
} from "@/utils/timerUtils";
import { findNextPlayer, sortPlayersAlphabetically } from "@/utils/playerUtils";

const idEquals = (a, b) => String(a) === String(b);

const getRoleCount = (participant, role) =>
  (participant.rosa || []).filter((player) => player.ruolo === role).length;

const getMaxSwitchBudget = (participant, role) => {
  const currentCredits = Number(participant.crediti || 0);
  const candidates = (participant.rosa || []).filter(
    (player) => player.ruolo === role,
  );
  const maxRelease = candidates.reduce(
    (max, player) => Math.max(max, Number(player.prezzo || 0)),
    0,
  );
  return currentCredits + maxRelease;
};

const canBidForParticipant = (participant, player, nextBid) => {
  if (!participant || !player) return false;

  const role = player.ruolo;
  const limit = ROLE_LIMITS[role] || 0;
  const count = getRoleCount(participant, role);

  if (count < limit) {
    return Number(participant.crediti || 0) >= nextBid;
  }

  // Regola 8: se il reparto è pieno si può rilanciare con Taglio Contestuale.
  return getMaxSwitchBudget(participant, role) >= nextBid;
};

// =====================================================
// SALVATAGGIO SESSIONE
// =====================================================

export const saveAuctionSession = async ({
  docRef,
  changes = {},
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
  playersCatalog,
  pendingSwitch,
}) => {
  const source = Object.keys(changes).length
    ? changes
    : {
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
        playersCatalog,
        pendingSwitch,
      };

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(source, "players")) {
    payload.giocatori = sortPlayersAlphabetically(source.players || []);
  }

  if (Object.prototype.hasOwnProperty.call(source, "playersCatalog")) {
    payload.giocatoriCatalogo = sortPlayersAlphabetically(
      source.playersCatalog || [],
    );
  }

  const mapping = {
    participants: "partecipanti",
    configMode: "isConfigMode",
    playerInAuction: "giocatoreInAsta",
    currentBid: "offertaCorrente",
    timerStarted: "isTimerStarted",
    lastBidderId: "ultimoOfferenteId",
    paused: "isPaused",
    stopCalledBy: "stopChiamatoDa",
    stopStartedAt: "stopIniziatoAt",
    lastPurchase: "ultimoAcquisto",
    bidHistory: "storicoOfferte",
    timer: "timer",
    timerEndsAt: "timerEndsAt",
    pendingSwitch: "pendingSwitch",
  };

  Object.entries(mapping).forEach(([sourceKey, firestoreKey]) => {
    if (Object.prototype.hasOwnProperty.call(source, sourceKey)) {
      payload[firestoreKey] = source[sourceKey];
    }
  });

  if (Object.keys(payload).length === 0) return;
  await setDoc(docRef, payload, { merge: true });
};

// =====================================================
// TIMER
// =====================================================

export const startAuctionTimer = async ({ docRef }) => {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) return;

    transaction.update(docRef, {
      isTimerStarted: true,
      timer: 10,
      timerEndsAt: Date.now() + AUCTION_DURATION_MS,
      pendingSwitch: null,
    });
  });
};

// =====================================================
// OFFERTA
// =====================================================

export const placeBid = async ({ docRef, bidderId, bidderName, increment }) => {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) return { accepted: false, reason: "session" };

    const session = snapshot.data();
    if (session.isPaused || !session.isTimerStarted || session.pendingSwitch) {
      return { accepted: false, reason: "auction-not-active" };
    }

    const participants = session.partecipanti || [];
    const bidder = participants.find((p) => idEquals(p.id, bidderId));
    const player = session.giocatoreInAsta;
    const nextBid = Number(session.offertaCorrente || 0) + Number(increment || 0);

    if (!bidder || !player || nextBid <= 0) {
      return { accepted: false, reason: "invalid" };
    }

    const remainingMs = session.timerEndsAt
      ? getRemainingMilliseconds(session.timerEndsAt)
      : Math.max(0, Number(session.timer || 0) * 1000);

    if (remainingMs <= 0) {
      return { accepted: false, reason: "timer" };
    }

    if (!canBidForParticipant(bidder, player, nextBid)) {
      return {
        accepted: false,
        reason: "budget",
        maxBid:
          getRoleCount(bidder, player.ruolo) < (ROLE_LIMITS[player.ruolo] || 0)
            ? Number(bidder.crediti || 0)
            : getMaxSwitchBudget(bidder, player.ruolo),
      };
    }

    const newHistoryEntry = {
      nome: bidderName,
      importo: nextBid,
      ora: new Date().toLocaleTimeString(),
    };

    const bidHistory = [
      newHistoryEntry,
      ...(session.storicoOfferte || []),
    ].slice(0, 5);

    transaction.update(docRef, {
      offertaCorrente: nextBid,
      ultimoOfferenteId: String(bidderId),
      timer: 10,
      timerEndsAt: Date.now() + AUCTION_DURATION_MS,
      isPaused: false,
      stopChiamatoDa: null,
      stopIniziatoAt: null,
      storicoOfferte: bidHistory,
    });

    return { accepted: true, bid: nextBid };
  });
};

// =====================================================
// STOP
// =====================================================

export const requestAuctionStop = async ({
  docRef,
  participantId,
  participantName,
  participants,
  timer,
}) => {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) return;

    const session = snapshot.data();
    if (session.isPaused || !session.isTimerStarted) return;
    if ((session.offertaCorrente || 0) <= 30) return;

    const currentParticipants = session.partecipanti || participants || [];
    const participant = currentParticipants.find((p) =>
      idEquals(p.id, participantId),
    );
    if (!participant) return;

    const remainingStops = participant.stopDisponibili ?? 2;
    if (remainingStops <= 0) return;

    const remainingTimerMs = session.timerEndsAt
      ? getRemainingMilliseconds(session.timerEndsAt)
      : Math.max(0, (session.timer ?? timer) * 1000);

    if (remainingTimerMs <= 0) return;

    const updatedParticipants = currentParticipants.map((p) =>
      idEquals(p.id, participantId)
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
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) return;

    const session = snapshot.data();
    if (!session.isPaused || session.stopIniziatoAt !== stopStartedAt) return;

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

// =====================================================
// AGGIUDICAZIONE / TAGLIO CONTESTUALE
// =====================================================

export const settleAuctionWinner = async ({
  docRef,
  winnerId,
  price,
  selectedLetter,
  activeRoleFilters,
  expectedPlayerId,
  switchPlayerId = null,
}) => {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) throw new Error("Sessione asta non trovata.");

    const session = snapshot.data();
    const player = session.giocatoreInAsta;
    if (!player || !idEquals(player.id, expectedPlayerId)) {
      throw new Error("L'asta è già cambiata o il giocatore non è più quello atteso.");
    }

    const participants = session.partecipanti || [];
    const winner = participants.find((p) => idEquals(p.id, winnerId));
    if (!winner) throw new Error("Vincitore non trovato.");

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      throw new Error("Prezzo di aggiudicazione non valido.");
    }

    const role = player.ruolo;
    const roleLimit = ROLE_LIMITS[role] || 0;
    const rolePlayers = (winner.rosa || []).filter((p) => p.ruolo === role);
    const roleFull = rolePlayers.length >= roleLimit;

    let playerToSwitch = null;
    if (roleFull) {
      if (!switchPlayerId) {
        const pendingSwitch = {
          winnerId: winner.id,
          winnerName: winner.nome,
          price: numericPrice,
          player,
          role,
          saldoCrediti: Number(winner.crediti || 0),
          switchCandidates: rolePlayers.map((p) => ({
            id: p.id,
            nome: p.nome,
            prezzo: Number(p.prezzo || 0),
          })),
          selectedLetter,
          activeRoleFilters,
        };

        transaction.update(docRef, {
          pendingSwitch,
          isTimerStarted: false,
          timer: 0,
          timerEndsAt: null,
          isPaused: false,
        });

        return { assigned: false, needsSwitch: true, ...pendingSwitch };
      }

      playerToSwitch = rolePlayers.find((p) => idEquals(p.id, switchPlayerId));
      if (!playerToSwitch) {
        throw new Error("Il giocatore scelto per lo switch non appartiene alla rosa.");
      }

      const switchBudget =
        Number(winner.crediti || 0) + Number(playerToSwitch.prezzo || 0);
      if (numericPrice > switchBudget) {
        throw new Error(
          `Switch non consentito: servono ${numericPrice} FM, ma il budget è ${switchBudget} FM.`,
        );
      }
    } else if (Number(winner.crediti || 0) < numericPrice) {
      throw new Error(
        `Crediti insufficienti: ${winner.crediti} FM disponibili, ${numericPrice} FM richiesti.`,
      );
    }

    const updatedParticipants = participants.map((participant) => {
      const resetStops = { ...participant, stopDisponibili: 2 };
      if (!idEquals(participant.id, winner.id)) return resetStops;

      const newPlayer = { ...player, prezzo: numericPrice };
      const oldCredits = Number(participant.crediti || 0);

      if (playerToSwitch) {
        return {
          ...resetStops,
          crediti:
            oldCredits + Number(playerToSwitch.prezzo || 0) - numericPrice,
          rosa: participant.rosa.map((p) =>
            idEquals(p.id, playerToSwitch.id) ? newPlayer : p,
          ),
        };
      }

      return {
        ...resetStops,
        crediti: oldCredits - numericPrice,
        rosa: [...(participant.rosa || []), newPlayer],
      };
    });

    let remainingPlayers = (session.giocatori || []).filter(
      (availablePlayer) => !idEquals(availablePlayer.id, player.id),
    );

    if (playerToSwitch) {
      remainingPlayers = [...remainingPlayers, { ...playerToSwitch }];
      remainingPlayers = sortPlayersAlphabetically(remainingPlayers);
    }

    const { player: nextPlayer, letter: nextLetter } = findNextPlayer(
      remainingPlayers,
      selectedLetter,
      activeRoleFilters,
      ALPHABET,
    );

    const lastPurchase = {
      id: player.id,
      calciatore: player.nome,
      squadra: player.squadra,
      ruolo: player.ruolo,
      vincitoreId: winner.id,
      vincitoreNome: winner.nome,
      prezzo: numericPrice,
      switchDa: playerToSwitch?.id ?? null,
      switchDaNome: playerToSwitch?.nome ?? null,
      switchDaPrezzo: playerToSwitch?.prezzo ?? null,
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
      timerRimanenteMs: null,
      timer: 10,
      timerEndsAt: null,
      storicoOfferte: [],
      ultimoAcquisto: lastPurchase,
      pendingSwitch: null,
    });

    return {
      assigned: true,
      nextPlayer,
      nextLetter,
      lastPurchase,
      updatedParticipants,
      remainingPlayers,
    };
  });
};

export const removePlayerFromRoster = async ({
  docRef,
  participantId,
  playerId,
}) => {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists()) throw new Error("Sessione non trovata.");

    const session = snapshot.data();
    const participants = session.partecipanti || [];
    const participant = participants.find((p) => idEquals(p.id, participantId));
    if (!participant) throw new Error("Squadra non trovata.");

    const player = (participant.rosa || []).find((p) => idEquals(p.id, playerId));
    if (!player) throw new Error("Giocatore non trovato nella rosa.");

    const updatedParticipants = participants.map((p) =>
      idEquals(p.id, participantId)
        ? {
            ...p,
            crediti: Number(p.crediti || 0) + Number(player.prezzo || 0),
            rosa: (p.rosa || []).filter((x) => !idEquals(x.id, playerId)),
          }
        : p,
    );

    const updatedPlayers = sortPlayersAlphabetically([
      ...(session.giocatori || []),
      player,
    ]);

    transaction.update(docRef, {
      partecipanti: updatedParticipants,
      giocatori: updatedPlayers,
    });

    return { removed: true, player };
  });
};

// Compatibilità con eventuali import precedenti.
export const buildPlayerAssignment = () => {
  throw new Error(
    "buildPlayerAssignment non va più usato direttamente: usare settleAuctionWinner().",
  );
};
