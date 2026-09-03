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
function getFirstOpenRound(rounds = {}) {
  for (let i = 1; i <= 38; i += 1) {
    const round = rounds[i] ?? rounds[String(i)];
    if (round?.open === true) return i;
  }
  return null;
}

export async function ensureFantaSchedinaDocument(auctionDocRef = null) {
  const target = await getDoc(FANTA_SCHEDINA_REF);

  if (target.exists()) {
    const current = target.data() || {};
    const rounds = current.rounds || {};
    const existingActiveRound = Number(current.activeRound);
    const activeIsOpen =
      Number.isInteger(existingActiveRound) &&
      existingActiveRound >= 1 &&
      existingActiveRound <= 38 &&
      (rounds[existingActiveRound] ?? rounds[String(existingActiveRound)])?.open === true;

    const firstOpenRound = activeIsOpen
      ? existingActiveRound
      : getFirstOpenRound(rounds) || 1;
    const normalizedRounds = buildOpenRounds(rounds);

    const needsRoundInitialization = Object.keys(normalizedRounds).some(
      (key) => !rounds[key],
    );

    const needsExcludedTeamsInitialization = !Array.isArray(current.excludedTeamIds);

    if (
      needsRoundInitialization ||
      !Number.isInteger(existingActiveRound) ||
      needsExcludedTeamsInitialization
    ) {
      await updateDoc(FANTA_SCHEDINA_REF, {
        ...(needsRoundInitialization ? { rounds: normalizedRounds } : {}),
        ...(!Number.isInteger(existingActiveRound) ? { activeRound: firstOpenRound } : {}),
        ...(needsExcludedTeamsInitialization ? { excludedTeamIds: [] } : {}),
      });

      return {
        ...current,
        rounds: normalizedRounds,
        activeRound: Number.isInteger(existingActiveRound)
          ? existingActiveRound
          : firstOpenRound,
        excludedTeamIds: Array.isArray(current.excludedTeamIds)
          ? current.excludedTeamIds
          : [],
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
    excludedTeamIds: Array.isArray(legacy.excludedTeamIds)
      ? legacy.excludedTeamIds
      : [],
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

  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("FantaSchedina non inizializzata.");

  const current = snap.data() || {};
  const rounds = current.rounds || {};
  const currentRound = Number(roundIndex);

  if (open) {
    await updateDoc(docRef, {
      [`rounds.${currentRound}.open`]: true,
      [`rounds.${currentRound}.lockedAt`]: null,
      activeRound: currentRound,
    });
    return;
  }

  let nextRound = null;
  for (let i = currentRound + 1; i <= 38; i += 1) {
    const candidate = rounds[i] ?? rounds[String(i)];
    if (candidate?.open === true) {
      nextRound = i;
      break;
    }
  }

  if (nextRound === null && currentRound < 38) {
    nextRound = currentRound + 1;
    if (!rounds[nextRound] && !rounds[String(nextRound)]) {
      await updateDoc(docRef, {
        [`rounds.${nextRound}`]: {
          open: true,
          picks: {},
          submittedAt: {},
          results: [],
          pointsByTeam: {},
        },
      });
    }
  }

  await updateDoc(docRef, {
    [`rounds.${currentRound}.open`]: false,
    [`rounds.${currentRound}.lockedAt`]: new Date().toISOString(),
    activeRound: nextRound,
  });
}

export function getExcludedFantaSchedinaTeamIds(session) {
  if (!Array.isArray(session?.excludedTeamIds)) return [];
  return session.excludedTeamIds.map(String);
}

export function isFantaSchedinaTeamExcluded(session, teamId) {
  if (teamId === undefined || teamId === null || teamId === "") return false;
  return getExcludedFantaSchedinaTeamIds(session).includes(String(teamId));
}

export async function setFantaSchedinaTeamParticipation(
  docRef,
  teamId,
  enabled,
) {
  if (!docRef) throw new Error("FantaSchedina non disponibile.");

  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error("FantaSchedina non inizializzata.");

  const current = snap.data() || {};
  const excluded = new Set(
    Array.isArray(current.excludedTeamIds)
      ? current.excludedTeamIds.map(String)
      : [],
  );
  const id = String(teamId);

  if (enabled) excluded.delete(id);
  else excluded.add(id);

  await updateDoc(docRef, {
    excludedTeamIds: Array.from(excluded),
  });
}

function fileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportFantaSchedinaData() {
  const snap = await getDoc(FANTA_SCHEDINA_REF);
  if (!snap.exists()) throw new Error("Nessun dato FantaSchedina disponibile.");

  downloadJson(
    {
      type: "fanta_schedina_backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      document: snap.data(),
    },
    `FantaSchedina_backup_${fileStamp()}.json`,
  );
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

  // A draft pick is NOT a submitted schedina.
  // The mobile screen saves each single prediction immediately, so picks
  // can exist before the user presses "Conferma schedina".
  // Only submittedAt marks the schedina as definitively sent/locked.
  return Boolean(
    submittedAt[String(teamId)] || submittedAt[teamId],
  );
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
