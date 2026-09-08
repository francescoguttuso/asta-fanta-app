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
  selectedTeamId,
  remainingStops,
  onBid,
  onStop,
  lastPurchase,
  pendingSwitch,
  selectedParticipant,
  onSwitch,
  repairMarketOpen,
  maxBid,
  highestReplaceablePlayer,
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


  // STOP attivo: il Client usa direttamente lo stesso stopTimer
  // aggiornato da useAuctionSession. Nessun nuovo timestamp e nessuna
  // modifica al countdown normale dell'asta.
  const stopActive = Boolean(isPaused || stopCalledBy);
  const displayedTimer = stopActive ? stopTimer : timer;
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
            ) : isPaused ? (
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
            background: stopActive
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
            <div style={{ color: stopActive ? "#f87171" : "#c084fc", fontSize: "0.6rem", fontWeight: "900", letterSpacing: "0.08em" }}>{stopActive ? "STOP" : "TEMPO"}</div>
            <div style={{ color: "#fff", fontSize: "2.5rem", fontWeight: "900", lineHeight: "0.95" }}>{displayedTimer}</div>
            <div style={{ color: "#c084fc", fontSize: "0.58rem", fontWeight: "900", marginTop: "3px" }}>SEC</div>
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
          LIMITE MASSIMO OFFERTA
      ================================================= */}

      <div
        className="alert-box"
        style={{
          margin: "0 0 12px",
          padding: "12px 14px",
          textAlign: "left",
          border: repairMarketOpen
            ? "1px solid rgba(251,191,36,.45)"
            : "1px solid rgba(56,189,248,.25)",
          background: repairMarketOpen
            ? "linear-gradient(180deg,#251804,#130c03)"
            : undefined,
        }}
      >
        <div
          style={{
            color: repairMarketOpen ? "#fbbf24" : "#38bdf8",
            fontSize: "0.78rem",
            fontWeight: "900",
            letterSpacing: "0.04em",
            marginBottom: "8px",
          }}
        >
          {repairMarketOpen ? "🛠️ LIMITE ASTA RIPARAZIONE" : "🎯 LIMITE MASSIMO OFFERTA"}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "5px 12px",
            alignItems: "center",
            fontSize: "0.86rem",
          }}
        >
          <span style={{ color: "#94a3b8" }}>💰 Crediti disponibili</span>
          <strong style={{ color: "#10b981" }}>{Number(selectedParticipant?.crediti || 0)} FM</strong>

          {highestReplaceablePlayer ? (
            <>
              <span style={{ color: "#94a3b8" }}>⭐ Più costoso sostituibile</span>
              <strong style={{ color: "#fbbf24" }}>{Number(highestReplaceablePlayer.prezzo || 0)} FM</strong>
            </>
          ) : (
            <span
              style={{
                gridColumn: "1 / -1",
                color: "#64748b",
                fontSize: "0.76rem",
              }}
            >
              {repairMarketOpen
                ? "Nessun giocatore sostituibile in questo reparto."
                : "Posto disponibile nel reparto: il limite è dato dai soli crediti."}
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: "9px",
            paddingTop: "9px",
            borderTop: "1px solid rgba(148,163,184,.18)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#cbd5e1", fontWeight: "800" }}>MAX CHIAMATA</span>
          <strong
            style={{
              color: "#fff",
              fontSize: "1.35rem",
              fontWeight: "900",
            }}
          >
            {Number(maxBid || 0)} FM
          </strong>
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
