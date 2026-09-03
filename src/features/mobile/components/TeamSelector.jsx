export default function TeamSelector({
  participants,
  selectedTeamId,
  selectedTeam,
  remainingStops,
  onTeamChange,
  onConfirm,
}) {
  return (
    <>
      <div className="mobile-team-selector">
        <label htmlFor="mobile-team-select">Seleziona la tua squadra</label>
        <select
          id="mobile-team-select"
          value={selectedTeamId}
          onChange={(event) => onTeamChange(event.target.value)}
          className="input-field"
        >
          <option value="">Scegli la squadra...</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.nome} ({participant.crediti} FM) - 🛑 {participant.stopDisponibili ?? 2}/2
            </option>
          ))}
        </select>

        <button
          type="button"
          className="mobile-confirm-team-button"
          disabled={!selectedTeamId}
          onClick={onConfirm}
        >
          ✓ SELEZIONA SQUADRA
        </button>
      </div>

      {selectedTeam && (
        <div className="mobile-team-summary card" style={{ marginTop: "14px" }}>
          <div className="mobile-team-summary-title">
            💰 {selectedTeam.crediti} FM disponibili · 🛑 {remainingStops}/2 STOP
          </div>
          <p className="mobile-team-summary-note">
            I tuoi crediti e gli STOP disponibili saranno aggiornati automaticamente durante l'asta.
          </p>
        </div>
      )}
    </>
  );
}
