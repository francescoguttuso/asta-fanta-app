import { useEffect, useState } from "react";

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
  pendingSwitch,
  selectedParticipant,
  onSwitch,
}) {
  const [playerImageSrc, setPlayerImageSrc] = useState(
    player?.id ? `/images/players/${player.id}.png` : null,
  );
  const [playerImageRetry, setPlayerImageRetry] = useState(0);
  const [lastPurchaseImageSrc, setLastPurchaseImageSrc] = useState(
    lastPurchase?.id ? `/images/players/${lastPurchase.id}.png` : null,
  );
  const [lastPurchaseRetry, setLastPurchaseRetry] = useState(0);

  useEffect(() => {
    setPlayerImageRetry(0);
    setPlayerImageSrc(player?.id ? `/images/players/${player.id}.png` : null);
  }, [player?.id]);

  useEffect(() => {
    setLastPurchaseRetry(0);
    setLastPurchaseImageSrc(
      lastPurchase?.id ? `/images/players/${lastPurchase.id}.png` : null,
    );
  }, [lastPurchase?.id]);

  // =====================================================
  // NESSUN GIOCATORE IN ASTA
  // =====================================================

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

  // =====================================================
  // STATO PULSANTI
  // =====================================================

  const isSwitchWinner =
    pendingSwitch &&
    selectedTeamId &&
    String(pendingSwitch.winnerId) === String(selectedTeamId);

  const switchCandidates = pendingSwitch?.switchCandidates || [];
  const switchPrice = Number(pendingSwitch?.price || 0);
  const switchBalance = Number(selectedParticipant?.crediti || 0);

  const switchCard = pendingSwitch ? (
    <div
      className="card"
      style={{
        marginBottom: "12px",
        padding: "16px",
        border: "1px solid #f59e0b",
        background: "linear-gradient(180deg,#241504,#130b02)",
      }}
    >
      <h3 style={{ color: "#fbbf24", margin: "0 0 8px" }}>
        🔄 TAGLIO CONTESTUALE
      </h3>
      <div style={{ color: "#fff", fontWeight: "700", marginBottom: "6px" }}>
        {pendingSwitch.player?.nome} aggiudicato a {switchPrice} FM
      </div>
      {isSwitchWinner ? (
        <>
          <div style={{ color: "#94a3b8", marginBottom: "10px" }}>
            Saldo crediti: <strong style={{ color: "#10b981" }}>{switchBalance} FM</strong><br />
            Chi vuoi svincolare?
          </div>
          {switchCandidates.length === 0 ? (
            <div style={{ padding: "12px", borderRadius: "8px", background: "#3f1d1d", color: "#fca5a5" }}>
              Nessun calciatore disponibile da svincolare in questo reparto.
            </div>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            {switchCandidates.map((candidate) => {
              const budget = switchBalance + Number(candidate.prezzo || 0);
              const enabled = budget >= switchPrice;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={!enabled}
                  onClick={() => onSwitch(candidate.id)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #475569",
                    background: enabled ? "#14532d" : "#1e293b",
                    color: enabled ? "#fff" : "#64748b",
                    opacity: enabled ? 1 : 0.55,
                    cursor: enabled ? "pointer" : "not-allowed",
                    textAlign: "left",
                  }}
                >
                  🔄 {candidate.nome} — {candidate.prezzo} FM
                  <span style={{ float: "right" }}>
                    {enabled ? "SWITCH" : "🔒"}
                  </span>
                </button>
              );
            })}
          </div>
          )}
        </>
      ) : (
        <div style={{ color: "#94a3b8" }}>
          ⏳ In attesa dello switch di <strong>{pendingSwitch.winnerName}</strong>...
        </div>
      )}
    </div>
  ) : null;

  const actionsDisabled =
    !selectedTeamId || !isTimerStarted || timer === 0 || isPaused || pendingSwitch;

  /*
   * STOP disponibile SOLO dopo un'offerta
   * superiore a 30 FM.
   *
   * 30 FM  -> disabilitato
   * 31 FM+ -> abilitato
   */

  const stopDisabled =
    actionsDisabled || currentBid <= 30 || remainingStops <= 0;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      {switchCard}

    <div
      className="card"
      style={{
        textAlign: "center",
        padding: "12px",
      }}
    >
      {/* =================================================
          GIOCATORE IN ASTA
      ================================================= */}

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "14px",
          marginBottom: "12px",
          minHeight: "150px",
        }}
      >
        {/* ===============================================
            CAMPIONCINO
        =============================================== */}

        <div
          style={{
            width: "105px",
            minWidth: "105px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={playerImageSrc}
            alt={player.nome}
            style={{
              width: "105px",
              height: "150px",
              objectFit: "contain",
              borderRadius: "12px",
            }}
            onError={() => {
              if (playerImageRetry < 3) {
                const nextRetry = playerImageRetry + 1;
                setPlayerImageRetry(nextRetry);
                setTimeout(() => {
                  setPlayerImageSrc(`/images/players/${player.id}.png?v=${nextRetry}`);
                }, 250 * nextRetry);
              } else {
                setPlayerImageSrc(null);
              }
            }}
          />
        </div>

        {/* ===============================================
            INFORMAZIONI GIOCATORE
        =============================================== */}

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            textAlign: "center",
            padding: "4px 0",
          }}
        >
          {/* NOME */}

          <div>
            <div
              style={{
                color: "#38bdf8",
                fontSize: "2rem",
                fontWeight: "800",
                lineHeight: "1.1",
              }}
            >
              {player.nome}
            </div>

            <div
              style={{
                color: "#94a3b8",
                fontSize: "1.2rem",
                marginTop: "4px",
              }}
            >
              {player.squadra} • {player.ruolo}
            </div>
          </div>

          {/* =============================================
              TIMER
          ============================================= */}

          <div
            style={{
              textAlign: "center",
              fontSize: "2.4rem",
              fontWeight: "800",
              color: "#38bdf8",
              lineHeight: "1",
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation:
                  isTimerStarted && !isPaused
                    ? "hourglassSpin 3s linear infinite"
                    : "none",
              }}
            >
              ⏳
            </span>{" "}
            {timer}s
          </div>

          {/* =============================================
              STATO ASTA
          ============================================= */}

          <div
            style={{
              textAlign: "center",
              fontSize: "1rem",
              fontWeight: "800",
              color: "#fbbf24",
              whiteSpace: "nowrap",
            }}
          >
            {!isTimerStarted ? (
              <>⏳ IN ATTESA DI AVVIO</>
            ) : isPaused ? (
              <div
                style={{
                  color: "#f87171",
                }}
              >
                🛑 STOP DA: <strong>{stopCalledBy}</strong>
                <div
                  style={{
                    fontSize: "1rem",
                    marginTop: "4px",
                  }}
                >
                  ⏱️ Ripresa tra: {stopTimer}s
                </div>
              </div>
            ) : (
              <>⏱️ TIMER ATTIVO</>
            )}
          </div>
        </div>
      </div>

      {/* =================================================
          ANIMAZIONE CLESSIDRA
      ================================================= */}

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

      {/* =================================================
          OFFERTA CORRENTE
      ================================================= */}

      <div
        className="alert-box"
        style={{
          margin: "10px 0 12px",
          padding: "14px",
        }}
      >
        <div
          style={{
            color: "#94a3b8",
            fontSize: "0.9rem",
            marginBottom: "4px",
          }}
        >
          OFFERTA CORRENTE
        </div>

        <div
          style={{
            color: "#10b981",
            fontSize: "2rem",
            fontWeight: "800",
          }}
        >
          {currentBid} FM
        </div>
      </div>

      {/* =================================================
          PULSANTI OFFERTE
      ================================================= */}

      <div
        className="mobile-bid-actions"
        style={{
          display: "flex",
          gap: "10px",
        }}
      >
        {/* +1 */}

        <button
          onClick={() => onBid(1)}
          disabled={actionsDisabled}
          className="btn"
          style={{
            flex: 1,
            padding: "12px 6px",
            fontSize: "1.1rem",
            fontWeight: "800",
            background: "#2854a6",
            border: "none",
            color: "#fff",
            opacity: actionsDisabled ? 0.5 : 1,
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
            flex: 1,
            padding: "12px 6px",
            fontSize: "1.1rem",
            fontWeight: "800",
            background: "#18794e",
            border: "none",
            color: "#fff",
            opacity: actionsDisabled ? 0.5 : 1,
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
            flex: 1,
            padding: "12px 6px",
            fontSize: "1.1rem",
            fontWeight: "800",
            background: "#5935a8",
            border: "none",
            color: "#fff",
            opacity: actionsDisabled ? 0.5 : 1,
          }}
        >
          +10 FM
        </button>
      </div>

      {/* =================================================
          STOP
      ================================================= */}

      <button
        onClick={onStop}
        disabled={stopDisabled}
        className="btn btn-orange"
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "1.05rem",
          fontWeight: "800",
          marginTop: "12px",

          opacity: stopDisabled ? 0.5 : 1,

          cursor: stopDisabled ? "not-allowed" : "pointer",
        }}
      >
        🛑 CHIEDI STOP (30s) • {remainingStops}/2
      </button>

      {/* =================================================
          ULTIMO ACQUISTO
      ================================================= */}

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

          {/* CAMPIONCINO ULTIMO ACQUISTO */}

          {lastPurchase.id && (
            <img
              src={lastPurchaseImageSrc}
              alt={lastPurchase.calciatore}
              style={{
                width: "80px",
                height: "80px",
                objectFit: "contain",
                borderRadius: "10px",
                background: "#0f172a",
                border: "1px solid #334155",
                marginBottom: "8px",
              }}
              onError={() => {
                if (lastPurchaseRetry < 3) {
                  const nextRetry = lastPurchaseRetry + 1;
                  setLastPurchaseRetry(nextRetry);
                  setTimeout(() => {
                    setLastPurchaseImageSrc(`/images/players/${lastPurchase.id}.png?v=${nextRetry}`);
                  }, 250 * nextRetry);
                } else {
                  setLastPurchaseImageSrc(null);
                }
              }}
            />
          )}

          {/* DATI ACQUISTO */}

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
    </div>
    </>
  );
}
