import React, { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig";
import datiJson from "./giocatori.json";
import MobileController from "./MobileController";
import "./App.css";

const parsePlayer = (player) => ({
  id: player.id,
  nome: player.nome || player.name || "Sconosciuto",
  squadra: player.squadra || player.team || "N.D.",
  ruolo:
    typeof player.ruolo === "object"
      ? player.ruolo.code
      : player.ruolo || player.role?.code || "D",
});

const GIOCATORI_INITIAL = (datiJson.players || datiJson).map(parsePlayer);

const PARTECIPANTI_INITIAL = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  nome: `Fanta Squadra ${i + 1}`,
  crediti: 500,
  rosa: [],
}));

const LIMITI_RUOLO = { P: 3, D: 8, C: 8, A: 6 };
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLORI_RUOLO = { P: "#60a5fa", D: "#34d399", C: "#fbbf24", A: "#f87171" };

export default function App() {
  const [giocatori, setGiocatori] = useState(GIOCATORI_INITIAL);
  const [partecipanti, setPartecipanti] = useState(PARTECIPANTI_INITIAL);
  const [isConfigMode, setIsConfigMode] = useState(true);
  const [giocatoreInAsta, setGiocatoreInAsta] = useState(null);
  const [offertaCorrente, setOffertaCorrente] = useState(0);

  // Stati per STOP, Ultimo Offerente e Ultimo Acquisto
  const [ultimoOfferenteId, setUltimoOfferenteId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [stopChiamatoDa, setStopChiamatoDa] = useState(null);
  const [ultimoAcquisto, setUltimoAcquisto] = useState(null);

  const [acquirenteId, setAcquirenteId] = useState("");
  const [timer, setTimer] = useState(10);
  const [ricercaNome, setRicercaNome] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState("TUTTI");
  const [letteraInizio, setLetteraInizio] = useState("A");

  const docRef = doc(db, "asta_fantacalcio", "sessione_asta");
  const isMobileView =
    new URLSearchParams(window.location.search).get("mobile") === "true";

  // Listener Firestore in tempo reale
  useEffect(() => {
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGiocatori((data.giocatori || GIOCATORI_INITIAL).map(parsePlayer));
        setPartecipanti(data.partecipanti || PARTECIPANTI_INITIAL);
        setIsConfigMode(
          data.isConfigMode !== undefined ? data.isConfigMode : true,
        );
        setGiocatoreInAsta(
          data.giocatoreInAsta ? parsePlayer(data.giocatoreInAsta) : null,
        );
        setOffertaCorrente(data.offertaCorrente || 0);
        setUltimoOfferenteId(data.ultimoOfferenteId || null);
        setIsPaused(data.isPaused || false);
        setStopChiamatoDa(data.stopChiamatoDa || null);
        setUltimoAcquisto(data.ultimoAcquisto || null);

        if (data.timer !== undefined) setTimer(data.timer);
      } else {
        salvaSuFirebase(
          GIOCATORI_INITIAL,
          PARTECIPANTI_INITIAL,
          true,
          null,
          0,
          null,
          false,
          null,
          null,
        );
      }
    });
    return () => unsub();
  }, []);

  const salvaSuFirebase = async (
    nuoviG,
    nuoviP,
    configMode,
    gInAsta,
    offerta,
    offerenteId = ultimoOfferenteId,
    paused = false,
    stopDa = null,
    ultimoAcq = ultimoAcquisto,
  ) => {
    try {
      await setDoc(docRef, {
        giocatori: nuoviG,
        partecipanti: nuoviP,
        isConfigMode: configMode,
        giocatoreInAsta: gInAsta,
        offertaCorrente: offerta,
        ultimoOfferenteId: offerenteId,
        isPaused: paused,
        stopChiamatoDa: stopDa,
        ultimoAcquisto: ultimoAcq,
        timer: 10,
      });
    } catch (err) {
      console.error("Errore nel salvataggio online: ", err);
    }
  };

  // Timer standard: avanza solo se l'asta non è in pausa
  useEffect(() => {
    if (giocatoreInAsta && timer > 0 && !isPaused) {
      const intervallo = setInterval(
        () => setTimer((t) => (t <= 1 ? 0 : t - 1)),
        1000,
      );
      return () => clearInterval(intervallo);
    }
  }, [giocatoreInAsta, offertaCorrente, isPaused, timer]);

  // Sblocco automatico dello STOP dopo 30 secondi
  useEffect(() => {
    let timeoutId;
    if (isPaused) {
      timeoutId = setTimeout(async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) return;
            transaction.update(docRef, {
              isPaused: false,
              stopChiamatoDa: null,
            });
          });
        } catch (err) {
          console.error("Errore sblocco automatico pausa:", err);
        }
      }, 30000);
    }
    return () => clearTimeout(timeoutId);
  }, [isPaused]);

  const resettaTutto = () => {
    if (
      window.confirm(
        "Sei sicuro di resettare l'asta online? Cancellerai le rose di tutti.",
      )
    ) {
      salvaSuFirebase(
        GIOCATORI_INITIAL,
        PARTECIPANTI_INITIAL,
        true,
        null,
        0,
        null,
        false,
        null,
        null,
      );
      setAcquirenteId("");
      setTimer(10);
    }
  };

  const handleNomeSquadraChange = (id, nuovoNome) => {
    const aggiornati = partecipanti.map((p) =>
      p.id === id ? { ...p, nome: nuovoNome } : p,
    );
    setPartecipanti(aggiornati);
    salvaSuFirebase(
      giocatori,
      aggiornati,
      isConfigMode,
      giocatoreInAsta,
      offertaCorrente,
      ultimoOfferenteId,
      isPaused,
      stopChiamatoDa,
    );
  };

  const bloccaNomiSquadre = () => {
    setIsConfigMode(false);
    salvaSuFirebase(
      giocatori,
      partecipanti,
      false,
      giocatoreInAsta,
      offertaCorrente,
      ultimoOfferenteId,
      isPaused,
      stopChiamatoDa,
    );
  };

  const sbloccaNomiSquadre = () => {
    setIsConfigMode(true);
    salvaSuFirebase(
      giocatori,
      partecipanti,
      true,
      giocatoreInAsta,
      offertaCorrente,
      ultimoOfferenteId,
      isPaused,
      stopChiamatoDa,
    );
  };

  const chiamaGiocatore = (g) => {
    if (isConfigMode)
      return alert("Salva la configurazione prima di iniziare!");
    setTimer(10);
    setAcquirenteId("");
    salvaSuFirebase(
      giocatori,
      partecipanti,
      isConfigMode,
      g,
      1,
      null,
      false,
      null,
    );
  };

  const faiOfferta = async (incremento = 1) => {
    if (!giocatoreInAsta || timer === 0) return;
    const adminId = "1"; // ID convenzionale per le offerte da dashboard server

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;
        const prezzoCloud = sfDoc.data().offertaCorrente || 0;
        transaction.update(docRef, {
          offertaCorrente: prezzoCloud + incremento,
          ultimoOfferenteId: adminId,
          timer: 10,
          isPaused: false,
          stopChiamatoDa: null,
        });
      });
    } catch (err) {
      console.error("Errore rilancio server: ", err);
    }
  };

  const assegnaGiocatore = async () => {
    if (!acquirenteId || !giocatoreInAsta)
      return alert("Seleziona una squadra!");
    const acquirente = partecipanti.find(
      (p) => p.id === parseInt(acquirenteId),
    );
    if (acquirente.crediti < offertaCorrente)
      return alert("Crediti insufficienti!");

    const dettaglioVincitore = {
      calciatore: giocatoreInAsta.nome,
      ruolo: giocatoreInAsta.ruolo,
      vincitoreNome: acquirente.nome,
      prezzo: offertaCorrente,
    };

    const fantaSquadreAggiornate = partecipanti.map((p) =>
      p.id === acquirente.id
        ? {
            ...p,
            crediti: p.crediti - offertaCorrente,
            rosa: [...p.rosa, { ...giocatoreInAsta, prezzo: offertaCorrente }],
          }
        : p,
    );

    const rimasti = giocatori.filter((g) => g.id !== giocatoreInAsta.id);
    setTimer(10);
    setAcquirenteId("");

    await salvaSuFirebase(
      rimasti,
      fantaSquadreAggiornate,
      isConfigMode,
      null,
      0,
      null,
      false,
      null,
      dettaglioVincitore,
    );
  };

  // Identifichiamo il nome dell'ultimo offerente per la UI
  const ultimoOfferente = partecipanti.find(
    (p) => p.id === parseInt(ultimoOfferenteId),
  );

  if (isMobileView) {
    return (
      <MobileController
        partecipanti={partecipanti}
        giocatoreInAsta={giocatoreInAsta}
        offertaCorrente={offertaCorrente}
        timer={timer}
        isPaused={isPaused}
        stopChiamatoDa={stopChiamatoDa}
        ultimoAcquisto={ultimoAcquisto}
        docRef={docRef}
      />
    );
  }

  return (
    <div className="container">
      <div className="header-container">
        <h1 className="main-title">⚽ Dashboard Asta Pro (Server) ⚽</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={resettaTutto} className="btn btn-orange">
            ⚠️ Resetta Online
          </button>
        </div>
      </div>

      {isConfigMode ? (
        <div
          className="card"
          style={{ maxWidth: "700px", margin: "0 auto 20px auto" }}
        >
          <h2>⚙️ Configura i Nomi delle 10 Squadre</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              margin: "15px 0",
            }}
          >
            {partecipanti.map((p) => (
              <div
                key={p.id}
                style={{ display: "flex", flexDirection: "column" }}
              >
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                  Squadra {p.id}
                </label>
                <input
                  type="text"
                  value={p.nome}
                  onChange={(e) =>
                    handleNomeSquadraChange(p.id, e.target.value)
                  }
                  className="input-field"
                />
              </div>
            ))}
          </div>
          <button
            onClick={bloccaNomiSquadre}
            className="btn btn-orange"
            style={{ width: "100%", padding: "12px" }}
          >
            🔒 Salva e Sblocca Asta Online!
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <button onClick={sbloccaNomiSquadre} className="btn btn-grey">
            ✏️ Modifica Squadre Online
          </button>
        </div>
      )}

      <div className="grid-2-cols">
        {/* SCHEDA ASTA LIVE SERVER */}
        <div className="card">
          <h2>📢 Banditore Asta Live</h2>
          {giocatoreInAsta ? (
            <div>
              <h3 style={{ color: "#38bdf8" }}>
                🏃 {giocatoreInAsta.nome} ({giocatoreInAsta.squadra}) - [
                {giocatoreInAsta.ruolo}]
              </h3>

              <div
                className="alert-box"
                style={{ textAlign: "center", margin: "15px 0" }}
              >
                <h4 style={{ fontSize: "1.6rem", margin: 0 }}>
                  Offerta:{" "}
                  <span style={{ color: "#10b981" }}>{offertaCorrente} FM</span>
                </h4>

                {/* Visualizzazione dell'ultimo offerente */}
                <p
                  style={{
                    marginTop: "8px",
                    fontWeight: "bold",
                    color: "#fbbf24",
                    fontSize: "1.1rem",
                  }}
                >
                  🙋 Ultimo Rilancio:{" "}
                  {ultimoOfferente ? ultimoOfferente.nome : "Base d'asta"}
                </p>

                <div style={{ marginTop: "5px" }}>
                  {isPaused ? (
                    <span style={{ color: "#f87171", fontWeight: "bold" }}>
                      ⏸️ PAUSA STOP (30s) - Chiamato da {stopChiamatoDa}
                    </span>
                  ) : (
                    <span>⏱️ Timer: {timer}s</span>
                  )}
                </div>
              </div>

              <div
                style={{ display: "flex", gap: "10px", marginBottom: "15px" }}
              >
                <button
                  onClick={() => faiOfferta(1)}
                  disabled={timer === 0}
                  className="btn"
                >
                  +1 FM 🔨
                </button>
                <button
                  onClick={() => faiOfferta(5)}
                  disabled={timer === 0}
                  className="btn btn-green"
                >
                  +5 FM 🚀
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <select
                  value={acquirenteId}
                  onChange={(e) => setAcquirenteId(e.target.value)}
                  className="select-field"
                  style={{ flex: 1 }}
                >
                  <option value="">Seleziona vincente...</option>
                  {partecipanti.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.crediti} FM)
                    </option>
                  ))}
                </select>
                <button onClick={assegnaGiocatore} className="btn btn-green">
                  🏆 Assegna
                </button>
              </div>
            </div>
          ) : (
            <div
              className="alert-box"
              style={{ textAlign: "center", padding: "20px" }}
            >
              <p style={{ color: "#94a3b8" }}>
                In attesa della chiamata di un nuovo calciatore...
              </p>

              {/* BANNER NOTIFICA AGGIUDICAZIONE */}
              {ultimoAcquisto && (
                <div
                  style={{
                    marginTop: "15px",
                    borderTop: "2px dashed #334155",
                    paddingTop: "15px",
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>
                    🎉 <strong>COLPO AGGIUDICATO!</strong>
                  </span>
                  <h3 style={{ color: "#fbbf24", margin: "8px 0" }}>
                    {ultimoAcquisto.calciatore} ({ultimoAcquisto.ruolo})
                  </h3>
                  <p style={{ fontSize: "1.1rem" }}>
                    Vinto da{" "}
                    <strong style={{ color: "#38bdf8" }}>
                      {ultimoAcquisto.vincitoreNome}
                    </strong>{" "}
                    per{" "}
                    <strong style={{ color: "#10b981" }}>
                      {ultimoAcquisto.prezzo} FM
                    </strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SCHEDA RESOCONTO ROSE */}
        <div className="card">
          <h2>👥 Rose e Crediti Residui</h2>
          {partecipanti.map((p) => (
            <div
              key={p.id}
              className="team-row"
              style={{
                display: "block",
                padding: "10px",
                marginBottom: "8px",
                borderBottom: "1px solid #334155",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "bold",
                }}
              >
                <span>{p.nome}</span>
                <span style={{ color: "#10b981" }}>{p.crediti} FM</span>
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#94a3b8",
                  marginTop: "5px",
                }}
              >
                Rosa ({p.rosa.length}):{" "}
                {p.rosa.map((g) => `${g.nome} (${g.prezzo}FM)`).join(", ") ||
                  "Vuota"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <h2>🔍 Chiamata Calciatori</h2>
        {giocatori.map((g) => (
          <div
            key={g.id}
            className="player-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
            }}
          >
            <span>
              {g.nome} - {g.squadra} ({g.ruolo})
            </span>
            <button
              onClick={() => chiamaGiocatore(g)}
              disabled={isConfigMode}
              className="btn-call btn-blue"
            >
              Chiama 🔨
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
