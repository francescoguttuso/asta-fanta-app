import { useAdminAuctionContext } from "../context/useAuctionContexts";

export default function AppNavigation() {
  const { vistaCorrente, setVistaCorrente } = useAdminAuctionContext();

  const itemStyle = (active) => ({
    cursor: "pointer",
    color: active ? "#38bdf8" : "#94a3b8",
  });

  return (
    <nav className="fanta-floating-nav">
      <span
        onClick={() => setVistaCorrente("dashboard")}
        style={itemStyle(vistaCorrente === "dashboard")}
      >
        🏠 Dashboard
      </span>

      <span
        onClick={() => setVistaCorrente("rose")}
        style={itemStyle(vistaCorrente === "rose")}
      >
        👥 Rose
      </span>

      <span
        onClick={() => setVistaCorrente("calendario")}
        style={itemStyle(vistaCorrente === "calendario")}
      >
        📅 Calendario
      </span>

      <span
        onClick={() => setVistaCorrente("schedina")}
        style={itemStyle(vistaCorrente === "schedina")}
      >
        🎟️ Fanta Schedina
      </span>


      <span
        onClick={() => setVistaCorrente("highlander")}
        style={itemStyle(vistaCorrente === "highlander")}
      >
        🏆 Highlander
      </span>

      <span
        onClick={() => setVistaCorrente("classifica")}
        style={itemStyle(vistaCorrente === "classifica")}
      >
        🏆 Classifica
      </span>
    </nav>
  );
}
