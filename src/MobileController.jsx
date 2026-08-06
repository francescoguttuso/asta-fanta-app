import React, { useState, useEffect } from "react";
import { runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig";

const LIMITI_RUOLI = { P: 3, D: 8, C: 8, A: 6 };

export default function MobileController({
  partecipanti,
  giocatoreInAsta,
  offertaCorrente,
  timer,
  isTimerStarted,
  isPaused,
  stopChiamatoDa,
  stopIniziatoAt,
  ultimoAcquisto,
  storicoOfferte,
  docRef,
}) {
  const [mioId, setMioId] = useState("");
  const [stopTimerVisivoClient, setStopTimerVisivoClient] = useState(30);

  useEffect(() => {
    let interval = null;
    if (isPaused && stopIniziatoAt) {
      interval = setInterval(() => {
        const trascorsi = Math.floor((Date.now() - stopIniziatoAt) / 1000);
        const rimasti = Math.max(0, 30 - trascorsi);
        setStopTimerVisivoClient(rimasti);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPaused, stopIniziatoAt]);

  const faiOffertaMobile = async (incremento = 1) => {
    if (!mioId) return alert("Seleziona prima la tua squadra!");
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const utenteCorrente = partecipanti.find((p) => p.id === parseInt(mioId));
    if (utenteCorrente) {
      const ruoloCorrente = giocatoreInAsta.ruolo;
      const quantitaInRosa = utenteCorrente.rosa.filter(
        (g) => g.ruolo === ruoloCorrente,
      ).length;

      if (quantitaInRosa >= (LIMITI_RUOLI[ruoloCorrente] || 0)) {
        alert(
          `⛔ Impossibile rilanciare: hai già completato il reparto dei ${ruoloCorrente} (${LIMITI_RUOLI[ruoloCorrente]}/${LIMITI_RUOLI[ruoloCorrente]})!`,
        );
        return;
      }
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        const prezzoCloud = sfDoc.data().offertaCorrente || 0;
        const vecchioStorico = sfDoc.data().storicoOfferte || [];
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
          isPaused: false,        // 👈 Sblocca lo stop automaticamente
          stopChiamatoDa: null,   // 👈 Resetta chi aveva chiamato lo stop
          stopIniziatoAt: null,   // 👈 Resetta il tempo dello stop
          storicoOfferte: nuovoStorico,
        });
      });
    } catch (err) {
      console.error("Errore rilancio mobile: ", err);
    }
  };

  const fermaAstaMobile = async () => {
    if (!mioId) return alert("Seleziona prima la tua squadra!");
    if (!giocatoreInAsta || !isTimerStarted || isPaused) return;

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

        const partecipantiCloud = sfDoc.data().partecipanti || partecipanti;
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
    <div className="container" style={{ padding: "10px" }}>
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
                    ⏱️ Ripresa tra: {stopTimerVisivoClient}s
                  </div>
                </div>
              ) : (
                <span>⏱️ Timer: {timer}s</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
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