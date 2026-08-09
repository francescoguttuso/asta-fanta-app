import { useAdminAuctionContext } from "../context/useAuctionContexts";

export default function AppNavigation() {
  const { vistaCorrente, setVistaCorrente } = useAdminAuctionContext();

  return (
    <nav className="fanta-floating-nav">
      <span
        onClick={() => setVistaCorrente("dashboard")}
        style={{
          cursor: "pointer",
          color: vistaCorrente === "dashboard" ? "#38bdf8" : "#94a3b8",
        }}
      >
        🏠 Dashboard
      </span>
      <span
        onClick={() => setVistaCorrente("rose")}
        style={{
          cursor: "pointer",
          color: vistaCorrente === "rose" ? "#38bdf8" : "#94a3b8",
        }}
      >
        👥 Rose
      </span>
      <span
        onClick={() => setVistaCorrente("calendario")}
        style={{
          cursor: "pointer",
          color: vistaCorrente === "calendario" ? "#38bdf8" : "#94a3b8",
        }}
      >
        📅 Calendario
      </span>
      <span
        onClick={() => setVistaCorrente("classifica")}
        style={{
          cursor: "pointer",
          color: vistaCorrente === "classifica" ? "#38bdf8" : "#94a3b8",
        }}
      >
        🏆 Classifica
      </span>
    </nav>
  );
}
