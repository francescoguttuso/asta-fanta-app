import { deleteField, updateDoc } from "firebase/firestore";

export const HIGHLANDER_BLOCKS = [
  { id: 1, label: "Blocco 1", from: 1, to: 2 },
  { id: 2, label: "Blocco 2", from: 3, to: 4 },
  { id: 3, label: "Blocco 3", from: 5, to: 6 },
  { id: 4, label: "Blocco 4", from: 7, to: 8 },
  { id: 5, label: "Blocco 5", from: 9, to: 10 },
  { id: 6, label: "Blocco 6", from: 11, to: 12 },
  { id: 7, label: "Blocco 7", from: 13, to: 14 },
  { id: 8, label: "Blocco 8", from: 15, to: 16 },
];

export function getHighlanderState(session) {
  return session?.highlander || {};
}

export function getHighlanderScores(session, round) {
  return getHighlanderState(session)?.scores?.[round] || {};
}

export function getSurvivors(session) {
  return getHighlanderState(session)?.survivors || [];
}

export function getEliminated(session) {
  return getHighlanderState(session)?.eliminated || [];
}

export function getBlock(blockId) {
  return HIGHLANDER_BLOCKS.find((block) => block.id === blockId) || null;
}

export function calculateBlockRanking(session, participants, blockId) {
  const block = getBlock(blockId);
  if (!block) return [];

  const activeIds =
    getSurvivors(session).length > 0
      ? new Set(getSurvivors(session).map(String))
      : new Set(participants.map((p) => String(p.id)));

  return participants
    .filter((p) => activeIds.has(String(p.id)))
    .map((p) => {
      const score1 = Number(getHighlanderScores(session, block.from)[p.id]);
      const score2 = Number(getHighlanderScores(session, block.to)[p.id]);

      return {
        id: p.id,
        nome: p.nome || p.name || `Squadra ${p.id}`,
        score1: Number.isFinite(score1) ? score1 : null,
        score2: Number.isFinite(score2) ? score2 : null,
        total:
          Number.isFinite(score1) && Number.isFinite(score2)
            ? score1 + score2
            : null,
        worst:
          Number.isFinite(score1) && Number.isFinite(score2)
            ? Math.min(score1, score2)
            : null,
      };
    })
    .sort((a, b) => {
      if (a.total == null) return 1;
      if (b.total == null) return -1;
      if (b.total !== a.total) return b.total - a.total;
      return (b.worst ?? -Infinity) - (a.worst ?? -Infinity);
    });
}

export function getEliminationCandidate(ranking) {
  if (!ranking.length || ranking.some((row) => row.total == null)) return null;

  const lowestTotal = ranking[ranking.length - 1].total;
  const tied = ranking.filter((row) => row.total === lowestTotal);

  if (tied.length === 1) {
    return { candidate: tied[0], unresolved: false, tied };
  }

  const lowestWorst = Math.min(...tied.map((row) => row.worst));
  const worstTied = tied.filter((row) => row.worst === lowestWorst);

  if (worstTied.length !== 1) {
    return {
      candidate: null,
      unresolved: true,
      tied: worstTied,
      reason:
        "Parità anche sul peggior punteggio delle due giornate: il regolamento non indica un ulteriore criterio.",
    };
  }

  return { candidate: worstTied[0], unresolved: false, tied };
}

export function blockIsComplete(session, participants, blockId) {
  const ranking = calculateBlockRanking(session, participants, blockId);
  return ranking.length > 0 && ranking.every((row) => row.total != null);
}

export async function saveHighlanderRoundScores(
  docRef,
  round,
  scores,
) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`highlander.scores.${round}`]: scores,
  });
}

export async function resetHighlanderRoundScores(docRef, round) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`highlander.scores.${round}`]: deleteField(),
  });
}

export async function confirmBlockElimination(
  docRef,
  blockId,
  eliminatedId,
  nextSurvivors,
) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`highlander.blocks.${blockId}.completed`]: true,
    [`highlander.blocks.${blockId}.eliminatedId`]: eliminatedId,
    [`highlander.blocks.${blockId}.confirmedAt`]:
      new Date().toISOString(),
    "highlander.survivors": nextSurvivors,
    [`highlander.eliminated.${eliminatedId}`]: {
      blockId,
      confirmedAt: new Date().toISOString(),
    },
  });
}

export async function saveHighlanderFinalScores(docRef, scores) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    "highlander.final.scores": scores,
  });
}

export async function setHighlanderChampion(docRef, championId) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    "highlander.final.championId": championId,
    "highlander.final.confirmedAt": new Date().toISOString(),
  });
}


export async function resetHighlander(docRef) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    highlander: deleteField(),
  });
}
