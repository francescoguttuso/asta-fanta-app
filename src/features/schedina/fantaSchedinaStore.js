import { deleteField, updateDoc } from "firebase/firestore";

export async function saveFantaSchedinaPicks(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]:
      Array.isArray(picks) ? picks : [],
  });
}

export async function submitFantaSchedina(docRef, roundIndex, teamId, picks) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]:
      Array.isArray(picks) ? picks : [],
    [`fantaSchedina.rounds.${roundIndex}.submittedAt.${teamId}`]:
      new Date().toISOString(),
  });
}

export async function deleteFantaSchedinaPick(docRef, roundIndex, teamId) {
  if (!docRef) throw new Error("Sessione non disponibile.");

  await updateDoc(docRef, {
    [`fantaSchedina.rounds.${roundIndex}.picks.${teamId}`]: deleteField(),
    [`fantaSchedina.rounds.${roundIndex}.submittedAt.${teamId}`]: deleteField(),
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
  const picks = getRoundState(session, roundIndex)?.picks || {};
  return picks[String(teamId)] ?? picks[teamId] ?? [];
}

export function hasSubmittedRound(session, roundIndex, teamId) {
  const round = getRoundState(session, roundIndex);
  const submittedAt = round?.submittedAt || {};
  if (submittedAt[String(teamId)] || submittedAt[teamId]) return true;

  // Compatibilità con le schedine già presenti prima di questa modifica.
  const picks = getRoundPicks(session, roundIndex, teamId);
  return Array.isArray(picks) && picks.length > 0;
}

export function canSubmitFromMobile(session, roundIndex, teamId) {
  return isRoundOpen(session, roundIndex) && !hasSubmittedRound(session, roundIndex, teamId);
}

export function canEditFromMobile() {
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

export function getSchedinaRankingAdjustments(session) {
  return session?.fantaSchedina?.rankingAdjustments || {};
}

export function getSchedinaRankingAdjustment(session, teamId) {
  const adjustments = getSchedinaRankingAdjustments(session);
  const raw = adjustments[String(teamId)] ?? adjustments[teamId];
  if (raw && typeof raw === "object") return Number(raw.points || 0);
  return Number(raw || 0);
}

export function calculateSchedinaCumulativeRanking(session, participants = []) {
  return participants
    .map((participant) => {
      let baseTotal = 0;
      let playedRounds = 0;

      for (let roundIndex = 1; roundIndex <= 38; roundIndex += 1) {
        const state = session?.fantaSchedina?.rounds?.[roundIndex] || {};
        const allPicks = state.picks || {};
        const allSubmittedAt = state.submittedAt || {};
        const rawPicks =
          allPicks[String(participant.id)] ??
          allPicks[participant.id] ??
          [];
        const roundPicks = Array.isArray(rawPicks) ? rawPicks : [];
        const explicitlySubmitted = Boolean(
          allSubmittedAt[String(participant.id)] ||
          allSubmittedAt[participant.id],
        );
        const matches = state.results || [];
        const storedPoints = state.pointsByTeam || {};
        const storedPointsValue =
          storedPoints[String(participant.id)] ??
          storedPoints[participant.id];

        const hasStoredPoints =
          storedPointsValue !== undefined && storedPointsValue !== null;

        const roundCalendarLength = matches.length;
        const legacySubmitted =
          !explicitlySubmitted &&
          roundPicks.length > 0 &&
          roundCalendarLength > 0;

        if (explicitlySubmitted || legacySubmitted || hasStoredPoints) {
          playedRounds += 1;

          baseTotal += hasStoredPoints
            ? Number(storedPointsValue || 0)
            : calculateSchedinaPoints(roundPicks, matches);
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
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}
