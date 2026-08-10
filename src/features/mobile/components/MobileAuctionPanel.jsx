export default function MobileAuctionPanel({
  player,
  currentBid,
  timer,
  isTimerStarted,
  isPaused,
  stopCalledBy,
  stopTimer,
  selectedTeamId,
  remainingStops,
  onBid,
  onStop,
  lastPurchase,
}) {
  if (!player) {
    return (
      <div
        className="card"
        style={{
          textAlign: "center",
          padding: "20px",
        }}
      >
        <p style={{ color: "#94a3b8" }}>Nessun calciatore sul banditore.</p>
      </div>
    );
  }

  const actionsDisabled =
    !selectedTeamId || !isTimerStarted || timer === 0 || isPaused;

  /*
   * Lo STOP è disponibile SOLO dopo un'offerta
   * superiore a 30 FM.
   *
   * 30 FM  -> disattivato
   * 31 FM+ -> attivato
   */
  const stopDisabled =
    actionsDisabled || currentBid <= 30 || remainingStops <= 0;

  return (
    <div
      className="card"
      style={{
        textAlign: "center",
      }}
    >
      <h3
        style={{
          color: "#38bdf8",
          margin: "5px 0",
        }}
      >
        {player.nome} ({player.squadra}) - [{player.ruolo}]
      </h3>

      <div
        className="alert-box"
        style={{
          margin: "10px 0",
        }}
      >
        <h4
          style={{
            fontSize: "1.4rem",
            margin: 0,
          }}
        >
          Offerta: <span style={{ color: "#10b981" }}>{currentBid} FM</span>
        </h4>

        <div
          style={{
            marginTop: "8px",
            fontSize: "1.1rem",
            fontWeight: "bold",
          }}
        >
          {!isTimerStarted ? (
            <span style={{ color: "#fbbf24" }}>⏳ IN ATTESA DI AVVIO</span>
          ) : isPaused ? (
            <div style={{ color: "#f87171" }}>
              🛑 STOP DA: <strong>{stopCalledBy}</strong>
              <div
                style={{
                  fontSize: "1.2rem",
                  marginTop: "3px",
                }}
              >
                ⏱️ Ripresa tra: {stopTimer}s
              </div>
            </div>
          ) : (
            <span>⏱️ Timer: {timer}s</span>
          )}
        </div>
      </div>

      <div className="mobile-bid-actions">
        <button
          onClick={() => onBid(1)}
          disabled={actionsDisabled}
          className="btn"
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "1.1rem",
          }}
        >
          +1 FM 🔨
        </button>

        <button
          onClick={() => onBid(5)}
          disabled={actionsDisabled}
          className="btn btn-green"
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "1.1rem",
          }}
        >
          +5 FM 🚀
        </button>
      </div>

      <button
        onClick={onStop}
        disabled={stopDisabled}
        className="btn btn-orange"
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "1.1rem",
          marginTop: "10px",
          opacity: stopDisabled ? 0.5 : 1,
          cursor: stopDisabled ? "not-allowed" : "pointer",
        }}
      >
        🛑 CHIEDI STOP (30s) - Rimasti: {remainingStops}/2
      </button>

      {/* ULTIMO ACQUISTO */}
      {lastPurchase && (
        <div
          className="alert-box"
          style={{
            marginTop: "15px",
            padding: "15px",
            textAlign: "center",
          }}
        >
          <h4
            style={{
              color: "#38bdf8",
              margin: "0 0 12px",
              fontSize: "1.15rem",
            }}
          >
            🏆 ULTIMO ACQUISTO
          </h4>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "1rem",
            }}
          >
            <div>
              ⚽ <strong>{lastPurchase.calciatore}</strong>
              {lastPurchase.ruolo && ` (${lastPurchase.ruolo})`}
            </div>

            <div>
              💰 Prezzo:{" "}
              <strong style={{ color: "#10b981" }}>
                {lastPurchase.prezzo} FM
              </strong>
            </div>

            <div>
              👑 Aggiudicato a:{" "}
              <strong style={{ color: "#fbbf24" }}>
                {lastPurchase.vincitoreNome}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
