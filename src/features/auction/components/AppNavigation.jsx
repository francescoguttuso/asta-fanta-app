export default function AppNavigation({ currentView, onViewChange }) {
  return (
    <nav className="fanta-floating-nav">
      <span
        onClick={() => onViewChange("dashboard")}
        style={{
          cursor: "pointer",
          color: currentView === "dashboard" ? "#38bdf8" : "#94a3b8",
        }}
      >
        🏠 Dashboard
      </span>
      <span
        onClick={() => onViewChange("rose")}
        style={{
          cursor: "pointer",
          color: currentView === "rose" ? "#38bdf8" : "#94a3b8",
        }}
      >
        👥 Rose
      </span>
      <span
        onClick={() => onViewChange("calendario")}
        style={{
          cursor: "pointer",
          color: currentView === "calendario" ? "#38bdf8" : "#94a3b8",
        }}
      >
        📅 Calendario
      </span>
      <span
        onClick={() => onViewChange("classifica")}
        style={{
          cursor: "pointer",
          color: currentView === "classifica" ? "#38bdf8" : "#94a3b8",
        }}
      >
        🏆 Classifica
      </span>
    </nav>
  );
}
