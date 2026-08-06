import React, { useState, useEffect } from "react";
import { runTransaction } from "firebase/firestore";

export default function MobileController({
  partecipanti,
  giocatoreInAsta,
  offertaCorrente,
  timer,
  isPaused,
  stopChiamatoDa,
  ultimoAcquisto,
  docRef,
}) {
  const [squadraId, setSquadraId] = useState("");
  const [stopUsati, setStopUsati] = useState(0);

  // Resetta gli STOP usati quando cambia il calciatore in asta
  useEffect(() => {
    setStopUsati(0);
  }, [giocatoreInAsta?.id]);

  const miaSquadra = partecipanti.find((p) => p.id === parseInt(squadraId));

  const rilancia = async (incremento) => {
    if (!giocatoreInAsta || timer === 0) return;
    try {
      await runTransaction(docRef.firestore, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;
        const prezzoCloud = sfDoc.data().offertaCorrente || 0;
        transaction.update(docRef, {
          offertaCorrente: prezzoCloud + incremento,
          ultimoOfferenteId: squadraId,
          timer: 10,
          isPaused: false, // Sblocca la pausa se qualcuno rilancia
          stopChiamatoDa: null,
        });
      });
    } catch (err) {
      console.error("Errore durante il rilancio:", err);
    }
  };

  const gestisciStop = async () => {
    if (offertaCorrente < 30 || stopUsati >= 2 || timer === 0 || isPaused)
      return;

    try {
      await runTransaction(docRef.firestore, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;

        transaction.update(docRef, {
          timer: 30,
          isPaused: true,
          stopChiamatoDa: miaSquadra?.nome || "Una squadra",
        });
      });

      setStopUsati((prev) => prev + 1);
    } catch (err) {
      console.error("Errore durante l'attivazione dello STOP:", err);
    }
  };

  if (!squadraId) {
    return (
      <div className="container" style={{ paddingTop: "40px" }}>
        <div className="card" style={{ textAlign: "center", padding: "20px" }}>
          <h2>📱 Seleziona la tua Squadra</h2>
          <select
            onChange={(e) => setSquadraId(e.target.value)}
            className="select-field"
            style={{ width: "100%", padding: "12px", marginTop: "15px" }}
          >
            <option value="">Chi sei?</option>
            {partecipanti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "20px" }}>
      <div className="card" style={{ textAlign: "center", padding: "20px" }}>
        <h2>🔴 {miaSquadra?.nome}</h2>
        <p style={{ color: "#10b981", fontWeight: "bold", fontSize: "1.2rem" }}>
          Crediti: {miaSquadra?.crediti} FM
        </p>

        <hr style={{ margin: "15px 0", borderColor: "#334155" }} />

        {giocatoreInAsta ? (
          <div>
            <h3>
              🏃 {giocatoreInAsta.nome} ({giocatoreInAsta.ruolo})
            </h3>
            <p
              style={{
                fontSize: "2.5rem",
                fontWeight: "bold",
                margin: "10px 0",
              }}
            >
              {offertaCorrente} FM
            </p>

            {/* Banner Stato Timer / Pausa */}
            <div style={{ marginBottom: "15px" }}>
              {isPaused ? (
                <div
                  style={{
                    backgroundColor: "#b91c1c",
                    color: "#fff",
                    padding: "8px",
                    borderRadius: "5px",
                    fontWeight: "bold",
                  }}
                >
                  ⏸️ PAUSA STOP (30s) - {stopChiamatoDa}
                </div>
              ) : (
                <p style={{ fontSize: "1.1rem" }}>⏱️ Timer: {timer}s</p>
              )}
            </div>

            {/* Pulsanti Rilancio */}
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
                  timer === 0 || miaSquadra?.crediti < offertaCorrente + 1
                }
                className="btn btn-green"
                style={{ padding: "15px", fontSize: "1.1rem" }}
              >
                +1 FM 🔨
              </button>
              <button
                onClick={() => rilancia(5)}
                disabled={
                  timer === 0 || miaSquadra?.crediti < offertaCorrente + 5
                }
                className="btn btn-blue"
                style={{ padding: "15px", fontSize: "1.1rem" }}
              >
                +5 FM 🚀
              </button>
            </div>

            {/* Pulsante STOP */}
            <button
              onClick={gestisciStop}
              disabled={
                offertaCorrente < 30 ||
                stopUsati >= 2 ||
                timer === 0 ||
                isPaused
              }
              className="btn btn-orange"
              style={{
                width: "100%",
                padding: "15px",
                fontSize: "1.1rem",
                opacity:
                  offertaCorrente < 30 || stopUsati >= 2 || isPaused ? 0.5 : 1,
              }}
            >
              🛑 STOP ({2 - stopUsati} rimasti)
            </button>

            {offertaCorrente < 30 && (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                  marginTop: "8px",
                }}
              >
                * Il tasto STOP si attiva a partire da 30 FM
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: "15px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
            }}
          >
            <p style={{ color: "#94a3b8" }}>
              In attesa del prossimo giocatore...
            </p>
            {ultimoAcquisto && (
              <div
                style={{
                  marginTop: "15px",
                  borderTop: "1px dashed #334155",
                  paddingTop: "10px",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>
                  🎉 <strong>AGGIUDICATO!</strong>
                </span>
                <h3 style={{ color: "#fbbf24", margin: "5px 0" }}>
                  {ultimoAcquisto.calciatore} ({ultimoAcquisto.ruolo})
                </h3>
                <p>
                  Aggiudicato a <strong>{ultimoAcquisto.vincitoreNome}</strong>{" "}
                  per{" "}
                  <span style={{ color: "#10b981", fontWeight: "bold" }}>
                    {ultimoAcquisto.prezzo} FM
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
