export default function MobileHeader({ activeView = "asta", onNavigate, onMenu }) {
  const tabs = [
    { id: "asta", label: "ASTA", icon: "🔨" },
    { id: "schedina", label: "SCHEDINA", icon: "🎟️" },
    { id: "highlander", label: "HIGHLANDER", icon: "🏆" },
  ];

  return (
    <>
      <header className="mobile-app-header">
        <button type="button" className="mobile-menu-button" onClick={onMenu} aria-label="Apri menu">
          <span />
          <span />
          <span />
        </button>

        <img className="mobile-brand-logo" src="/images/fantariggio-logo.png" alt="FantaRiggio Fantacalcio" />

        <div className="mobile-header-actions">
          <span className="mobile-live-badge">LIVE <small>◉</small></span>
          <span className="mobile-notification" aria-label="Notifiche">♧<i /></span>
        </div>
      </header>

      {onNavigate && (
        <nav className="mobile-top-nav" aria-label="Navigazione mobile">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeView === tab.id ? "active" : ""}
              onClick={() => onNavigate(tab.id)}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
