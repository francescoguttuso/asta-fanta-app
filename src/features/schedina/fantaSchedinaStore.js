import { deleteField, updateDoc } from "firebase/firestore";

export async function saveFantaSchedinaPicks(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]:
      Array.isArray(picks) ? picks : [],
  });
}

export async function deleteFantaSchedinaPick(docRef, roundIndex, teamId) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]:
      deleteField(),
  });
}

export async function saveFantaSchedinaResults(docRef, roundIndex, results) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.results`]:
      Array.isArray(results) ? results : [],
  });
}

export async function setFantaSchedinaRound(docRef, roundIndex, open) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.open`]: Boolean(open),
    [`fantaSchedina.rounds.${roundIndex}.lockedAt`]:
      open ? null : new Date().toISOString(),
  });
}

export function getRoundState(session, roundIndex) {
  return session?.fantaSchedina?.rounds?.[roundIndex] || {};
}

export function isRoundOpen(session, roundIndex) {
  return Boolean(getRoundState(session, roundIndex).open);
}

export function getRoundPicks(session, roundIndex, teamId) {
  return getRoundState(session, roundIndex)?.picks?.[teamId] || [];
}

export function hasSubmittedRound(session, roundIndex, teamId) {
  const picks = getRoundPicks(session, roundIndex, teamId);
  return Array.isArray(picks) && picks.length > 0;
}

/*
 * Regola mobile:
 * - giornata CHIUSA -> non si può giocare;
 * - giornata APERTA ma schedina già consegnata -> non si può modificare;
 * - giornata APERTA e nessuna schedina -> si può compilare/consegnare.
 *
 * La modifica/cancellazione amministrativa resta invece disponibile dal server.
 */
export function canSubmitFromMobile(session, roundIndex, teamId) {
  return (
    isRoundOpen(session, roundIndex) &&
    !hasSubmittedRound(session, roundIndex, teamId)
  );
}

export function canEditFromMobile(session, roundIndex, teamId) {
  return false;
}

export function getRoundResults(session, roundIndex) {
  return getRoundState(session, roundIndex).results || [];
}

export function calculateSchedinaPoints(picks, results) {
  if (!Array.isArray(picks) || !Array.isArray(results)) return 0;

  return results.reduce(
    (points, result, index) =>
      points + (picks[index] && picks[index] === result ? 1 : 0),
    0,
  );
}
