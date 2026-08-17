import { useEffect, useState } from "react";

function RetryPlayerImage({ id, alt, width, height, style = {} }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [id]);

  if (!id) return null;

  if (failed) {
    return (
      <div
        title={alt}
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "12px",
          background: "#0f172a",
          border: "1px solid #334155",
          color: "#64748b",
          fontSize: "2rem",
          ...style,
        }}
      >
        ⚽
      </div>
    );
  }

  const src = `/images/players/${id}.png${attempt > 0 ? `?retry=${attempt}` : ""}`;

  return (
    <img
      key={`${id}-${attempt}`}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      loading="eager"
      decoding="async"
      onError={() => {
        if (attempt < 3) {
          window.setTimeout(
            () => setAttempt((value) => value + 1),
            150 * (attempt + 1),
          );
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

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
  maximumBid = 0,
  onBid,
  onStop,
  lastPurchase,
}) {
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

  const actionsDisabled =
    !selectedTeamId || !isTimerStarted || timer === 0 || isPaused;

  const bidDisabled = (increment) =>
    actionsDisabled || currentBid + increment > maximumBid;

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
          <RetryPlayerImage
            id={player.id}
            alt={player.nome}
            width={105}
            height={150}
            style={{
              width: "105px",
              height: "150px",
              objectFit: "contain",
              borderRadius: "12px",
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

      <div
        style={{
          marginBottom: "10px",
          color: "#94a3b8",
          fontSize: "0.85rem",
          textAlign: "center",
        }}
      >
        Potenza economica massima: {maximumBid} FM
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
          disabled={bidDisabled(1)}
          className="btn"
          style={{
            flex: 1,
            padding: "12px 6px",
            fontSize: "1.1rem",
            fontWeight: "800",
            background: "#2854a6",
            border: "none",
            color: "#fff",
            opacity: bidDisabled(1) ? 0.5 : 1,
          }}
        >
          +1 FM
        </button>

        {/* +5 */}

        <button
          onClick={() => onBid(5)}
          disabled={bidDisabled(5)}
          className="btn"
          style={{
            flex: 1,
            padding: "12px 6px",
            fontSize: "1.1rem",
            fontWeight: "800",
            background: "#18794e",
            border: "none",
            color: "#fff",
            opacity: bidDisabled(5) ? 0.5 : 1,
          }}
        >
          +5 FM
        </button>

        {/* +10 */}

        <button
          onClick={() => onBid(10)}
          disabled={bidDisabled(10)}
          className="btn"
          style={{
            flex: 1,
            padding: "12px 6px",
            fontSize: "1.1rem",
            fontWeight: "800",
            background: "#5935a8",
            border: "none",
            color: "#fff",
            opacity: bidDisabled(10) ? 0.5 : 1,
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
            <RetryPlayerImage
              id={lastPurchase.id}
              alt={lastPurchase.calciatore}
              width={80}
              height={80}
              style={{
                width: "80px",
                height: "80px",
                objectFit: "contain",
                borderRadius: "10px",
                background: "#0f172a",
                border: "1px solid #334155",
                marginBottom: "8px",
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
  );
}
