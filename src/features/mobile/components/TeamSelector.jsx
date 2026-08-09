export default function TeamSelector({
  participants,
  selectedTeamId,
  selectedTeam,
  remainingStops,
  onTeamChange,
}) {
  return (
    <>
      <div className="card" style={{ marginBottom: "15px" }}>
        <label
          style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}
        >
          Seleziona la tua Squadra:
        </label>
        <select
          value={selectedTeamId}
          onChange={(event) => onTeamChange(event.target.value)}
          className="input-field"
          style={{ width: "100%", padding: "10px", fontSize: "1rem" }}
        >
          <option value="">-- Scegli Squadra --</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.nome} ({participant.crediti} FM) - 🛑{" "}
              {participant.stopDisponibili ?? 2}/2
            </option>
          ))}
        </select>
      </div>

      {selectedTeam && (
        <div
          className="card"
          style={{ marginBottom: "15px", background: "#1e293b" }}
        >
          <h4 style={{ margin: "0 0 5px 0", color: "#38bdf8" }}>
            I tuoi Crediti: {selectedTeam.crediti} FM | Stop: {remainingStops}/2
          </h4>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
            Rosa ({selectedTeam.rosa.length}):{" "}
            {selectedTeam.rosa
              .map((player) => `${player.nome} (${player.prezzo}FM)`)
              .join(", ") || "Nessun acquisto"}
          </p>
        </div>
      )}
    </>
  );
}
