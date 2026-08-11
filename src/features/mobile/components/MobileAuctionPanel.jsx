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
   * STOP disponibile SOLO sopra 30 FM.
   *
   * 30 FM  → disabilitato
   * 31 FM+ → abilitato
   */
  const stopDisabled =
    actionsDisabled || currentBid <= 30 || remainingStops <= 0;

  return (
    <div
      className="card"
      style={{
        textAlign: "center",
        padding: "14px",
      }}
    >
      {/* =====================================================
          GIOCATORE IN ASTA
      ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        {/* IMMAGINE GIOCATORE */}

        <img
          src={`/images/players/${player.id}.webp`}
          alt={player.nome}
          style={{
            width: "64px",
            height: "64px",
            objectFit: "contain",
            borderRadius: "10px",
            background: "#0f172a",
            border: "1px solid #334155",
          }}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

        {/* NOME */}

        <div
          style={{
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "#38bdf8",
              fontSize: "1.2rem",
              fontWeight: "800",
            }}
          >
            {player.nome}
          </div>

          <div
            style={{
              color: "#94a3b8",
              fontSize: "0.85rem",
              marginTop: "3px",
            }}
          >
            {player.squadra} • {player.ruolo}
          </div>
        </div>
      </div>

      {/* =====================================================
          TIMER + CLESSIDRA
      ===================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          marginBottom: "12px",
        }}
      >
        {/* CLESSIDRA */}

        <div
          style={{
            fontSize: "2rem",
            lineHeight: 1,
            display: "inline-block",
            animation:
              isTimerStarted && !isPaused
                ? "hourglassSpin 1.5s linear infinite"
                : "none",
          }}
        >
          ⏳
        </div>

        {/* TIMER */}

        <div
          style={{
            fontSize: "2rem",
            fontWeight: "900",
            color: isPaused ? "#f87171" : timer <= 3 ? "#f97316" : "#38bdf8",
            minWidth: "70px",
          }}
        >
          {isPaused ? stopTimer : timer}s
        </div>
      </div>

      {/* =====================================================
          STATO ASTA
      ===================================================== */}

      <div
        style={{
          marginBottom: "12px",
          fontWeight: "700",
          fontSize: "0.9rem",
        }}
      >
        {!isTimerStarted ? (
          <span style={{ color: "#fbbf24" }}>⏳ IN ATTESA DI AVVIO</span>
        ) : isPaused ? (
          <div
            style={{
              color: "#f87171",
            }}
          >
            🛑 STOP RICHIESTO DA <strong>{stopCalledBy}</strong>
            <div
              style={{
                marginTop: "4px",
                fontSize: "0.85rem",
                color: "#fca5a5",
              }}
            >
              Ripresa tra {stopTimer}s
            </div>
          </div>
        ) : (
          <span style={{ color: "#94a3b8" }}>🔨 ASTA IN CORSO</span>
        )}
      </div>

      {/* =====================================================
          OFFERTA CORRENTE
      ===================================================== */}

      <div
        className="alert-box"
        style={{
          margin: "10px 0",
          padding: "12px",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: "0.75rem",
            textTransform: "uppercase",
          }}
        >
          Offerta corrente
        </div>

        <div
          style={{
            color: "#10b981",
            fontSize: "1.8rem",
            fontWeight: "900",
            marginTop: "2px",
          }}
        >
          {currentBid} FM
        </div>
      </div>

      {/* =====================================================
          PULSANTI OFFERTE
      ===================================================== */}

      <div
        className="mobile-bid-actions"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          marginTop: "10px",
        }}
      >
        {/* +1 */}

        <button
          onClick={() => onBid(1)}
          disabled={actionsDisabled}
          className="btn"
          style={{
            padding: "13px 6px",
            fontSize: "1rem",
            fontWeight: "800",
            background: "#2563eb",
            border: "1px solid #3b82f6",
            color: "#fff",
          }}
        >
          +1 FM
        </button>

        {/* +5 */}

        <button
          onClick={() => onBid(5)}
          disabled={actionsDisabled}
          className="btn"
          style={{
            padding: "13px 6px",
            fontSize: "1rem",
            fontWeight: "800",
            background: "#16a34a",
            border: "1px solid #22c55e",
            color: "#fff",
          }}
        >
          +5 FM
        </button>

        {/* +10 */}

        <button
          onClick={() => onBid(10)}
          disabled={actionsDisabled}
          className="btn"
          style={{
            padding: "13px 6px",
            fontSize: "1rem",
            fontWeight: "800",
            background: "#7c3aed",
            border: "1px solid #8b5cf6",
            color: "#fff",
          }}
        >
          +10 FM
        </button>
      </div>

      {/* =====================================================
          STOP
      ===================================================== */}

      <button
        onClick={onStop}
        disabled={stopDisabled}
        className="btn btn-orange"
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "1rem",
          fontWeight: "800",
          marginTop: "10px",
          opacity: stopDisabled ? 0.45 : 1,
          cursor: stopDisabled ? "not-allowed" : "pointer",
        }}
      >
        🛑 CHIEDI STOP (30s)
        <span style={{ marginLeft: "6px" }}>• {remainingStops}/2</span>
      </button>

      {/* =====================================================
          ULTIMO ACQUISTO
      ===================================================== */}

      {lastPurchase && (
        <div
          className="alert-box"
          style={{
            marginTop: "14px",
            padding: "13px",
            textAlign: "center",
          }}
        >
          <h4
            style={{
              color: "#38bdf8",
              margin: "0 0 10px",
              fontSize: "1rem",
            }}
          >
            🏆 ULTIMO ACQUISTO
          </h4>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "0.9rem",
            }}
          >
            <div>
              ⚽ <strong>{lastPurchase.calciatore}</strong>
              {lastPurchase.ruolo && ` (${lastPurchase.ruolo})`}
            </div>

            <div>
              💰 Prezzo:{" "}
              <strong
                style={{
                  color: "#10b981",
                }}
              >
                {lastPurchase.prezzo} FM
              </strong>
            </div>

            <div>
              👑 Aggiudicato a:{" "}
              <strong
                style={{
                  color: "#fbbf24",
                }}
              >
                {lastPurchase.vincitoreNome}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ANIMAZIONE CLESSIDRA
      ===================================================== */}

      <style>
        {`
          @keyframes hourglassSpin {
            0% {
              transform: rotate(0deg);
            }

            45% {
              transform: rotate(0deg);
            }

            50% {
              transform: rotate(180deg);
            }

            95% {
              transform: rotate(180deg);
            }

            100% {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}
