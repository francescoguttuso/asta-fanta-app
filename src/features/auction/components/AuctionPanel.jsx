import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "../context/useAuctionContexts";

export default function AuctionPanel() {
  const {
    giocatoreInAsta: player,
    offertaCorrente: currentBid,
    ultimoOfferenteId: lastBidderId,
    isTimerStarted,
    isPaused,
    stopChiamatoDa: stopCalledBy,
    stopTimer,
    timer,
    partecipanti: participants,
    ultimoAcquisto: lastPurchase,
  } = useAuctionSessionContext();

  const {
    ultimoOfferente: lastBidder,
    squadraManualeId: manualTeamId,
    setSquadraManualeId: onManualTeamChange,
    prezzoManuale: manualPrice,
    setPrezzoManuale: onManualPriceChange,
    cambiaGiocatoreManuale: onPlayerChange,
    avviaTimerManualmente: onStartTimer,
    faiOfferta: onBid,
    assegnaGiocatoreManualmente: onManualAssign,
  } = useAdminAuctionContext();

  // =====================================================
  // COLORI
  // =====================================================

  const COLORS = {
    background: "#07031d",
    card: "#0c0829",
    cardDark: "#090d1b",

    cyan: "#38bdf8",
    blue: "#2563eb",
    green: "#10b981",
    purple: "#6d3fd1",

    gold: "#fbbf24",
    orange: "#f59e0b",
    red: "#ef4444",

    white: "#ffffff",
    muted: "#94a3b8",
    border: "#334155",
  };

  // =====================================================
  // IMMAGINI
  // =====================================================

  const playerImage = player?.id ? `/images/players/${player.id}.png` : null;

  const lastPurchaseImage = lastPurchase?.id
    ? `/images/players/${lastPurchase.id}.png`
    : null;

  // =====================================================
  // DISABILITAZIONE OFFERTE
  // =====================================================

  const actionsDisabled = !isTimerStarted || timer === 0 || isPaused;

  // =====================================================
  // STILE CARD PRINCIPALE
  // =====================================================

  const mainCardStyle = {
    background:
      "linear-gradient(145deg, #10172f 0%, #0b0825 55%, #16052d 100%)",

    border: "1px solid #29395e",

    borderRadius: "20px",

    padding: "20px",

    color: COLORS.white,

    boxShadow: "0 15px 40px rgba(0,0,0,0.35)",

    overflow: "hidden",
  };

  // =====================================================
  // NESSUN GIOCATORE
  // =====================================================

  if (!player) {
    return (
      <div className="card auction-card" style={mainCardStyle}>
        <div
          style={{
            textAlign: "center",
            padding: "35px 20px",
          }}
        >
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "10px",
            }}
          >
            📢
          </div>

          <h2
            style={{
              color: COLORS.cyan,
              margin: 0,
              fontWeight: "900",
            }}
          >
            BANDITORE ASTA LIVE
          </h2>

          <p
            style={{
              color: COLORS.muted,
              marginTop: "10px",
            }}
          >
            Nessun calciatore attualmente sul banditore.
          </p>

          {/* =================================================
              ULTIMO ACQUISTO
          ================================================= */}

          {lastPurchase && (
            <div
              style={{
                marginTop: "25px",

                background: "linear-gradient(145deg, #101827, #080d19)",

                border: `1px solid ${COLORS.border}`,

                borderRadius: "16px",

                padding: "18px",
              }}
            >
              <div
                style={{
                  color: COLORS.cyan,

                  fontSize: "1.15rem",

                  fontWeight: "900",

                  marginBottom: "12px",
                }}
              >
                🏆 ULTIMO ACQUISTO
              </div>

              {lastPurchaseImage && (
                <img
                  src={lastPurchaseImage}
                  alt={lastPurchase.calciatore}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    width: "90px",
                    height: "110px",

                    objectFit: "contain",

                    marginBottom: "8px",

                    filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.45))",
                  }}
                />
              )}

              <div
                style={{
                  color: COLORS.white,

                  fontSize: "1.25rem",

                  fontWeight: "900",
                }}
              >
                {lastPurchase.calciatore}
              </div>

              <div
                style={{
                  color: COLORS.muted,

                  marginTop: "3px",
                }}
              >
                {lastPurchase.ruolo}
              </div>

              <div
                style={{
                  marginTop: "10px",
                }}
              >
                👑 Aggiudicato a{" "}
                <strong
                  style={{
                    color: COLORS.gold,
                  }}
                >
                  {lastPurchase.vincitoreNome}
                </strong>
              </div>

              <div
                style={{
                  marginTop: "5px",
                }}
              >
                🪙 Prezzo{" "}
                <strong
                  style={{
                    color: COLORS.green,
                  }}
                >
                  {lastPurchase.prezzo} FM
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER ASTA
  // =====================================================

  return (
    <div className="card auction-card" style={mainCardStyle}>
      {/* =================================================
          TITOLO
      ================================================= */}

      <div
        style={{
          textAlign: "center",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            color: COLORS.cyan,
            fontSize: "1.6rem",
            fontWeight: "1000",
            letterSpacing: "0.5px",
          }}
        >
          📢 BANDITORE ASTA LIVE
        </div>

        <div
          style={{
            height: "2px",
            marginTop: "9px",
            background:
              "linear-gradient(90deg, transparent, #38bdf8, #7c3aed, transparent)",
          }}
        />
      </div>

      {/* =================================================
          GIOCATORE
      ================================================= */}

      <div
        style={{
          position: "relative",

          background:
            "linear-gradient(135deg, #32106f 0%, #16072f 55%, #09051c 100%)",

          border: "1px solid #6820bd",

          borderRadius: "20px",

          padding: "18px 55px 20px",

          minHeight: "350px",

          display: "flex",

          flexDirection: "column",

          alignItems: "center",

          justifyContent: "center",

          boxShadow: "0 12px 35px rgba(70,20,150,0.28)",
        }}
      >
        {/* =================================================
            FRECCIA SINISTRA
        ================================================= */}

        <button
          type="button"
          onClick={() => onPlayerChange("indietro")}
          style={{
            position: "absolute",

            left: "12px",

            top: "50%",

            transform: "translateY(-50%)",

            border: "none",

            background: "transparent",

            color: COLORS.white,

            fontSize: "2.3rem",

            cursor: "pointer",

            padding: "10px",

            zIndex: 5,
          }}
        >
          ◀
        </button>

        {/* =================================================
            CAMPIONCINO CENTRALE
        ================================================= */}

        <div
          style={{
            width: "200px",

            height: "225px",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            marginBottom: "0px",
          }}
        >
          {playerImage ? (
            <img
              src={playerImage}
              alt={player.nome}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                width: "100%",

                height: "100%",

                objectFit: "contain",

                filter: "drop-shadow(0 14px 20px rgba(0,0,0,0.55))",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: "5rem",
              }}
            >
              ⚽
            </div>
          )}
        </div>

        {/* =================================================
            SQUADRA
        ================================================= */}

        <div
          style={{
            color: COLORS.muted,

            fontSize: "1rem",

            fontWeight: "800",

            marginBottom: "2px",
          }}
        >
          ⚽ {player.squadra}
        </div>

        {/* =================================================
            NOME GIOCATORE
        ================================================= */}

        <div
          style={{
            color: COLORS.white,

            fontSize: "2.3rem",

            lineHeight: "1",

            fontWeight: "1000",

            textAlign: "center",

            textShadow: "0 3px 15px rgba(0,0,0,0.55)",

            marginTop: "2px",
          }}
        >
          {player.nome}
        </div>

        {/* =================================================
            RUOLO + STELLE
        ================================================= */}

        <div
          style={{
            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            gap: "15px",

            marginTop: "10px",
          }}
        >
          <span
            style={{
              background: COLORS.green,

              color: COLORS.white,

              padding: "5px 16px",

              borderRadius: "999px",

              fontWeight: "1000",

              fontSize: "1rem",

              boxShadow: "0 4px 12px rgba(16,185,129,0.25)",
            }}
          >
            {player.ruolo}
          </span>

          <span
            style={{
              color: COLORS.gold,

              fontSize: "1.25rem",

              letterSpacing: "3px",

              textShadow: "0 0 8px rgba(251,191,36,0.35)",
            }}
          >
            ★★★★★
          </span>
        </div>

        {/* =================================================
            FRECCIA DESTRA
        ================================================= */}

        <button
          type="button"
          onClick={() => onPlayerChange("avanti")}
          style={{
            position: "absolute",

            right: "12px",

            top: "50%",

            transform: "translateY(-50%)",

            border: "none",

            background: "transparent",

            color: COLORS.white,

            fontSize: "2.3rem",

            cursor: "pointer",

            padding: "10px",

            zIndex: 5,
          }}
        >
          ▶
        </button>
      </div>

      {/* =================================================
          TIMER
      ================================================= */}

      <div
        style={{
          marginTop: "15px",

          background: "linear-gradient(145deg, #10172c, #090e1c)",

          border: "1px solid #293858",

          borderRadius: "16px",

          padding: "14px 20px",

          display: "flex",

          alignItems: "center",

          justifyContent: "center",

          gap: "14px",
        }}
      >
        {/* CLESSIDRA */}

        <div
          style={{
            fontSize: "2.6rem",

            lineHeight: "1",

            display: "inline-block",

            animation:
              isTimerStarted && !isPaused
                ? "auctionHourglass 3s linear infinite"
                : "none",
          }}
        >
          ⏳
        </div>

        {/* TIMER */}

        <div
          style={{
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: COLORS.cyan,

              fontSize: "2.2rem",

              lineHeight: "1",

              fontWeight: "1000",
            }}
          >
            {timer}s
          </div>

          {!isTimerStarted ? (
            <div
              style={{
                color: COLORS.gold,

                fontWeight: "900",

                marginTop: "5px",
              }}
            >
              ⏳ IN ATTESA DI AVVIO
            </div>
          ) : isPaused ? (
            <div
              style={{
                color: COLORS.red,

                fontWeight: "900",

                marginTop: "5px",
              }}
            >
              🛑 STOP RICHIESTO DA <strong>{stopCalledBy}</strong>
              <div
                style={{
                  color: COLORS.gold,

                  marginTop: "3px",
                }}
              >
                ⏱️ Ripresa tra {stopTimer}s
              </div>
            </div>
          ) : (
            <div
              style={{
                color: COLORS.muted,

                fontWeight: "700",

                fontSize: "0.85rem",
              }}
            >
              TIMER ASTA ATTIVO
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          AVVIA TIMER
      ================================================= */}

      {!isTimerStarted && (
        <button
          type="button"
          onClick={onStartTimer}
          style={{
            width: "100%",

            marginTop: "10px",

            padding: "13px",

            borderRadius: "12px",

            border: "1px solid #1597d0",

            background: "linear-gradient(135deg, #0284c7, #2563eb)",

            color: COLORS.white,

            fontWeight: "1000",

            fontSize: "1.05rem",

            cursor: "pointer",

            boxShadow: "0 5px 18px rgba(37,99,235,0.25)",
          }}
        >
          ▶️ AVVIA TIMER ASTA
        </button>
      )}

      {/* =================================================
          OFFERTA CORRENTE
      ================================================= */}

      <div
        style={{
          marginTop: "14px",

          background: "linear-gradient(145deg, #101827, #080d19)",

          border: "1px solid #334155",

          borderRadius: "16px",

          padding: "16px",

          textAlign: "center",
        }}
      >
        <div
          style={{
            color: COLORS.muted,

            fontSize: "0.85rem",

            textTransform: "uppercase",

            letterSpacing: "1px",
          }}
        >
          OFFERTA CORRENTE
        </div>

        <div
          style={{
            color: COLORS.green,

            fontSize: "2.6rem",

            fontWeight: "1000",

            lineHeight: "1.1",

            marginTop: "4px",
          }}
        >
          🪙 {currentBid} FM
        </div>

        <div
          style={{
            marginTop: "8px",

            color: COLORS.gold,

            fontWeight: "900",

            fontSize: "1rem",
          }}
        >
          👑 {lastBidder ? lastBidder.nome : "Nessun offerente"}
        </div>
      </div>

      {/* =================================================
          PULSANTI OFFERTE
      ================================================= */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",

          gap: "10px",

          marginTop: "13px",
        }}
      >
        {/* +1 FM */}

        <button
          type="button"
          onClick={() => onBid(1)}
          disabled={actionsDisabled}
          style={{
            border: "none",

            borderRadius: "12px",

            padding: "13px 8px",

            color: COLORS.white,

            fontWeight: "1000",

            fontSize: "1.05rem",

            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",

            boxShadow: "0 6px 18px rgba(37,99,235,0.25)",

            opacity: actionsDisabled ? 0.45 : 1,

            cursor: actionsDisabled ? "not-allowed" : "pointer",
          }}
        >
          +1 FM
          <div
            style={{
              fontSize: "0.9rem",

              marginTop: "3px",
            }}
          >
            🔨
          </div>
        </button>

        {/* +5 FM */}

        <button
          type="button"
          onClick={() => onBid(5)}
          disabled={actionsDisabled}
          style={{
            border: "none",

            borderRadius: "12px",

            padding: "13px 8px",

            color: COLORS.white,

            fontWeight: "1000",

            fontSize: "1.05rem",

            background: "linear-gradient(135deg, #059669, #047857)",

            boxShadow: "0 6px 18px rgba(16,185,129,0.25)",

            opacity: actionsDisabled ? 0.45 : 1,

            cursor: actionsDisabled ? "not-allowed" : "pointer",
          }}
        >
          +5 FM
          <div
            style={{
              fontSize: "0.9rem",

              marginTop: "3px",
            }}
          >
            🚀
          </div>
        </button>

        {/* +10 FM */}

        <button
          type="button"
          onClick={() => onBid(10)}
          disabled={actionsDisabled}
          style={{
            border: "none",

            borderRadius: "12px",

            padding: "13px 8px",

            color: COLORS.white,

            fontWeight: "1000",

            fontSize: "1.05rem",

            background: "linear-gradient(135deg, #6d3fd1, #4c1d95)",

            boxShadow: "0 6px 18px rgba(109,63,209,0.3)",

            opacity: actionsDisabled ? 0.45 : 1,

            cursor: actionsDisabled ? "not-allowed" : "pointer",
          }}
        >
          +10 FM
          <div
            style={{
              fontSize: "0.9rem",

              marginTop: "3px",
            }}
          >
            💥
          </div>
        </button>
      </div>

      {/* =================================================
          STOP
      ================================================= */}

      <div
        style={{
          marginTop: "13px",

          background: "linear-gradient(135deg, #9a6b20, #79551c)",

          border: "1px solid #c08a28",

          borderRadius: "12px",

          padding: "11px",

          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#111827",

            fontWeight: "1000",

            fontSize: "0.95rem",
          }}
        >
          🛑 STOP
        </div>

        <div
          style={{
            color: "#111827",

            fontWeight: "800",

            fontSize: "0.8rem",

            marginTop: "3px",
          }}
        >
          Gli STOP vengono richiesti dalle squadre partecipanti.
        </div>
      </div>

      {/* =================================================
          ASSEGNAZIONE MANUALE
      ================================================= */}

      <div
        style={{
          marginTop: "18px",

          paddingTop: "16px",

          borderTop: "1px dashed #334155",
        }}
      >
        <div
          style={{
            color: COLORS.gold,

            fontWeight: "900",

            fontSize: "0.9rem",

            marginBottom: "10px",
          }}
        >
          🔧 CORREZIONE / ASSEGNAZIONE MANUALE
        </div>

        <div
          style={{
            display: "flex",

            gap: "8px",

            marginBottom: "8px",
          }}
        >
          {/* SQUADRA */}

          <select
            value={manualTeamId}
            onChange={(event) => onManualTeamChange(event.target.value)}
            style={{
              flex: 2,

              minWidth: 0,

              padding: "10px",

              borderRadius: "9px",

              background: "#0b1020",

              color: COLORS.white,

              border: "1px solid #334155",
            }}
          >
            <option value="">Seleziona Squadra...</option>

            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.nome} ({participant.crediti} FM)
              </option>
            ))}
          </select>

          {/* PREZZO */}

          <input
            type="number"
            placeholder="Prezzo FM"
            value={manualPrice}
            onChange={(event) => onManualPriceChange(event.target.value)}
            style={{
              flex: 1,

              minWidth: 0,

              padding: "10px",

              borderRadius: "9px",

              background: "#0b1020",

              color: COLORS.white,

              border: "1px solid #334155",
            }}
          />
        </div>

        <button
          type="button"
          onClick={onManualAssign}
          style={{
            width: "100%",

            padding: "11px",

            borderRadius: "9px",

            border: "1px solid #d97706",

            background: "linear-gradient(135deg, #b45309, #92400e)",

            color: COLORS.white,

            fontWeight: "900",

            cursor: "pointer",
          }}
        >
          🔧 FORZA ASSEGNAZIONE MANUALE
        </button>
      </div>

      {/* =================================================
          ANIMAZIONE CLESSIDRA
      ================================================= */}

      <style>
        {`
          @keyframes auctionHourglass {
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

          .auction-card button:not(:disabled) {
            transition:
              transform 0.15s ease,
              filter 0.15s ease;
          }

          .auction-card button:not(:disabled):hover {
            filter: brightness(1.12);
          }

          .auction-card button:not(:disabled):active {
            transform: scale(0.97);
          }

          @media (max-width: 700px) {
            .auction-card {
              padding: 12px !important;
            }

            .auction-card h2 {
              font-size: 1.3rem !important;
            }
          }
        `}
      </style>
    </div>
  );
}
