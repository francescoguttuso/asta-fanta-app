import { runTransaction, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { ALPHABET, ROLE_LIMITS } from "@/data/auctionDefaults";
import {
  AUCTION_DURATION_MS,
  getRemainingMilliseconds,
} from "@/utils/timerUtils";
import {
  findNextPlayer,
  getUnassignedPlayers,
  sortPlayersAlphabetically,
} from "@/utils/playerUtils";

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
  timerStartedAt = null,
  pendingSwitch = null,
  repairMarketOpen = false,
  repairMarketInitialRosters = null,
  repairMarketOpenedAt = null,
  repairMarketInitialized = true,
}) => {
  // IMPORTANTISSIMO: l'asta e la FantaSchedina condividono lo stesso
  // documento Firestore. Senza merge:true, ogni salvataggio dell'asta
  // sostituiva l'intero documento e cancellava fantaSchedina (schedine,
  // risultati, punti e classifica).
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
    timerStartedAt,
    pendingSwitch,
    repairMarketOpen,
    repairMarketInitialRosters,
    repairMarketOpenedAt,
    repairMarketInitialized,
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
      timerStartedAt: serverTimestamp(),
    });
  });
};

export const buildSwitchCandidates = (participant, role, repairMarketInitialRosters = null) => {
  if (!participant?.rosa?.length || !role) return [];

  const initialIds = repairMarketInitialRosters?.[String(participant.id)];
  const eligibleIds = Array.isArray(initialIds) ? new Set(initialIds.map(String)) : null;

  return participant.rosa
    .filter((player) => String(player.ruolo) === String(role))
    .filter((player) => !eligibleIds || eligibleIds.has(String(player.id)))
    .map((player) => ({
      id: player.id,
      nome: player.nome,
      prezzo: Number(player.prezzo || 0),
      ruolo: player.ruolo,
    }));
};

export const calculateMaximumBid = ({ participant, role, repairMarketOpen = false, repairMarketInitialRosters = null }) => {
  if (!participant) return 0;

  const credits = Math.max(0, Number(participant.crediti || 0));
  const roster = Array.isArray(participant.rosa) ? participant.rosa : [];
  const sameRolePlayers = roster.filter(
    (player) => String(player.ruolo) === String(role),
  );

  const roleLimit = ROLE_LIMITS[role] || 0;
  const roleIsFull = roleLimit > 0 && sameRolePlayers.length >= roleLimit;

  if (!roleIsFull) return credits;

  const candidates = buildSwitchCandidates(
    participant,
    role,
    repairMarketOpen ? repairMarketInitialRosters : null,
  );
  if (!candidates.length) return 0;

  const highestCutValue = candidates.reduce(
    (max, player) => Math.max(max, Number(player.prezzo || 0)),
    0,
  );

  return credits + highestCutValue;
};

export const placeBid = async ({ docRef, bidderId, bidderName, increment }) => {
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;

    const session = snap.data();
    if (session.isPaused || !session.isTimerStarted || session.pendingSwitch) return;

    const bidder = (session.partecipanti || []).find(
      (p) => String(p.id) === String(bidderId),
    );
    if (!bidder || !session.giocatoreInAsta) return;

    const maximumBid = calculateMaximumBid({
      participant: bidder,
      role: session.giocatoreInAsta.ruolo,
      repairMarketOpen: Boolean(session.repairMarketOpen),
      repairMarketInitialRosters: session.repairMarketInitialRosters || null,
    });

    const newBid =
      Number(session.offertaCorrente || 0) + Number(increment || 0);

    if (newBid > maximumBid) {
      throw new Error(
        `Offerta non sostenibile: massimo consentito ${maximumBid} FM.`,
      );
    }

    const newHistoryEntry = {
      nome: bidderName,
      importo: newBid,
      ora: new Date().toLocaleTimeString(),
    };

    transaction.update(docRef, {
      offertaCorrente: newBid,
      ultimoOfferenteId: bidderId,
      timer: 10,
      timerEndsAt: Date.now() + AUCTION_DURATION_MS,
      timerStartedAt: serverTimestamp(),
      isPaused: false,
      stopChiamatoDa: null,
      stopIniziatoAt: null,
      storicoOfferte: [
        newHistoryEntry,
        ...(session.storicoOfferte || []),
      ].slice(0, 5),
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
      timerStartedAt: remainingTimerMs > 0 ? serverTimestamp() : null,
    });
  });
};

export const createContextualSwitch = async ({
  docRef,
  winnerId,
  price,
  players,
  selectedLetter = "TUTTE",
  activeRoleFilters = { P: true, D: true, C: true, A: true },
}) => {
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;

    const session = snap.data();
    if (session.pendingSwitch || !session.giocatoreInAsta) return;

    const winner = (session.partecipanti || []).find(
      (p) => String(p.id) === String(winnerId),
    );
    if (!winner) return;

    const player = session.giocatoreInAsta;
    const role = player.ruolo;
    const roleLimit = ROLE_LIMITS[role] || 0;
    const roleCount = (winner.rosa || []).filter(
      (p) => String(p.ruolo) === String(role),
    ).length;

    if (roleCount < roleLimit) {
      throw new Error("Il taglio contestuale non è necessario per questa squadra.");
    }

    const candidates = buildSwitchCandidates(
      winner,
      role,
      session.repairMarketOpen ? session.repairMarketInitialRosters : null,
    );
    if (!candidates.length) {
      throw new Error(`Nessun giocatore da svincolare nel reparto ${role}.`);
    }

    const maximumBid = calculateMaximumBid({
      participant: winner,
      role,
      repairMarketOpen: Boolean(session.repairMarketOpen),
      repairMarketInitialRosters: session.repairMarketInitialRosters || null,
    });
    if (Number(price) > maximumBid) {
      throw new Error(
        `Offerta non sostenibile: massimo consentito ${maximumBid} FM.`,
      );
    }

    const currentPlayers = Array.isArray(players)
      ? players
      : (session.giocatori || []);

    const remainingPlayers = [
      ...currentPlayers.filter((p) => String(p.id) !== String(player.id)),
      ...[],
    ];

    const { player: nextPlayer, letter: nextLetter } = findNextPlayer(
      remainingPlayers,
      selectedLetter,
      activeRoleFilters,
      ALPHABET,
    );

    transaction.update(docRef, {
      pendingSwitch: {
        winnerId: winner.id,
        winnerName: winner.nome,
        price: Number(price),
        player,
        role,
        switchCandidates: candidates,
        nextPlayer: nextPlayer || null,
        nextLetter: nextLetter || selectedLetter,
        selectedLetter,
        activeRoleFilters,
      },
      isPaused: true,
      isTimerStarted: false,
      timer: 0,
      timerEndsAt: null,
    });
  });
};

export const completeContextualSwitch = async ({ docRef, candidateId }) => {
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;

    const session = snap.data();
    const pending = session.pendingSwitch;
    if (!pending) return;

    const winner = (session.partecipanti || []).find(
      (p) => String(p.id) === String(pending.winnerId),
    );
    if (!winner) return;

    const roster = Array.isArray(winner.rosa) ? winner.rosa : [];
    const initialIds = session.repairMarketOpen
      ? session.repairMarketInitialRosters?.[String(winner.id)]
      : null;
    const candidateIsEligible = Array.isArray(initialIds)
      ? initialIds.map(String).includes(String(candidateId))
      : true;

    const candidate = roster.find(
      (p) =>
        String(p.id) === String(candidateId) &&
        String(p.ruolo) === String(pending.role) &&
        candidateIsEligible,
    );

    if (!candidate) {
      throw new Error("Giocatore da svincolare non trovato in rosa.");
    }

    const candidatePrice = Number(candidate.prezzo || 0);
    const price = Number(pending.price || 0);

    if (price > Number(winner.crediti || 0) + candidatePrice) {
      throw new Error(
        `Il giocatore scelto non rende sostenibile l'acquisto a ${price} FM.`,
      );
    }

    const updatedWinner = {
      ...winner,
      crediti: Number(winner.crediti || 0) - price + candidatePrice,
      rosa: [
        ...roster.filter((p) => String(p.id) !== String(candidateId)),
        { ...pending.player, prezzo: price },
      ],
      stopDisponibili: 2,
    };

    const updatedParticipants = (session.partecipanti || []).map((p) =>
      String(p.id) === String(winner.id)
        ? updatedWinner
        : { ...p, stopDisponibili: 2 },
    );

    const currentPlayers = Array.isArray(session.giocatori)
      ? session.giocatori
      : [];

    const remainingPlayers = getUnassignedPlayers(
      [
        ...currentPlayers.filter(
          (p) => String(p.id) !== String(pending.player.id),
        ),
        { ...candidate },
      ],
      updatedParticipants,
    );

    const fallbackResult = findNextPlayer(
      remainingPlayers,
      pending.selectedLetter || pending.nextLetter || "TUTTE",
      pending.activeRoleFilters || { P: true, D: true, C: true, A: true },
      ALPHABET,
    );

    const nextPlayer = fallbackResult.player || pending.nextPlayer || null;
    const nextLetter = fallbackResult.letter || pending.nextLetter || "TUTTE";

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
      ultimoAcquisto: {
        id: pending.player.id,
        calciatore: pending.player.nome,
        squadra: pending.player.squadra,
        ruolo: pending.player.ruolo,
        vincitoreNome: winner.nome,
        prezzo: price,
      },
      storicoOfferte: [],
      timer: 10,
      timerEndsAt: null,
      timerStartedAt: null,
      pendingSwitch: null,
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
    id: player.id,
    calciatore: player.nome,
    squadra: player.squadra,
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

  // Invariante: il listone contiene esclusivamente giocatori non assegnati.
  // Il giocatore appena acquistato viene quindi escluso e, come ulteriore
  // protezione, filtriamo anche eventuali vecchi duplicati presenti nelle rose.
  const remainingPlayers = getUnassignedPlayers(
    players.filter((availablePlayer) => availablePlayer.id !== player.id),
    updatedParticipants,
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
