import { doc, updateDoc } from "firebase/firestore";

export const EMPTY_FANTA_SCHEDINA = {
  activeRound: 1,
  rounds: {},
};

export async function saveFantaSchedinaPicks(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  const safePicks = Array.isArray(picks) ? picks : [];

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]: safePicks,
  });
}

export async function saveFantaSchedinaResults(docRef, roundIndex, results) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.results`]: results,
  });
}

export async function setFantaSchedinaRound(
  docRef,
  roundIndex,
  { open = true } = {},
) {
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
  return (results || []).reduce(
    (points, result, index) =>
      points + (picks?.[index] && picks[index] === result ? 1 : 0),
    0,
  );
}
