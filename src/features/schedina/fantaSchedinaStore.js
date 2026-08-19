import { updateDoc } from "firebase/firestore";

export async function saveFantaSchedinaPicks(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]:
      Array.isArray(picks) ? picks : [],
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
    [`fantaSchedina.rounds.${roundIndex}.open`]: open,
    "fantaSchedina.activeRound": open ? roundIndex : null,
  });
}

export function getRoundPicks(session, roundIndex, teamId) {
  return (
    session?.fantaSchedina?.rounds?.[roundIndex]?.picks?.[teamId] || []
  );
}

export function getRoundResults(session, roundIndex) {
  return session?.fantaSchedina?.rounds?.[roundIndex]?.results || [];
}

export function calculateSchedinaPoints(picks, results) {
  if (!Array.isArray(picks) || !Array.isArray(results)) return 0;

  return results.reduce(
    (points, result, index) =>
      points + (picks[index] && picks[index] === result ? 1 : 0),
    0,
  );
}
