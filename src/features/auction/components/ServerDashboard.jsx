import { useMemo } from "react";
import { getTeamShirtUrl } from "@/utils/teamShirt";
import { completeContextualSwitch } from "../auctionActions";
import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "../context/useAuctionContexts";
import AvailablePlayers from "./AvailablePlayers";
import TeamImportExport from "./TeamImportExport";

const clampPercent = (value, max = 10) =>
  Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));

function TimerRing({ timer, isPaused, stopTimer }) {
  const value = isPaused ? stopTimer : timer;
  const max = isPaused ? 30 : 10;
  const percent = clampPercent(value, max);

  return (
    <div
      className={`server-timer-ring ${isPaused ? "is-stop" : ""}`}
      style={{
        background: isPaused
          ? `conic-gradient(#fb2c82 ${percent}%, #24102b 0)`
          : `conic-gradient(#b33cff ${percent}%, #2563ff 0)`,
      }}
    >
      <div className="server-timer-ring-inner">
        <span>{isPaused ? "STOP" : "TEMPO"}</span>
        <strong>{value}</strong>
        <small>SEC</small>
      </div>
    </div>
  );
}

function ParticipantDot({ participant, active }) {
  return (
    <span
      className={`participant-dot ${active ? "active" : ""}`}
      title={`${participant.nome} · ${participant.crediti} FM`}
    />
  );
}

export default function ServerDashboard() {
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
    storicoOfferte: bidHistory,
    pendingSwitch,
    docRef,
  } = useAuctionSessionContext();

  const {
    ultimoOfferente: lastBidder,
    squadraManualeId: manualTeamId,
    setSquadraManualeId: setManualTeamId,
    prezzoManuale: manualPrice,
    setPrezzoManuale: setManualPrice,
    serverBidderId,
    setServerBidderId,
    offerenteServer: serverBidder,
    cambiaGiocatoreManuale: changePlayer,
    avviaTimerManualmente: startTimer,
    faiOfferta: placeServerBid,
    assegnaGiocatoreManualmente: manualAssign,
  } = useAdminAuctionContext();

  const playerImage = getTeamShirtUrl(player?.squadra);
  const lastPurchaseImage = getTeamShirtUrl(lastPurchase?.squadra);
  const actionsDisabled =
    !player || !isTimerStarted || timer === 0 || isPaused || !!pendingSwitch;

  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => Number(a.id) - Number(b.id)),
    [participants],
  );

  const handleContextualSwitch = async (candidateId) => {
    try {
      await completeContextualSwitch({ docRef, candidateId });
    } catch (error) {
      console.error("Errore completamento taglio contestuale:", error);
      alert(error?.message || "Errore durante il taglio contestuale.");
    }
  };

  return (
    <div className="server-dashboard">
      <section className="server-auction-zone">
        <div className="server-panel server-live-card">
          <div className="server-panel-title">
            <span>📢</span> BANDITORE ASTA LIVE
          </div>

          {pendingSwitch && (
            <div className="server-switch-alert">
              <div>
                <strong>🔄 TAGLIO CONTESTUALE</strong>
                <span>
                  {pendingSwitch.player?.nome} · {pendingSwitch.price} FM · {pendingSwitch.winnerName}
                </span>
              </div>
              <div className="server-switch-options">
                {(pendingSwitch.switchCandidates || []).map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleContextualSwitch(candidate.id)}
                  >
                    {candidate.nome} · {candidate.prezzo} FM
                  </button>
                ))}
              </div>
            </div>
          )}

          {player ? (
            <>
              <div className="server-player-stage">
                <button
                  type="button"
                  className="server-player-arrow"
                  onClick={() => changePlayer("indietro")}
                  aria-label="Giocatore precedente"
                >
                  ‹
                </button>

                <div className="server-player-shirt">
                  {playerImage ? (
                    <img
                      src={playerImage}
                      alt={`Maglia ${player.squadra || ""}`}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span>⚽</span>
                  )}
                </div>

                <div className="server-player-copy">
                  <small>{player.squadra}</small>
                  <h1>{player.nome}</h1>
                  <div className="server-role-stars">
                    <b>{player.ruolo}</b>
                    <span>★★★★★</span>
                  </div>
                  <div className={`server-auction-state ${isPaused ? "paused" : ""}`}>
                    {!isTimerStarted
                      ? "IN ATTESA DI AVVIO"
                      : isPaused
                        ? `STOP DA ${stopCalledBy || "SQUADRA"}`
                        : "ASTA IN CORSO"}
                  </div>
                </div>

                <TimerRing timer={timer} isPaused={isPaused} stopTimer={stopTimer} />

                <button
                  type="button"
                  className="server-player-arrow"
                  onClick={() => changePlayer("avanti")}
                  aria-label="Giocatore successivo"
                >
                  ›
                </button>
              </div>

              {!isTimerStarted && (
                <button type="button" className="server-start-timer" onClick={startTimer}>
                  ▶ AVVIA TIMER ASTA
                </button>
              )}
            </>
          ) : (
            <div className="server-empty-auction">
              <span>⚽</span>
              <strong>Nessun giocatore sul banditore</strong>
              <small>Usa “Chiama” dall'elenco giocatori per iniziare.</small>
            </div>
          )}

          <div className="server-current-bid">
            <span>OFFERTA CORRENTE</span>
            <strong>🪙 {currentBid} FM</strong>
            <small>
              👤 Ultimo offerente: <b>{lastBidder?.nome || "Nessun offerente"}</b>
            </small>
          </div>

          <div className="server-bid-buttons">
            <button type="button" disabled={actionsDisabled} onClick={() => placeServerBid(1)}>
              +1 FM <span>🔨</span>
            </button>
            <button type="button" disabled={actionsDisabled} onClick={() => placeServerBid(5)}>
              +5 FM <span>🚀</span>
            </button>
            <button type="button" disabled={actionsDisabled} onClick={() => placeServerBid(10)}>
              +10 FM <span>👑</span>
            </button>
          </div>

          <div className={`server-stop-banner ${isPaused ? "active" : ""}`}>
            <strong>🛑 {isPaused ? `STOP IN CORSO · ${stopTimer}s` : "STOP"}</strong>
            <span>Gli STOP vengono richiesti dalle squadre partecipanti.</span>
          </div>
        </div>

        <div className="server-mini-grid">
          <div className="server-panel server-bidder-card">
            <div className="server-panel-title compact">🎙️ OFFERTA COME</div>
            <div className="server-bidder-line">
              <span className="server-bidder-avatar">●</span>
              <div>
                <strong>{serverBidder?.nome || "Seleziona squadra"}</strong>
                <small>{serverBidder ? `${serverBidder.crediti} FM disponibili` : ""}</small>
              </div>
            </div>
            <select value={serverBidderId || ""} onChange={(event) => setServerBidderId(event.target.value)}>
              {sortedParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.nome} · {participant.crediti} FM
                </option>
              ))}
            </select>
            <small className="server-help-text">
              I pulsanti +1 / +5 / +10 fanno l'offerta a nome della squadra selezionata.
            </small>
          </div>

          <div className="server-panel server-participants-card">
            <div className="server-panel-title compact">
              👥 PARTECIPANTI ASTA ({participants.length})
            </div>
            <div className="participant-dots">
              {sortedParticipants.map((participant) => (
                <ParticipantDot
                  key={participant.id}
                  participant={participant}
                  active={String(participant.id) === String(lastBidderId)}
                />
              ))}
            </div>
            <div className="participant-summary">
              <span>Ultimo:</span>
              <strong>{lastBidder?.nome || "—"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="server-players-zone">
        <AvailablePlayers />
      </section>

      <section className="server-support-zone">
        <div className="server-panel server-manual-card">
          <div className="server-panel-title compact">🛠️ CORREZIONE / ASSEGNAZIONE MANUALE</div>
          <div className="server-manual-fields">
            <select value={manualTeamId} onChange={(event) => setManualTeamId(event.target.value)}>
              <option value="">Seleziona squadra...</option>
              {sortedParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.nome}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={manualPrice}
              onChange={(event) => setManualPrice(event.target.value)}
              placeholder="Prezzo FM"
            />
          </div>
          <button type="button" className="server-manual-button" onClick={manualAssign}>
            👤 ASSEGNA MANUALMENTE
          </button>
        </div>

        <div className="server-panel server-last-purchase">
          <div className="server-panel-title compact">🏆 ULTIMO ACQUISTO</div>
          {lastPurchase ? (
            <div className="last-purchase-body">
              <div className="last-purchase-shirt">
                {lastPurchaseImage && (
                  <img
                    src={lastPurchaseImage}
                    alt={`Maglia ${lastPurchase.squadra || ""}`}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </div>
              <div>
                <strong>{lastPurchase.calciatore}</strong>
                <small>{lastPurchase.squadra || lastPurchase.ruolo || ""}</small>
                <b>🪙 {lastPurchase.prezzo} FM</b>
                <span>Acquirente: {lastPurchase.vincitoreNome}</span>
              </div>
            </div>
          ) : (
            <div className="server-empty-small">Nessun acquisto registrato.</div>
          )}
        </div>

        <div className="server-panel server-stop-info">
          <div className="server-panel-title compact">🛑 STOP DISPONIBILI</div>
          <strong>{serverBidder?.stopDisponibili ?? 0}/2 STOP</strong>
          <span>
            Squadra selezionata: {serverBidder?.nome || "—"}
          </span>
          <small>Gli STOP si aggiornano automaticamente durante la sessione.</small>
        </div>

        <div className="server-panel server-quick-actions">
          <div className="server-panel-title compact">⚡ IMPORT / EXPORT SQUADRE</div>
          <TeamImportExport />
        </div>
      </section>

      <section className="server-bottom-zone">
        <div className="server-panel server-history-card">
          <div className="server-panel-title compact">📜 STORICO OFFERTE</div>
          <div className="server-table server-history-table">
            <div className="server-table-head">
              <span>ORA</span><span>SQUADRA</span><span>OFFERTA</span>
            </div>
            {(bidHistory || []).length > 0 ? (
              bidHistory.map((bid, index) => (
                <div className="server-table-row" key={`${bid.ora}-${bid.nome}-${index}`}>
                  <span>{bid.ora || "—"}</span>
                  <strong>{bid.nome || "—"}</strong>
                  <b>{bid.importo ?? 0} FM</b>
                </div>
              ))
            ) : (
              <div className="server-empty-small">Nessuna offerta registrata.</div>
            )}
          </div>
        </div>

        <div className="server-panel server-credits-card">
          <div className="server-panel-title compact">💳 CREDITI RESIDUI</div>
          <div className="server-table server-credits-table">
            {sortedParticipants.map((participant) => (
              <div className="server-credit-row" key={participant.id}>
                <span className="credit-dot" />
                <strong>{participant.nome}</strong>
                <b>{participant.crediti} FM</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
