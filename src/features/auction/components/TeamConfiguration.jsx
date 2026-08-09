import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "../context/useAuctionContexts";

export default function TeamConfiguration() {
  const { isConfigMode, partecipanti } = useAuctionSessionContext();
  const { cambiaNomeSquadra, impostaModalitaConfigurazione } =
    useAdminAuctionContext();

  if (!isConfigMode) {
    return (
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button
          onClick={() => impostaModalitaConfigurazione(true)}
          className="btn btn-grey"
        >
          ✏️ Modifica Squadre
        </button>
      </div>
    );
  }

  return (
    <div className="card config-card">
      <h2>⚙️ Configurazione Iniziale Squadre</h2>
      <div className="config-grid">
        {partecipanti.map((participant) => (
          <div
            key={participant.id}
            style={{ display: "flex", flexDirection: "column" }}
          >
            <label style={{ fontSize: "12px", fontWeight: "bold" }}>
              Squadra {participant.id}
            </label>
            <input
              type="text"
              value={participant.nome}
              onChange={(event) =>
                cambiaNomeSquadra(participant.id, event.target.value)
              }
              className="input-field"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => impostaModalitaConfigurazione(false)}
        className="btn btn-orange"
        style={{ width: "100%", padding: "12px" }}
      >
        🔒 Avvia Asta Live
      </button>
    </div>
  );
}
