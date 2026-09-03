import { useMemo, useState } from "react";
import { ALPHABET } from "@/data/auctionDefaults";
import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "../context/useAuctionContexts";

export default function AvailablePlayers() {
  const { giocatori, isConfigMode } = useAuctionSessionContext();
  const {
    giocatoriFiltrati: players,
    filtriRuoliAttivi: activeRoleFilters,
    filtroLettera: selectedLetter,
    cambiaFiltroRuolo: onRoleToggle,
    setFiltroLettera: onLetterChange,
    chiamaGiocatore: onCallPlayer,
  } = useAdminAuctionContext();
  const [query, setQuery] = useState("");

  const visiblePlayers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return players;
    return players.filter((player) =>
      `${player.nome} ${player.squadra} ${player.ruolo}`.toLowerCase().includes(normalized),
    );
  }, [players, query]);

  return (
    <div className="server-panel server-players-card">
      <div className="server-panel-title">
        <span>🔎</span> ELENCO GIOCATORI DISPONIBILI ({visiblePlayers.length} / {giocatori.length})
      </div>

      <div className="server-player-tools">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca giocatore o squadra..."
        />
        <div className="server-role-filters">
          <span>Ruolo:</span>
          {Object.keys(activeRoleFilters).map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={activeRoleFilters[role]}
                onChange={() => onRoleToggle(role)}
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      <div className="server-letter-filters">
        <button
          type="button"
          className={selectedLetter === "TUTTE" ? "active" : ""}
          onClick={() => onLetterChange("TUTTE")}
        >
          TUTTE
        </button>
        {ALPHABET.map((letter) => (
          <button
            type="button"
            key={letter}
            className={selectedLetter === letter ? "active" : ""}
            onClick={() => onLetterChange(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="server-player-list-head">
        <span>GIOCATORE</span><span>SQUADRA</span><span>RUOLO</span><span>AZIONE</span>
      </div>

      <div className="server-player-list">
        {visiblePlayers.map((player) => (
          <div key={player.id} className="server-player-row">
            <strong title={player.nome}>{player.nome}</strong>
            <span title={player.squadra}>{player.squadra}</span>
            <b>{player.ruolo}</b>
            <button
              type="button"
              onClick={() => onCallPlayer(player)}
              disabled={isConfigMode}
            >
              CHIAMA ›
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
