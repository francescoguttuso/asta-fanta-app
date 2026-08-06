import React, { useState, useEffect } from "react";
import { runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig";

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
  storicoOfferte = [],
  docRef,
}) {
  const [selectedSquadraId, setSelectedSquadraId] = useState("");
  const [stopTimerVisivo, setStopTimerVisivo] = useState(30);

  const miaSquadra = partecipanti.find(
    (p) => p.id === parseInt(selectedSquadraId),
  );

  // Countdown visivo di 30 secondi sincronizzato per TUTTI i dispositivi Mobile
  useEffect(() => {
    let interval = null;
    if (isPaused && stopIniziatoAt) {
      interval = setInterval(() => {
        const trascorsi = Math.floor((Date.now() - stopIniziatoAt) / 1000);
        const rimasti = Math.max(0, 30 - trascorsi);
        setStopTimerVisivo(rimasti);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, stopIniziatoAt]);

  const rilancia = async (incremento = 1) => {
    if (!selectedSquadraId) return alert("Seleziona prima la tua squadra!");
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const nuovoPrezzo = offertaCorrente + incremento;
    if (miaSquadra && miaSquadra.crediti < nuovoPrezzo) {
      return alert("Crediti insufficienti!");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        const prezzoCloud = sfDoc.data().offertaCorrente || 0;
        const vecchioStorico = sfDoc.data().storicoOfferte || [];
        const rilancioCloud = prezzoCloud + incremento;

        const nuovaEntrata = {
          nome: miaSquadra.nome,
          importo: rilancioCloud,
          ora: new Date().toLocaleTimeString(),
        };
        const nuovoStorico = [nuovaEntrata, ...vecchioStorico].slice(0, 5);

        transaction.update(docRef, {
          offertaCorrente: rilancioCloud,
          ultimoOfferenteId: selectedSquadraId,
          timer: 10, // Reset a 10s solo sul rilancio
          isPaused: false,
          stopChiamatoDa: null,
          stopIniziatoAt: null,
          storicoOfferte: nuovoStorico,
        });
      });
    } catch (err) {
      console.error("Errore durante il rilancio mobile: ", err);
    }
  };

  const chiamaStop = async () => {
    if (!selectedSquadraId) return alert("Seleziona prima la tua squadra!");
    if (isPaused) return;

    // Regola: STOP chiamabile solo sopra i 30 FM
    if (offertaCorrente <= 30) {
      return alert("Puoi chiamare lo STOP solo per offerte superiori a 30 FM!");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        transaction.update(docRef, {
          isPaused: true,
          stopChiamatoDa: miaSquadra.nome,
          stopIniziatoAt: Date.now(), // Timestamp in ms per sincronizzare il timer di STOP
        });
      });
    } catch (err) {
      console.error("Errore durante la chiamata dello STOP: ", err);
    }
  };

  return (
    <div
      className="container"
      style={{ padding: "15px", maxWidth: "500px", margin: "0 auto" }}
    >
      <h2 style={{ textAlign: "center", color: "#38bdf8" }}>
        📱 FantaAsta Mobile
      </h2>

      {/* SELEZIONE SQUADRA */}
      <div className="card" style={{ marginBottom: "15px" }}>
        <label
          style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}
        >
          Chi sei?
        </label>
        <select
          value={selectedSquadraId}
          onChange={(e) => setSelectedSquadraId(e.target.value)}
          className="input-field"
          style={{ width: "100%", padding: "10px", fontSize: "1rem" }}
        >
          <option value="">-- Seleziona la tua Squadra --</option>
          {partecipanti.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.crediti} FM)
            </option>
          ))}
        </select>

        {miaSquadra && (
          <div
            style={{
              marginTop: "10px",
              fontSize: "0.9rem",
              color: "#10b981",
              fontWeight: "bold",
            }}
          >
            Crediti Residui: {miaSquadra.crediti} FM | Giocatori in rosa:{" "}
            {miaSquadra.rosa.length}
          </div>
        )}
      </div>

      {/* BANDITORE LIVE MOBILE */}
      <div className="card">
        <h3>📢 Calciatore in Asta</h3>
        {giocatoreInAsta ? (
          <div>
            <h2 style={{ color: "#38bdf8", margin: "10px 0" }}>
              {giocatoreInAsta.nome} ({giocatoreInAsta.squadra})
            </h2>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: "bold",
                color: "#94a3b8",
              }}
            >
              Ruolo: [{giocatoreInAsta.ruolo}]
            </div>

            <div
              className="alert-box"
              style={{ textAlign: "center", margin: "15px 0" }}
            >
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: "bold",
                  color: "#10b981",
                }}
              >
                {offertaCorrente} FM
              </div>

              <div style={{ marginTop: "10px", fontSize: "1.1rem" }}>
                {!isTimerStarted ? (
                  <span style={{ color: "#fbbf24", fontWeight: "bold" }}>
                    ⏳ ATTENDI AVVIO SERVER
                  </span>
                ) : isPaused ? (
                  <div style={{ color: "#f87171", fontWeight: "bold" }}>
                    🛑 PAUSA STOP: {stopChiamatoDa}
                    <div style={{ fontSize: "1.3rem", marginTop: "5px" }}>
                      ⏱️ Ripresa tra: {stopTimerVisivo}s
                    </div>
                  </div>
                ) : (
                  <span>⏱️ Tempo: {timer}s</span>
                )}
              </div>
            </div>

            {/* PULSANTI RILANCIO */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <button
                onClick={() => rilancia(1)}
                disabled={
                  !isTimerStarted ||
                  timer === 0 ||
                  isPaused ||
                  !selectedSquadraId
                }
                className="btn btn-green"
                style={{ padding: "15px", fontSize: "1.2rem" }}
              >
                +1 FM 🔨
              </button>
              <button
                onClick={() => rilancia(5)}
                disabled={
                  !isTimerStarted ||
                  timer === 0 ||
                  isPaused ||
                  !selectedSquadraId
                }
                className="btn"
                style={{ padding: "15px", fontSize: "1.2rem" }}
              >
                +5 FM 🚀
              </button>
            </div>

            <button
              onClick={chiamaStop}
              disabled={
                isPaused ||
                !isTimerStarted ||
                timer === 0 ||
                !selectedSquadraId ||
                offertaCorrente <= 30
              }
              className="btn btn-orange"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "1.1rem",
                fontWeight: "bold",
                opacity: offertaCorrente <= 30 ? 0.5 : 1,
              }}
            >
              🛑 CHIAMA STOP (Pausa 30s)
            </button>
            {offertaCorrente <= 30 && (
              <small
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: "5px",
                  color: "#94a3b8",
                }}
              >
                ⚠️ Lo STOP è disponibile solo per offerte superiori a 30 FM
              </small>
            )}

            {/* STORICO ULTIME 5 OFFERTE MOBILE */}
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#0f172a",
                borderRadius: "6px",
                borderLeft: "4px solid #38bdf8",
                fontSize: "0.85rem",
              }}
            >
              <strong
                style={{
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                📜 Ultime Offerte:
              </strong>
              {storicoOfferte.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {storicoOfferte.map((off, idx) => (
                    <li
                      key={idx}
                      style={{
                        padding: "2px 0",
                        color: idx === 0 ? "#10b981" : "#e2e8f0",
                        fontWeight: idx === 0 ? "bold" : "normal",
                      }}
                    >
                      {off.nome}: <strong>{off.importo} FM</strong> ({off.ora})
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: "#64748b" }}>Nessuna offerta</span>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}
          >
            In attesa che l'amministratore selezioni un calciatore...
          </div>
        )}
      </div>
    </div>
  );
}
