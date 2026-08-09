import { ROLE_LIMITS } from "../../../data/auctionDefaults";
import { countRosterRoles } from "../../../utils/playerUtils";
import { useAuctionSessionContext } from "../context/useAuctionContexts";

export default function TeamsSummary() {
  const { partecipanti } = useAuctionSessionContext();

  return (
    <div className="card teams-card">
      <h2>👥 Rose e Crediti Residui</h2>
      {partecipanti.map((participant) => {
        const roleCounts = countRosterRoles(participant.rosa, ROLE_LIMITS);

        return (
          <div
            key={participant.id}
            className="team-row"
            style={{
              display: "block",
              padding: "10px",
              marginBottom: "8px",
              borderBottom: "1px solid #334155",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
              }}
            >
              <span>{participant.nome}</span>
              <span style={{ color: "#10b981" }}>
                {participant.crediti} FM
              </span>
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#38bdf8",
                marginTop: "4px",
              }}
            >
              P: {roleCounts.P}/3 | D: {roleCounts.D}/8 | C: {roleCounts.C}/8 |
              A: {roleCounts.A}/6
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#94a3b8",
                marginTop: "4px",
              }}
            >
              Rosa ({participant.rosa.length}): {" "}
              {participant.rosa
                .map((player) => `${player.nome} (${player.prezzo}FM)`)
                .join(", ") || "Nessun acquisto"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
