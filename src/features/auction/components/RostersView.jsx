import { ROLE_LIMITS } from "../../../data/auctionDefaults";
import { countRosterRoles } from "../../../utils/playerUtils";

export default function RostersView({ participants }) {
  return (
    <div className="card" style={{ width: "100%", marginTop: "20px" }}>
      <h2>👥 Gestione Dettagliata Rose di Tutti i Partecipanti</h2>
      {participants.map((participant) => {
        const roleCounts = countRosterRoles(participant.rosa, ROLE_LIMITS);

        return (
          <div
            key={participant.id}
            style={{
              marginBottom: "20px",
              borderBottom: "1px solid #334155",
              paddingBottom: "15px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ color: "#38bdf8", margin: 0 }}>
                {participant.nome}
              </h3>
              <span style={{ color: "#10b981", fontWeight: "bold" }}>
                Crediti Residui: {participant.crediti} FM
              </span>
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#fbbf24",
                marginTop: "5px",
              }}
            >
              Composizione Ruoli: P: {roleCounts.P}/3 | D: {roleCounts.D}/8 | C:{" "}
              {roleCounts.C}/8 | A: {roleCounts.A}/6
            </div>
            {participant.rosa.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "10px",
                }}
              >
                {participant.rosa.map((player, index) => (
                  <span
                    key={index}
                    style={{
                      background: "#1e293b",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      border: "1px solid #475569",
                    }}
                  >
                    <strong>{player.nome}</strong> ({player.ruolo}) -{" "}
                    <em>{player.prezzo} FM</em>
                  </span>
                ))}
              </div>
            ) : (
              <p
                style={{
                  fontStyle: "italic",
                  color: "#64748b",
                  fontSize: "0.85rem",
                  marginTop: "8px",
                }}
              >
                Nessun giocatore in rosa al momento.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
