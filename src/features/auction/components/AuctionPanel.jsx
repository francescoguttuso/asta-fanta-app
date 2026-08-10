import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "../context/useAuctionContexts";

export default function AuctionPanel() {
  const {
    giocatoreInAsta: player,
    giocatori,
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
    assegnaGiocatore: onAssign,
    assegnaGiocatoreManualmente: onManualAssign,
  } = useAdminAuctionContext();

  /*
   * =====================================================
   * RECUPERO ID CAMPIONCINO
   * =====================================================
   *
   * Normalmente player.id è già presente.
   *
   * Se però la sessione Firestore contiene un vecchio
   * giocatore senza id, cerchiamo lo stesso giocatore
   * nella lista completa "giocatori".
   */

  const playerImageId =
    player?.id ??
    giocatori?.find(
      (giocatore) =>
        giocatore.nome === player?.nome &&
        giocatore.squadra === player?.squadra,
    )?.id;

  return (
    <div className="card auction-card">
      <h2>📢 Banditore Asta Live</h2>

      {player ? (
        <div>
          {/* ========================================= */}
          {/* CAMPIONCINO GIOCATORE */}
          {/* ========================================= */}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              margin: "10px 0 15px",
              minHeight: "190px",
            }}
          >
            {playerImageId ? (
              <img
                src={`/images/players/${playerImageId}.png`}
                alt={player.nome}
                style={{
                  width: "150px",
                  height: "190px",
                  objectFit: "contain",
                  display: "block",
                }}
                onError={(event) => {
                  console.error(
                    "Errore caricamento campioncino:",
                    event.currentTarget.src,
                  );

                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                }}
              >
                Campioncino non disponibile
              </div>
            )}
          </div>

          {/* ========================================= */}
          {/* NAVIGAZIONE GIOCATORE */}
          {/* ========================================= */}

          <div className="auction-player-nav">
            <button
              onClick={() => onPlayerChange("indietro")}
              className="btn btn-grey"
              style={{
                padding: "5px 12px",
                fontSize: "1.2rem",
              }}
            >
              ◀
            </button>

            <h3
              style={{
                color: "#38bdf8",
                margin: 0,
                textAlign: "center",
              }}
            >
              🏃 {player.nome} ({player.squadra}) - [{player.ruolo}]
            </h3>

            <button
              onClick={() => onPlayerChange("avanti")}
              className="btn btn-grey"
              style={{
                padding: "5px 12px",
                fontSize: "1.2rem",
              }}
            >
              ▶
            </button>
          </div>

          {/* ========================================= */}
          {/* OFFERTE / TIMER */}
          {/* ========================================= */}

          <div
            className="alert-box"
            style={{
              textAlign: "center",
              margin: "15px 0",
            }}
          >
            <h4
              style={{
                fontSize: "1.6rem",
                margin: 0,
              }}
            >
              Offerta: <span style={{ color: "#10b981" }}>{currentBid} FM</span>
            </h4>

            <p
              style={{
                marginTop: "8px",
                fontWeight: "bold",
                color: "#fbbf24",
                fontSize: "1.1rem",
              }}
            >
              🙋 Miglior Offerente:{" "}
              {lastBidder ? lastBidder.nome : "In attesa di rilanci"}
            </p>

            <div
              style={{
                marginTop: "10px",
                fontSize: "1.2rem",
                fontWeight: "bold",
              }}
            >
              {!isTimerStarted ? (
                <span style={{ color: "#fbbf24" }}>
                  ⏳ IN ATTESA DI AVVIO SERVER
                </span>
              ) : isPaused ? (
                <div style={{ color: "#f87171" }}>
                  🛑 PAUSA STOP RICHIESTA DA: <strong>{stopCalledBy}</strong>
                  <div
                    style={{
                      fontSize: "1.4rem",
                      marginTop: "5px",
                    }}
                  >
                    ⏱️ Ripresa Asta tra: {stopTimer}s
                  </div>
                </div>
              ) : (
                <span>⏱️ Timer Asta: {timer}s</span>
              )}
            </div>
          </div>

          {/* ========================================= */}
          {/* AVVIO TIMER */}
          {/* ========================================= */}

          {!isTimerStarted && (
            <button
              onClick={onStartTimer}
              className="btn btn-blue"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "1.1rem",
                marginBottom: "15px",
                fontWeight: "bold",
              }}
            >
              ▶️ AVVIA TIMER ASTA
            </button>
          )}

          {/* ========================================= */}
          {/* OFFERTE */}
          {/* ========================================= */}

          <div className="bid-actions">
            <button
              onClick={() => onBid(1)}
              disabled={!isTimerStarted || timer === 0 || isPaused}
              className="btn"
            >
              +1 FM 🔨
            </button>

            <button
              onClick={() => onBid(5)}
              disabled={!isTimerStarted || timer === 0 || isPaused}
              className="btn btn-green"
            >
              +5 FM 🚀
            </button>
          </div>

          {/* ========================================= */}
          {/* ASSEGNAZIONE */}
          {/* ========================================= */}

          <button
            onClick={onAssign}
            disabled={!lastBidderId}
            className="btn btn-green"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "1.1rem",
              marginBottom: "15px",
            }}
          >
            🏆 Assegna a {lastBidder ? lastBidder.nome : "..."} e Passa al
            Prossimo ⏩
          </button>

          {/* ========================================= */}
          {/* ASSEGNAZIONE MANUALE */}
          {/* ========================================= */}

          <div
            style={{
              borderTop: "1px dashed #475569",
              paddingTop: "12px",
              marginTop: "10px",
            }}
          >
            <p
              style={{
                fontSize: "0.9rem",
                color: "#fbbf24",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              ⚠️ Correzione / Assegnazione Manuale d'Emergenza:
            </p>

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <select
                value={manualTeamId}
                onChange={(event) => onManualTeamChange(event.target.value)}
                style={{
                  flex: 2,
                  padding: "8px",
                  borderRadius: "4px",
                  background: "#1e293b",
                  color: "#fff",
                  border: "1px solid #475569",
                }}
              >
                <option value="">Seleziona Squadra...</option>

                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.nome} ({participant.crediti} FM)
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Prezzo FM"
                value={manualPrice}
                onChange={(event) => onManualPriceChange(event.target.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "4px",
                  background: "#1e293b",
                  color: "#fff",
                  border: "1px solid #475569",
                }}
              />
            </div>

            <button
              onClick={onManualAssign}
              className="btn btn-orange"
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "0.95rem",
              }}
            >
              🔧 Forza Assegnazione Manuale
            </button>
          </div>
        </div>
      ) : (
        /* =========================================== */
        /* NESSUN GIOCATORE IN ASTA */
        /* =========================================== */

        <div
          className="alert-box"
          style={{
            textAlign: "center",
            padding: "20px",
          }}
        >
          <p style={{ color: "#94a3b8" }}>
            Nessun calciatore attualmente sul banditore.
          </p>

          {lastPurchase && (
            <div
              style={{
                marginTop: "15px",
                borderTop: "2px dashed #334155",
                paddingTop: "15px",
              }}
            >
              <span
                style={{
                  fontSize: "1.2rem",
                  color: "#38bdf8",
                }}
              >
                🎉 <strong>ULTIMO COLPO ASSEGNATO!</strong>
              </span>

              <h3
                style={{
                  color: "#fbbf24",
                  margin: "8px 0",
                }}
              >
                {lastPurchase.calciatore} ({lastPurchase.ruolo})
              </h3>

              <p
                style={{
                  fontSize: "1.1rem",
                }}
              >
                Vinto da{" "}
                <strong
                  style={{
                    color: "#38bdf8",
                  }}
                >
                  {lastPurchase.vincitoreNome}
                </strong>{" "}
                per{" "}
                <strong
                  style={{
                    color: "#10b981",
                  }}
                >
                  {lastPurchase.prezzo} FM
                </strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
