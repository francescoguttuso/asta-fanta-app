import React, { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { ROLE_LIMITS } from "./data/auctionDefaults";
import {
  AUCTION_DURATION_MS,
  getRemainingMilliseconds,
} from "./timerUtils";

export default function MobileController({
  partecipanti,
  giocatoreInAsta,
  offertaCorrente,
  timer,
  isTimerStarted,
  isPaused,
  stopChiamatoDa,
  storicoOfferte,
  stopTimer,
  docRef,
}) {
  const [mioId, setMioId] = useState("");

  const faiOffertaMobile = async (incremento = 1) => {
    if (!mioId) return alert("Seleziona prima la tua squadra!");
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const utenteCorrente = partecipanti.find((p) => p.id === parseInt(mioId));
    if (utenteCorrente) {
      const ruoloCorrente = giocatoreInAsta.ruolo;
      const quantitaInRosa = utenteCorrente.rosa.filter(
        (g) => g.ruolo === ruoloCorrente,
      ).length;

      if (quantitaInRosa >= (ROLE_LIMITS[ruoloCorrente] || 0)) {
        alert(
          `⛔ Impossibile rilanciare: hai già completato il reparto dei ${ruoloCorrente} (${ROLE_LIMITS[ruoloCorrente]}/${ROLE_LIMITS[ruoloCorrente]})!`,
        );
        return;
      }
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        const sessioneCloud = sfDoc.data();
        if (sessioneCloud.isPaused || !sessioneCloud.isTimerStarted) return;

        const prezzoCloud = sessioneCloud.offertaCorrente || 0;
        const vecchioStorico = sessioneCloud.storicoOfferte || [];
        const nuovoPrezzo = prezzoCloud + incremento;
        const nomeSquadra =
          partecipanti.find((p) => p.id === parseInt(mioId))?.nome || "Squadra";

        const nuovaEntrata = {
          nome: nomeSquadra,
          importo: nuovoPrezzo,
          ora: new Date().toLocaleTimeString(),
        };
        const nuovoStorico = [nuovaEntrata, ...vecchioStorico].slice(0, 5);

        transaction.update(docRef, {
          offertaCorrente: nuovoPrezzo,
          ultimoOfferenteId: mioId,
          timer: 10,
          timerEndsAt: Date.now() + AUCTION_DURATION_MS,
          isPaused: false,
          stopChiamatoDa: null,
          stopIniziatoAt: null,
          storicoOfferte: nuovoStorico,
        });
      });
    } catch (err) {
      console.error("Errore rilancio mobile: ", err);
    }
  };

  const fermaAstaMobile = async () => {
    if (!mioId) return alert("Seleziona prima la tua squadra!");
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const utenteCorrente = partecipanti.find((p) => p.id === parseInt(mioId));
    if (!utenteCorrente) return;

    const stopRimanenti = utenteCorrente.stopDisponibili ?? 2;
    if (stopRimanenti <= 0) {
      alert("⛔ Hai esaurito i 2 stop a tua disposizione!");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        const sessioneCloud = sfDoc.data();
        if (sessioneCloud.isPaused || !sessioneCloud.isTimerStarted) return;

        const partecipantiCloud = sessioneCloud.partecipanti || partecipanti;
        const timerRimanenteMs = sessioneCloud.timerEndsAt
          ? getRemainingMilliseconds(sessioneCloud.timerEndsAt)
          : Math.max(0, (sessioneCloud.timer ?? timer) * 1000);

        if (timerRimanenteMs === 0) return;

        const partecipantiAggiornati = partecipantiCloud.map((p) => {
          if (p.id === parseInt(mioId)) {
            return {
              ...p,
              stopDisponibili: Math.max(0, (p.stopDisponibili ?? 2) - 1),
            };
          }
          return p;
        });

        transaction.update(docRef, {
          isPaused: true,
          stopChiamatoDa: utenteCorrente.nome,
          stopIniziatoAt: Date.now(),
          timerRimanenteMs,
          timer: Math.ceil(timerRimanenteMs / 1000),
          timerEndsAt: null,
          partecipanti: partecipantiAggiornati,
        });
      });
    } catch (err) {
      console.error("Errore attivazione STOP: ", err);
    }
  };

  const utenteSelezionato = partecipanti.find((p) => p.id === parseInt(mioId));
  const stopRimanentiSelezionato = utenteSelezionato
    ? utenteSelezionato.stopDisponibili ?? 2
    : 2;

  return (
    <div className="container mobile-container">
      <h2 style={{ textAlign: "center", fontSize: "1.4rem" }}>
        📱 Controller Fanta Squadra
      </h2>

      <div className="card" style={{ marginBottom: "15px" }}>
        <label
          style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}
        >
          Seleziona la tua Squadra:
        </label>
        <select
          value={mioId}
          onChange={(e) => setMioId(e.target.value)}
          className="input-field"
          style={{ width: "100%", padding: "10px", fontSize: "1rem" }}
        >
          <option value="">-- Scegli Squadra --</option>
          {partecipanti.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.crediti} FM) - 🛑 {p.stopDisponibili ?? 2}/2
            </option>
          ))}
        </select>
      </div>

      {utenteSelezionato && (
        <div
          className="card"
          style={{ marginBottom: "15px", background: "#1e293b" }}
        >
          <h4 style={{ margin: "0 0 5px 0", color: "#38bdf8" }}>
            I tuoi Crediti: {utenteSelezionato.crediti} FM | Stop:{" "}
            {stopRimanentiSelezionato}/2
          </h4>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
            Rosa ({utenteSelezionato.rosa.length}):{" "}
            {utenteSelezionato.rosa
              .map((g) => `${g.nome} (${g.prezzo}FM)`)
              .join(", ") || "Nessun acquisto"}
          </p>
        </div>
      )}

      {giocatoreInAsta ? (
        <div className="card" style={{ textAlign: "center" }}>
          <h3 style={{ color: "#38bdf8", margin: "5px 0" }}>
            {giocatoreInAsta.nome} ({giocatoreInAsta.squadra}) - [
            {giocatoreInAsta.ruolo}]
          </h3>

          <div className="alert-box" style={{ margin: "10px 0" }}>
            <h4 style={{ fontSize: "1.4rem", margin: 0 }}>
              Offerta:{" "}
              <span style={{ color: "#10b981" }}>{offertaCorrente} FM</span>
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
                  🛑 STOP DA: <strong>{stopChiamatoDa}</strong>
                  <div style={{ fontSize: "1.2rem", marginTop: "3px" }}>
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
              onClick={() => faiOffertaMobile(1)}
              disabled={!mioId || !isTimerStarted || timer === 0 || isPaused}
              className="btn"
              style={{ flex: 1, padding: "12px", fontSize: "1.1rem" }}
            >
              +1 FM 🔨
            </button>
            <button
              onClick={() => faiOffertaMobile(5)}
              disabled={!mioId || !isTimerStarted || timer === 0 || isPaused}
              className="btn btn-green"
              style={{ flex: 1, padding: "12px", fontSize: "1.1rem" }}
            >
              +5 FM 🚀
            </button>
          </div>

          <button
            onClick={fermaAstaMobile}
            disabled={
              !mioId ||
              !isTimerStarted ||
              timer === 0 ||
              isPaused ||
              stopRimanentiSelezionato <= 0
            }
            className="btn btn-orange"
            style={{ width: "100%", padding: "12px", fontSize: "1.1rem" }}
          >
            🛑 CHIEDI STOP (30s) - Rimasti: {stopRimanentiSelezionato}/2
          </button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "20px" }}>
          <p style={{ color: "#94a3b8" }}>Nessun calciatore sul banditore.</p>
        </div>
      )}

      {/* Storico Offerte */}
      <div className="card" style={{ marginTop: "15px" }}>
        <h4 style={{ margin: "0 0 10px 0" }}>📜 Ultime Offerte</h4>
        {storicoOfferte.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            Nessuna offerta registrata.
          </p>
        ) : (
          storicoOfferte.map((off, index) => (
            <div
              key={index}
              style={{
                fontSize: "0.85rem",
                marginBottom: "4px",
                color: "#cbd5e1",
              }}
            >
              <strong>{off.nome}</strong>: {off.importo} FM{" "}
              <span style={{ color: "#64748b" }}>({off.ora})</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
