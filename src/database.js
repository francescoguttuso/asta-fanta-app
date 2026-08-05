import datiJson from "./giocatori.json";

// 1. TRASFORMAZIONE E DATI INIZIALI
export const GIOCATORI_INITIAL = (datiJson?.players || []).map((player) => ({
  id: player.id,
  nome: player.name,
  squadra: player.team,
  ruolo: player.role.code, // 'P', 'D', 'C', 'A'
  prezzoIniziale: 1,
  comprato: false,
}));

export const PARTECIPANTI_INITIAL = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  nome: `Fanta Squadra ${i + 1}`,
  crediti: 500,
  rosa: [],
}));

export const LIMITI_RUOLO = { P: 3, D: 8, C: 8, A: 6 };
export const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// 2. FUNZIONI HELPER (Rendono la logica in App.jsx facilissima!)

/**
 * Verifica se una squadra ha ancora posti disponibili per un dato ruolo
 */
export const puoAcquistareRuolo = (squadra, ruolo) => {
  const conteggioAttuale = squadra.rosa.filter((p) => p.ruolo === ruolo).length;
  const limiteMassimo = LIMITI_RUOLO[ruolo] || 0;
  return conteggioAttuale < limiteMassimo;
};

/**
 * Calcola i crediti rimanenti di una squadra
 */
export const calcolaCreditiResidui = (squadra, prezzoAcquisto) => {
  return squadra.crediti - prezzoAcquisto;
};
