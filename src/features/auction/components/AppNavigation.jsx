import { useAdminAuctionContext } from "../context/useAuctionContexts";

const items = [
  ["dashboard", "⌂", "Bacheca"],
  ["rose", "👥", "Rose"],
  ["calendario", "📅", "Calendario"],
  ["schedina", "🎟️", "Fanta Schedina"],
  ["highlander", "🏆", "Highlander"],
  ["classifica", "📊", "Classifica"],
];

export default function AppNavigation() {
  const { vistaCorrente, setVistaCorrente } = useAdminAuctionContext();

  return (
    <nav className="server-side-nav" aria-label="Navigazione server">
      {items.map(([view, icon, label]) => (
        <button
          key={view}
          type="button"
          className={vistaCorrente === view ? "active" : ""}
          onClick={() => setVistaCorrente(view)}
        >
          <span>{icon}</span>
          <b>{label}</b>
        </button>
      ))}
    </nav>
  );
}
