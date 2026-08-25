import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";

export const FANTA_SCHEDINA_CONFIG_REF = doc(db, "fanta_schedina", "config");
export const FANTA_SCHEDINA_CLASSIFICA_REF = doc(
  db,
  "fanta_schedina",
  "classifica",
);
export const FANTA_SCHEDINA_GIORNATE_REF = collection(
  db,
  "fanta_schedina",
  "giornate",
);

// Kept as an alias so existing components that only need the store reference
// continue to work while the actual data is now split into independent docs.
export const FANTA_SCHEDINA_REF = FANTA_SCHEDINA_CONFIG_REF;

export function getRoundRef(roundIndex) {
  return doc(db, "fanta_schedina", "giornate", String(roundIndex));
}

function emptyRound(roundIndex) {
  return {
    round: Number(roundIndex),
    open: true,
    picks: {},
    submittedAt: {},
    results: [],
    pointsByTeam: {},
  };
}

/*
 * One-time migration:
 * - if independent round documents already exist, NEVER touch them;
 * - otherwise read the legacy fanta_schedina/stagione document once;
 * - after migration, no FantaSchedina function reads the auction document.
 */
export async function ensureFantaSchedinaDocument(auctionDocRef = null) {
  const configSnap = await getDoc(FANTA_SCHEDINA_CONFIG_REF);

  if (!configSnap.exists()) {
    let legacy = {};
    if (auctionDocRef) {
      const source = await getDoc(auctionDocRef);
      if (source.exists()) legacy = source.data()?.fantaSchedina || {};
    }

    await setDoc(
      FANTA_SCHEDINA_CONFIG_REF,
      {
        version: 2,
        activeRound: legacy.activeRound ?? null,
        migratedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    const legacyRounds = legacy.rounds || {};
    for (let i = 1; i <= 38; i += 1) {
      const ref = getRoundRef(i);
      const existing = await getDoc(ref);
      if (existing.exists()) continue;

      const old = legacyRounds[i] || legacyRounds[String(i)];
      await setDoc(ref, old ? { ...emptyRound(i), ...old } : emptyRound(i), {
        merge: true,
      });
    }

    const classificaSnap = await getDoc(FANTA_SCHEDINA_CLASSIFICA_REF);
    if (!classificaSnap.exists()) {
      await setDoc(
        FANTA_SCHEDINA_CLASSIFICA_REF,
        {
          rankingAdjustments: legacy.rankingAdjustments || {},
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
  }

  // Ensure missing rounds exist, but NEVER reset existing rounds.
  for (let i = 1; i <= 38; i += 1) {
    const ref = getRoundRef(i);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, emptyRound(i));
    }
  }

  return (await getDoc(FANTA_SCHEDINA_CONFIG_REF)).data() || {};
}

export async function saveFantaSchedinaPicks(docRefOrRound, roundIndexOrTeam, teamIdOrPicks, maybePicks) {
  // Supports both the old signature and the new round-only signature.
  const roundIndex =
    maybePicks === undefined ? docRefOrRound : roundIndexOrTeam;
  const teamId =
    maybePicks === undefined ? roundIndexOrTeam : teamIdOrTeam;
  const picks = maybePicks === undefined ? teamIdOrPicks : maybePicks;

  const ref = getRoundRef(roundIndex);
  await updateDoc(ref, {
    [`picks.${teamId}`]: Array.isArray(picks) ? picks : [],
  });
}

export async function submitFantaSchedina(docRefOrRound, roundIndexOrTeam, teamIdOrPicks, maybePicks) {
  const roundIndex =
    maybePicks === undefined ? docRefOrRound : roundIndexOrTeam;
  const teamId =
    maybePicks === undefined ? roundIndexOrTeam : teamIdOrPicks;
  const picks = maybePicks === undefined ? teamIdOrPicks : maybePicks;

  const ref = getRoundRef(roundIndex);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Giornata non inizializzata.");

  const round = snapshot.data() || {};
  const submittedAt = round.submittedAt || {};

  if (submittedAt[String(teamId)] || submittedAt[teamId]) {
    throw new Error("Schedina già confermata.");
  }
  if (round.open !== true) throw new Error("Giornata chiusa.");

  await updateDoc(ref, {
    [`picks.${teamId}`]: Array.isArray(picks) ? picks : [],
    [`submittedAt.${teamId}`]: new Date().toISOString(),
  });
}

export async function deleteFantaSchedinaPick(docRefOrRound, roundIndexOrTeam, teamId) {
  const roundIndex = typeof docRefOrRound === "number" ? docRefOrRound : roundIndexOrTeam;
  const ref = getRoundRef(roundIndex);
  await updateDoc(ref, {
    [`picks.${teamId}`]: deleteField(),
    [`submittedAt.${teamId}`]: deleteField(),
  });
}

export async function saveFantaSchedinaResults(docRefOrRound, roundIndexOrResults, resultsOrPoints, maybePoints) {
  const roundIndex =
    maybePoints === undefined ? docRefOrRound : roundIndexOrResults;
  const results =
    maybePoints === undefined ? roundIndexOrResults : resultsOrPoints;
  const pointsByTeam =
    maybePoints === undefined ? resultsOrPoints : maybePoints;

  await updateDoc(getRoundRef(roundIndex), {
    results: Array.isArray(results) ? results : [],
    pointsByTeam: pointsByTeam || {},
  });
}

export async function setFantaSchedinaRound(docRefOrRound, roundIndexOrOpen, maybeOpen) {
  const roundIndex =
    maybeOpen === undefined ? docRefOrRound : roundIndexOrOpen;
  const open = maybeOpen === undefined ? roundIndexOrOpen : maybeOpen;

  await updateDoc(getRoundRef(roundIndex), {
    open: Boolean(open),
    lockedAt: open ? null : new Date().toISOString(),
  });

  await setDoc(
    FANTA_SCHEDINA_CONFIG_REF,
    { activeRound: open ? Number(roundIndex) : null, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

export function getRoundState(session, roundIndex) {
  // Compatibility helper for callers that still pass a session object.
  return session?.rounds?.[roundIndex] || {};
}
export function isRoundOpen(session, roundIndex) {
  return Boolean(getRoundState(session, roundIndex).open);
}
export function getRoundPicks(session, roundIndex, teamId) {
  const picks = getRoundState(session, roundIndex)?.picks || {};
  return picks[String(teamId)] ?? picks[teamId] ?? [];
}
export function hasSubmittedRound(session, roundIndex, teamId) {
  const round = getRoundState(session, roundIndex);
  const submittedAt = round?.submittedAt || {};
  if (submittedAt[String(teamId)] || submittedAt[teamId]) return true;
  const picks = getRoundPicks(session, roundIndex, teamId);
  return Array.isArray(picks) && picks.length > 0;
}
export function canSubmitFromMobile(session, roundIndex, teamId) {
  return isRoundOpen(session, roundIndex) && !hasSubmittedRound(session, roundIndex, teamId);
}
export function canEditFromMobile() { return false; }
export function getRoundResults(session, roundIndex) {
  return getRoundState(session, roundIndex).results || [];
}
export function calculateSchedinaPoints(picks, results) {
  if (!Array.isArray(picks) || !Array.isArray(results)) return 0;
  return results.reduce((p, r, i) => p + (picks[i] && picks[i] === r ? 1 : 0), 0);
}

export function getSchedinaRankingAdjustments(session) {
  return session?.rankingAdjustments || {};
}
export function getSchedinaRankingAdjustment(session, teamId) {
  const raw =
    getSchedinaRankingAdjustments(session)[String(teamId)] ??
    getSchedinaRankingAdjustments(session)[teamId];
  if (raw && typeof raw === "object") return Number(raw.points || 0);
  return Number(raw || 0);
}

export function calculateSchedinaCumulativeRanking(session, participants = []) {
  return participants.map((participant) => {
    let baseTotal = 0;
    let playedRounds = 0;
    for (let i = 1; i <= 38; i += 1) {
      const state = session?.rounds?.[i] || {};
      const picks = state.picks?.[String(participant.id)] ?? state.picks?.[participant.id] ?? [];
      const submitted = Boolean(
        state.submittedAt?.[String(participant.id)] ||
        state.submittedAt?.[participant.id],
      );
      const stored =
        state.pointsByTeam?.[String(participant.id)] ??
        state.pointsByTeam?.[participant.id];
      const hasStored = stored !== undefined && stored !== null;
      const legacy =
        !submitted &&
        Array.isArray(picks) &&
        picks.length > 0 &&
        (state.results || []).length > 0;
      if (submitted || legacy || hasStored) {
        playedRounds += 1;
        baseTotal += hasStored
          ? Number(stored || 0)
          : calculateSchedinaPoints(picks, state.results || []);
      }
    }

    const adjustment = getSchedinaRankingAdjustment(session, participant.id);
    return {
      id: participant.id,
      nome: participant?.nome || participant?.name || `Squadra ${participant.id}`,
      baseTotal,
      adjustment,
      total: baseTotal + adjustment,
      playedRounds,
    };
  }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}
