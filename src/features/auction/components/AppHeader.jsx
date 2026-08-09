import { useAdminAuctionContext } from "../context/useAuctionContexts";

export default function AppHeader() {
  const {
    esportaInExcel,
    gestisciCaricamentoJson,
    resettaTutto,
  } = useAdminAuctionContext();

  return (
    <div className="header-container">
      <h1 className="main-title">⚽ FantaRiggio Asta Pro (Server) ⚽</h1>
      <div className="header-actions">
        <button onClick={esportaInExcel} className="btn btn-green">
          📊 Esporta CSV Pulito
        </button>

        <label
          className="btn btn-blue"
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          📂 Aggiorna JSON
          <input
            type="file"
            accept=".json"
            onChange={gestisciCaricamentoJson}
            style={{ display: "none" }}
          />
        </label>

        <button onClick={resettaTutto} className="btn btn-orange">
          ⚠️ Resetta Sessione
        </button>
      </div>
    </div>
  );
}
