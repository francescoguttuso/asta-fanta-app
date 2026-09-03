export const normalizePlayer = (player) => ({
  id: player.id,
  nome: player.nome || player.name || "Sconosciuto",
  squadra: player.squadra || player.team || "N.D.",
  ruolo:
    typeof player.ruolo === "object"
      ? player.ruolo.code
      : player.ruolo || player.role?.code || "D",
});

export const sortPlayersAlphabetically = (players) =>
  [...players].sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", {
      sensitivity: "base",
      numeric: true,
    }),
  );

export const normalizePlayers = (players) =>
  sortPlayersAlphabetically(players.map(normalizePlayer));

export const getUnassignedPlayers = (players, participants) => {
  const rosteredIds = new Set(
    (participants || []).flatMap((participant) =>
      Array.isArray(participant.rosa)
        ? participant.rosa.map((player) => String(player.id))
        : [],
    ),
  );

  return sortPlayersAlphabetically(
    (players || []).filter((player) => !rosteredIds.has(String(player.id))),
  );
};

export const filterPlayers = (players, selectedLetter, activeRoleFilters) =>
  sortPlayersAlphabetically(players).filter((player) => {
    const matchesLetter =
      selectedLetter === "TUTTE" ||
      player.nome.toUpperCase().startsWith(selectedLetter);
    const matchesRole = activeRoleFilters[player.ruolo];

    return matchesLetter && matchesRole;
  });

export const countRosterRoles = (roster, roleLimits) =>
  Object.keys(roleLimits).reduce(
    (counts, role) => ({
      ...counts,
      [role]: roster.filter((player) => player.ruolo === role).length,
    }),
    {},
  );

export const findNextPlayer = (
  players,
  selectedLetter,
  activeRoleFilters,
  alphabet,
) => {
  if (players.length === 0) {
    return { player: null, letter: selectedLetter };
  }

  const sortedPlayers = sortPlayersAlphabetically(players);
  const startingLetter =
    selectedLetter === "TUTTE"
      ? sortedPlayers[0].nome[0].toUpperCase()
      : selectedLetter;
  const startingIndex = Math.max(0, alphabet.indexOf(startingLetter));

  for (let offset = 0; offset < alphabet.length; offset += 1) {
    const currentIndex = (startingIndex + offset) % alphabet.length;
    const currentLetter = alphabet[currentIndex];
    const candidate = sortedPlayers.find(
      (player) =>
        player.nome.toUpperCase().startsWith(currentLetter) &&
        activeRoleFilters[player.ruolo],
    );

    if (candidate) {
      return {
        player: candidate,
        letter: selectedLetter === "TUTTE" ? selectedLetter : currentLetter,
      };
    }
  }

  return { player: sortedPlayers[0], letter: selectedLetter };
};
