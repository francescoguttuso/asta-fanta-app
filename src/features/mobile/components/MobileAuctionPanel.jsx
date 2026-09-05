import { useEffect, useState } from "react";
import { getTeamShirtUrl } from "@/utils/teamShirt";

export default function MobileAuctionPanel({
  player,
  currentBid,
  timer,
  isTimerStarted,
  isPaused,
  stopCalledBy,
  stopTimer,
  stopStartedAt,
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
    getTeamShirtUrl(player?.squadra),
  );
  const [lastPurchaseImageSrc, setLastPurchaseImageSrc] = useState(
    getTeamShirtUrl(lastPurchase?.squadra),
  );

  useEffect(() => {
    setPlayerImageSrc(getTeamShirtUrl(player?.squadra));
  }, [player?.id, player?.squadra]);

  useEffect(() => {
    setLastPurchaseImageSrc(getTeamShirtUrl(lastPurchase?.squadra));
  }, [lastPurchase?.id, lastPurchase?.squadra]);

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

  // STOP attivo: usiamo sia isPaused sia stopCalledBy come segnali
  // autorevoli, così il Client non può mostrare il timer dell'asta
  // mentre Firestore sta già mostrando lo STOP.
  const stopActive = Boolean(isPaused || stopCalledBy);

  // Il countdown STOP viene ricavato anche dall'istante di avvio ricevuto
  // dalla sessione. Questo evita di dipendere da un eventuale valore locale
  // rimasto indietro durante il cambio di stato.
  const getStopStartedMillis = (value) => {
    if (!value) return null;
    if (typeof value === "number") return value;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value.seconds !== undefined) return Number(value.seconds) * 1000;
    return null;
  };

  const stopStartedMillis = getStopStartedMillis(stopStartedAt);
  const calculatedStopTimer = stopStartedMillis
    ? Math.max(0, 30 - Math.floor((Date.now() - stopStartedMillis) / 1000))
    : stopTimer;

  const displayedTimer = stopActive ? calculatedStopTimer : timer;
  const displayedMax = stopActive ? 30 : 10;
  const timerProgress = Math.max(
    0,
    Math.min(100, (Number(displayedTimer) / displayedMax) * 100),
  );

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

      <div className="mobile-auction-player-row">
        <div
          style={{
            minWidth: 0,
            height: "150px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {playerImageSrc ? (
            <img
              src={playerImageSrc}
              alt={`Maglia ${player.squadra || ""}`}
              style={{
                width: "100%",
                maxWidth: "112px",
                height: "145px",
                objectFit: "contain",
                display: "block",
                filter: "drop-shadow(0 8px 14px rgba(0,0,0,.45))",
              }}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span style={{ color: "#64748b", fontSize: "0.7rem", textAlign: "center" }}>
              Maglia non disponibile
            </span>
          )}
        </div>

        <div
          style={{
            minWidth: 0,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              color: "#38bdf8",
              fontSize: "clamp(1.35rem, 5vw, 1.9rem)",
              fontWeight: "900",
              lineHeight: "1.05",
              overflowWrap: "anywhere",
            }}
          >
            {player.nome}
          </div>

          <div style={{ color: "#94a3b8", fontSize: "0.95rem", marginTop: "5px" }}>
            {player.squadra} • {player.ruolo}
          </div>

          <div
            style={{
              color: isPaused ? "#f87171" : "#fbbf24",
              fontSize: "0.78rem",
              fontWeight: "900",
              marginTop: "12px",
            }}
          >
            {!isTimerStarted ? (
              <>⏳ IN ATTESA DI AVVIO</>
            ) : stopActive ? (
              <>🛑 STOP DA: <strong>{stopCalledBy}</strong></>
            ) : (
              <>⏱️ ASTA IN CORSO</>
            )}
          </div>
        </div>

        <div
          style={{
            width: "128px",
            height: "128px",
            borderRadius: "50%",
            padding: "5px",
            boxSizing: "border-box",
            background: isPaused
              ? `conic-gradient(#fb2c82 ${timerProgress}%, #24102b 0)`
              : `conic-gradient(#b33cff ${timerProgress}%, #2563ff 0)`,
            boxShadow: isPaused
              ? "0 0 22px rgba(251,44,130,.35)"
              : "0 0 25px rgba(76,81,255,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            justifySelf: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle at 50% 45%, #17102f 0%, #080d20 70%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            <div style={{ color: isPaused ? "#f87171" : "#c084fc", fontSize: "0.6rem", fontWeight: "900", letterSpacing: "0.08em" }}>{stopActive ? "STOP" : "TEMPO"}</div>
            <div style={{ color: "#fff", fontSize: "2.5rem", fontWeight: "900", lineHeight: "0.95" }}>{displayedTimer}</div>
            <div style={{ color: isPaused ? "#f87171" : "#c084fc", fontSize: "0.58rem", fontWeight: "900", marginTop: "3px" }}>SEC</div>
          </div>
        </div>
      </div>

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
              alt={`Maglia ${lastPurchase.squadra || ""}`}
              style={{
                width: "80px",
                height: "80px",
                objectFit: "contain",
                borderRadius: "10px",
                background: "#0f172a",
                border: "1px solid #334155",
                marginBottom: "8px",
              }}
              onError={(event) => {
                event.currentTarget.style.display = "none";
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
