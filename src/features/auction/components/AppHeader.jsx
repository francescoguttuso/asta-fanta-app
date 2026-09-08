import { useAdminAuctionContext } from "../context/useAuctionContexts";

export default function AppHeader() {
  const {
    esportaInExcel,
    gestisciCaricamentoJson,
    resettaTutto,
    repairMarketOpen,
    apriChiudiAstaRiparazione,
  } = useAdminAuctionContext();

  return (
    <header className="server-topbar">
      <div className="server-mobile-brand">
        <img src="/images/fantariggio-logo.png" alt="FantaRiggio" />
      </div>

      <div className="server-session-title">
        <button
          type="button"
          className={`repair-market-switch ${repairMarketOpen ? "is-open" : ""}`}
          onClick={apriChiudiAstaRiparazione}
          aria-pressed={repairMarketOpen}
          title={repairMarketOpen ? "Chiudi asta riparazione" : "Apri asta riparazione"}
        >
          <span className="repair-market-switch-track" aria-hidden="true">
            <span className="repair-market-switch-thumb" />
          </span>
          <span>
            <b>ASTA RIPARAZIONE</b>
            <small>{repairMarketOpen ? "Attiva" : "Disattivata"}</small>
          </span>
        </button>
      </div>

      <div className="server-topbar-actions">
        <button type="button" onClick={esportaInExcel} className="server-action-green">
          📊 Esporta CSV/Excel
        </button>

        <label className="server-action-blue">
          ↻ Aggiorna Dati
          <input type="file" accept=".json" onChange={gestisciCaricamentoJson} hidden />
        </label>

        <button type="button" onClick={resettaTutto} className="server-action-orange">
          ⚠ Resetta Sessione
        </button>
      </div>
    </header>
  );
}
