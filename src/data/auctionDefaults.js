import playersData from "../giocatori.json";
import { normalizePlayers } from "../utils/playerUtils";

export const ROLE_LIMITS = { P: 3, D: 8, C: 8, A: 6 };

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const INITIAL_ROLE_FILTERS = {
  P: true,
  D: true,
  C: true,
  A: true,
};

export const INITIAL_PLAYERS = normalizePlayers(
  playersData.players || playersData,
);

export const INITIAL_PARTICIPANTS = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  nome: `Fanta Squadra ${index + 1}`,
  crediti: 500,
  rosa: [],
  stopDisponibili: 2,
}));
