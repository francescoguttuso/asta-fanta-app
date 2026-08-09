import { ALPHABET } from "../../../data/auctionDefaults";
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

  return (
    <div className="card players-card">
      <h2>
        🔍 Elenco Giocatori Disponibili ({players.length} / {giocatori.length})
      </h2>

      <div className="role-filters">
        <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
          Filtra Ruoli:
        </span>
        {Object.keys(activeRoleFilters).map((role) => (
          <label
            key={role}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <input
              type="checkbox"
              checked={activeRoleFilters[role]}
              onChange={() => onRoleToggle(role)}
            />
            {role}
          </label>
        ))}
      </div>

      <div className="letter-filters">
        <button
          onClick={() => onLetterChange("TUTTE")}
          className={`btn ${
            selectedLetter === "TUTTE" ? "btn-blue" : "btn-grey"
          }`}
          style={{ padding: "5px 10px", fontSize: "0.8rem" }}
        >
          TUTTE
        </button>
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            onClick={() => onLetterChange(letter)}
            className={`btn ${
              selectedLetter === letter ? "btn-blue" : "btn-grey"
            }`}
            style={{
              padding: "5px 8px",
              fontSize: "0.8rem",
              minWidth: "30px",
            }}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="player-list">
        {players.map((player) => (
          <div key={player.id} className="player-row">
            <span className="player-name">
              {player.nome} - {player.squadra} ({player.ruolo})
            </span>
            <button
              onClick={() => onCallPlayer(player)}
              disabled={isConfigMode}
              className="btn-call btn-blue"
            >
              Chiama 🔨
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
