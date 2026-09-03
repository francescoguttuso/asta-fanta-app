import { useAdminAuctionContext } from "../context/useAuctionContexts";

export default function AppHeader() {
  const { esportaInExcel, gestisciCaricamentoJson, resettaTutto } =
    useAdminAuctionContext();

  return (
    <header className="server-topbar">
      <div className="server-mobile-brand">
        <img src="/images/fantariggio-logo.png" alt="FantaRiggio" />
      </div>

      <div className="server-session-title">
        <strong>⚑ Asta attiva: FantaRiggio Asta Pro</strong>
        <span className="server-live-pill">● LIVE</span>
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
