export default function MobileBottomNav({ activeView, onNavigate }) {
  const tabs = [
    { id: "asta", label: "ASTA", icon: "🔨" },
    { id: "schedina", label: "SCHEDINA", icon: "🎟️" },
    { id: "highlander", label: "HIGHLANDER", icon: "🏆" },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigazione principale">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeView === tab.id ? "active" : ""}
          onClick={() => onNavigate(tab.id)}
        >
          <span>{tab.icon}</span>
          <strong>{tab.label}</strong>
        </button>
      ))}
    </nav>
  );
}
