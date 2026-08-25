import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebaseConfig";

export const FANTA_SCHEDINA_REF = doc(db, "fanta_schedina", "stagione");

function buildOpenRounds(existingRounds = {}) {
  const rounds = { ...existingRounds };

  // Only missing rounds are created as OPEN.
  // Existing rounds keep their exact open/closed state chosen by Admin.
  for (let i = 1; i <= 38; i += 1) {
    if (!rounds[i]) {
      rounds[i] = {
        open: true,
        picks: {},
        submittedAt: {},
        results: [],
        pointsByTeam: {},
      };
    }
  }

  return rounds;
}

/*
 * FantaSchedina has its own Firestore document.
 *
 * IMPORTANT:
 * - after the first creation, the auction document is never read again;
 * - existing round state is preserved;
 * - the auction cannot reset/recreate this document while the user scrolls
 *   through players.
 *
 * auctionDocRef is accepted only for a ONE-TIME legacy migration when the
 * independent document does not exist yet.
 */
export async function ensureFantaSchedinaDocument(auctionDocRef = null) {
  const target = await getDoc(FANTA_SCHEDINA_REF);

  if (target.exists()) {
    const current = target.data() || {};
    const rounds = current.rounds || {};
    const normalizedRounds = buildOpenRounds(rounds);

    const needsRoundInitialization = Object.keys(normalizedRounds).some(
      (key) => !rounds[key],
    );

    if (needsRoundInitialization) {
      await updateDoc(FANTA_SCHEDINA_REF, {
        rounds: normalizedRounds,
      });

      return {
        ...current,
        rounds: normalizedRounds,
      };
    }

    return current;
  }

  // ONE-TIME migration only if the independent FantaSchedina document
  // has never existed. This is never executed again after creation.
  const source = auctionDocRef ? await getDoc(auctionDocRef) : null;
  const legacy = source?.exists() ? source.data()?.fantaSchedina || {} : {};

  const data = {
    ...legacy,
    rounds: buildOpenRounds(legacy.rounds || {}),
    activeRound: legacy.activeRound ?? null,
    rankingAdjustments: legacy.rankingAdjustments || {},
    migratedFromAuctionSession: Boolean(
      source?.exists() && source.data()?.fantaSchedina,
    ),
    createdAt: new Date().toISOString(),
  };

  await setDoc(FANTA_SCHEDINA_REF, data, { merge: true });
  return data;
}

export async function saveFantaSchedinaPicks(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("FantaSchedina non disponibile.");
  await updateDoc(docRef, { [`rounds.${roundIndex}.picks.${teamId}`]: Array.isArray(picks) ? picks : [] });
}
export async function submitFantaSchedina(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("FantaSchedina non disponibile.");

  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error("FantaSchedina non inizializzata.");

  const session = snapshot.data() || {};
  const round = session?.rounds?.[roundIndex] || {};
  const submittedAt = round?.submittedAt || {};

  if (submittedAt[String(teamId)] || submittedAt[teamId]) {
    throw new Error("Schedina già confermata.");
  }

  if (round.open !== true) {
    throw new Error("Giornata chiusa.");
  }

  await updateDoc(docRef, {
    [`rounds.${roundIndex}.picks.${teamId}`]: Array.isArray(picks) ? picks : [],
    [`rounds.${roundIndex}.submittedAt.${teamId}`]: new Date().toISOString(),
  });
}
export async function deleteFantaSchedinaPick(docRef, roundIndex, teamId) {
  if (!docRef) throw new Error("FantaSchedina non disponibile.");
  await updateDoc(docRef, {
    [`rounds.${roundIndex}.picks.${teamId}`]: deleteField(),
    [`rounds.${roundIndex}.submittedAt.${teamId}`]: deleteField(),
  });
}
export async function saveFantaSchedinaResults(docRef, roundIndex, results, pointsByTeam = {}) {
  if (!docRef) throw new Error("FantaSchedina non disponibile.");
  await updateDoc(docRef, {
    [`rounds.${roundIndex}.results`]: Array.isArray(results) ? results : [],
    [`rounds.${roundIndex}.pointsByTeam`]: pointsByTeam,
  });
}
export async function setFantaSchedinaRound(docRef, roundIndex, open) {
  if (!docRef) throw new Error("FantaSchedina non disponibile.");
  await updateDoc(docRef, {
    [`rounds.${roundIndex}.open`]: Boolean(open),
    [`rounds.${roundIndex}.lockedAt`]: open ? null : new Date().toISOString(),
    activeRound: open ? roundIndex : null,
  });
}
export function getRoundState(session, roundIndex) { return session?.rounds?.[roundIndex] || {}; }
export function isRoundOpen(session, roundIndex) { return Boolean(getRoundState(session, roundIndex).open); }
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
export function canSubmitFromMobile(session, roundIndex, teamId) { return isRoundOpen(session, roundIndex) && !hasSubmittedRound(session, roundIndex, teamId); }
export function canEditFromMobile() { return false; }
export function getRoundResults(session, roundIndex) { return getRoundState(session, roundIndex).results || []; }
export function calculateSchedinaPoints(picks, results) {
  if (!Array.isArray(picks) || !Array.isArray(results)) return 0;
  return results.reduce((p, r, i) => p + (picks[i] && picks[i] === r ? 1 : 0), 0);
}
export function getSchedinaRankingAdjustments(session) { return session?.rankingAdjustments || {}; }
export function getSchedinaRankingAdjustment(session, teamId) {
  const raw = getSchedinaRankingAdjustments(session)[String(teamId)] ?? getSchedinaRankingAdjustments(session)[teamId];
  if (raw && typeof raw === "object") return Number(raw.points || 0);
  return Number(raw || 0);
}
export function calculateSchedinaCumulativeRanking(session, participants = []) {
  return participants.map((participant) => {
    let baseTotal = 0, playedRounds = 0;
    for (let i = 1; i <= 38; i += 1) {
      const state = session?.rounds?.[i] || {};
      const picks = state.picks?.[String(participant.id)] ?? state.picks?.[participant.id] ?? [];
      const submitted = Boolean(state.submittedAt?.[String(participant.id)] || state.submittedAt?.[participant.id]);
      const stored = state.pointsByTeam?.[String(participant.id)] ?? state.pointsByTeam?.[participant.id];
      const hasStored = stored !== undefined && stored !== null;
      const legacy = !submitted && Array.isArray(picks) && picks.length > 0 && (state.results || []).length > 0;
      if (submitted || legacy || hasStored) {
        playedRounds += 1;
        baseTotal += hasStored ? Number(stored || 0) : calculateSchedinaPoints(picks, state.results || []);
      }
    }
    const adjustment = getSchedinaRankingAdjustment(session, participant.id);
    return { id: participant.id, nome: participant?.nome || participant?.name || `Squadra ${participant.id}`, baseTotal, adjustment, total: baseTotal + adjustment, playedRounds };
  }).sort((a,b) => b.total - a.total || a.nome.localeCompare(b.nome));
}
