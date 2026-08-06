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

const LIMITI_RUOLI = { P: 3, D: 8, C: 8, A: 6 };
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function App() {
  const [giocatori, setGiocatori] = useState(GIOCATORI_INITIAL);
  const [partecipanti, setPartecipanti] = useState(PARTECIPANTI_INITIAL);
  const [isConfigMode, setIsConfigMode] = useState(true);
  const [giocatoreInAsta, setGiocatoreInAsta] = useState(null);
  const [offertaCorrente, setOffertaCorrente] = useState(0);

  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [ultimoOfferenteId, setUltimoOfferenteId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [stopChiamatoDa, setStopChiamatoDa] = useState(null);
  const [stopIniziatoAt, setStopIniziatoAt] = useState(null);
  const [ultimoAcquisto, setUltimoAcquisto] = useState(null);

  const [storicoOfferte, setStoricoOfferte] = useState([]);
  const [timer, setTimer] = useState(10);
  const [stopTimerVisivoServer, setStopTimerVisivoServer] = useState(30);

  // NUOVI STATI PER FILTRI ALFABETICI E DI RUOLO
  const [filtroLettera, setFiltroLettera] = useState("TUTTE");
  const [filtriRuoliAttivi, setFiltriRuoliAttivi] = useState({
    P: true,
    D: true,
    C: true,
    A: true,
  });

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
        setIsTimerStarted(data.isTimerStarted || false);
        setUltimoOfferenteId(data.ultimoOfferenteId || null);
        setIsPaused(data.isPaused || false);
        setStopChiamatoDa(data.stopChiamatoDa || null);
        setStopIniziatoAt(data.stopIniziatoAt || null);
        setUltimoAcquisto(data.ultimoAcquisto || null);
        setStoricoOfferte(data.storicoOfferte || []);

        if (data.timer !== undefined) setTimer(data.timer);
      } else {
        salvaSuFirebase(
          GIOCATORI_INITIAL,
          PARTECIPANTI_INITIAL,
          true,
          null,
          0,
          false,
          null,
          false,
          null,
          null,
          null,
          [],
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
    timerStarted = isTimerStarted,
    offerenteId = ultimoOfferenteId,
    paused = false,
    stopDa = null,
    stopTime = null,
    ultimoAcq = ultimoAcquisto,
    storico = storicoOfferte,
  ) => {
    try {
      await setDoc(docRef, {
        giocatori: nuoviG,
        partecipanti: nuoviP,
        isConfigMode: configMode,
        giocatoreInAsta: gInAsta,
        offertaCorrente: offerta,
        isTimerStarted: timerStarted,
        ultimoOfferenteId: offerenteId,
        isPaused: paused,
        stopChiamatoDa: stopDa,
        stopIniziatoAt: stopTime,
        ultimoAcquisto: ultimoAcq,
        storicoOfferte: storico,
        timer: timer,
      });
    } catch (err) {
      console.error("Errore nel salvataggio su Firestore: ", err);
    }
  };

  // Timer countdown asta
  useEffect(() => {
    if (giocatoreInAsta && isTimerStarted && timer > 0 && !isPaused) {
      const intervallo = setInterval(
        () => setTimer((t) => (t <= 1 ? 0 : t - 1)),
        1000,
      );
      return () => clearInterval(intervallo);
    }
  }, [giocatoreInAsta, isTimerStarted, offertaCorrente, isPaused, timer]);

  // Gestione sblocco automatico STOP e timer visivo server
  useEffect(() => {
    let interval = null;
    let timeout = null;

    if (isPaused && stopIniziatoAt) {
      interval = setInterval(() => {
        const trascorsi = Math.floor((Date.now() - stopIniziatoAt) / 1000);
        const rimasti = Math.max(0, 30 - trascorsi);
        setStopTimerVisivoServer(rimasti);
      }, 1000);

      const trascorsiMs = Date.now() - stopIniziatoAt;
      const rimastiMs = Math.max(0, 30000 - trascorsiMs);

      timeout = setTimeout(async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            if (!sfDoc.exists()) return;
            transaction.update(docRef, {
              isPaused: false,
              stopChiamatoDa: null,
              stopIniziatoAt: null,
            });
          });
        } catch (e) {
          console.error("Errore nello sblocco automatico dello STOP: ", e);
        }
      }, rimastiMs);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isPaused, stopIniziatoAt]);

  // Assegnazione automatica a tempo scaduto
  useEffect(() => {
    if (
      timer === 0 &&
      giocatoreInAsta &&
      ultimoOfferenteId &&
      !isPaused &&
      isTimerStarted
    ) {
      assegnaGiocatore();
    }
  }, [timer, giocatoreInAsta, ultimoOfferenteId, isPaused, isTimerStarted]);

  const avviaTimerManualmente = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;
        transaction.update(docRef, {
          isTimerStarted: true,
          timer: 10,
        });
      });
    } catch (err) {
      console.error("Errore nell'avvio del timer:", err);
    }
  };

  const cambiaGiocatoreManuale = (direzione) => {
    if (!giocatoreInAsta || isConfigMode) return;

    const indiceAttuale = giocatori.findIndex(
      (g) => g.id === giocatoreInAsta.id,
    );
    const nuovoIndice =
      direzione === "avanti" ? indiceAttuale + 1 : indiceAttuale - 1;

    if (nuovoIndice >= 0 && nuovoIndice < giocatori.length) {
      const prossimo = giocatori[nuovoIndice];
      setTimer(10);
      salvaSuFirebase(
        giocatori,
        partecipanti,
        isConfigMode,
        prossimo,
        0,
        false,
        null,
        false,
        null,
        null,
        ultimoAcquisto,
        [],
      );
    }
  };

  const resettaTutto = () => {
    if (
      window.confirm(
        "Attenzione! Vuoi resettare l'intera sessione d'asta online?",
      )
    ) {
      salvaSuFirebase(
        GIOCATORI_INITIAL,
        PARTECIPANTI_INITIAL,
        true,
        null,
        0,
        false,
        null,
        false,
        null,
        null,
        null,
        [],
      );
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
      isTimerStarted,
      ultimoOfferenteId,
      isPaused,
      stopChiamatoDa,
      stopIniziatoAt,
      ultimoAcquisto,
      storicoOfferte,
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
      isTimerStarted,
      ultimoOfferenteId,
      isPaused,
      stopChiamatoDa,
      stopIniziatoAt,
      ultimoAcquisto,
      storicoOfferte,
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
      isTimerStarted,
      ultimoOfferenteId,
      isPaused,
      stopChiamatoDa,
      stopIniziatoAt,
      ultimoAcquisto,
      storicoOfferte,
    );
  };

  const chiamaGiocatore = (g) => {
    if (isConfigMode)
      return alert("Completa e salva la configurazione prima di iniziare!");
    setTimer(10);
    salvaSuFirebase(
      giocatori,
      partecipanti,
      isConfigMode,
      g,
      0,
      false,
      null,
      false,
      null,
      null,
      ultimoAcquisto,
      [],
    );
  };

  const faiOfferta = async (incremento = 1) => {
    if (!giocatoreInAsta || !isTimerStarted || timer === 0) return;
    const adminId = "1";
    const adminNome = partecipanti.find((p) => p.id === 1)?.nome || "Admin";

    // CONTROLLO REPARTO COMPLETO PER L'ADMIN (ID 1)
    const offerente = partecipanti.find((p) => p.id === 1);
    if (offerente) {
      const ruoloCorrente = giocatoreInAsta.ruolo;
      const quantitaInRosa = offerente.rosa.filter(
        (g) => g.ruolo === ruoloCorrente,
      ).length;

      if (quantitaInRosa >= (LIMITI_RUOLI[ruoloCorrente] || 0)) {
        alert(
          `⛔ Impossibile offrire: hai già completato i ${ruoloCorrente} (${LIMITI_RUOLI[ruoloCorrente]}/${LIMITI_RUOLI[ruoloCorrente]})!`,
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

        const nuovaEntrata = {
          nome: adminNome,
          importo: nuovoPrezzo,
          ora: new Date().toLocaleTimeString(),
        };
        const nuovoStorico = [nuovaEntrata, ...vecchioStorico].slice(0, 5);

        transaction.update(docRef, {
          offertaCorrente: nuovoPrezzo,
          ultimoOfferenteId: adminId,
          timer: 10,
          isPaused: false,
          stopChiamatoDa: null,
          stopIniziatoAt: null,
          storicoOfferte: nuovoStorico,
        });
      });
    } catch (err) {
      console.error("Errore nel rilancio server: ", err);
    }
  };

  const assegnaGiocatore = async () => {
    if (!giocatoreInAsta) return;

    if (!ultimoOfferenteId) {
      alert(
        "Impossibile assegnare: nessuna offerta ricevuta per questo calciatore.",
      );
      return;
    }

    const vincitore = partecipanti.find(
      (p) => p.id === parseInt(ultimoOfferenteId),
    );
    if (!vincitore) return;

    if (vincitore.crediti < offertaCorrente) {
      alert(`Errore: ${vincitore.nome} non possiede crediti sufficienti!`);
      return;
    }

    // CONTROLLO DEFINITIVO VINCOLI DI RUOLO
    const ruoloCorrente = giocatoreInAsta.ruolo;
    const quantitaInRosa = vincitore.rosa.filter(
      (g) => g.ruolo === ruoloCorrente,
    ).length;

    if (quantitaInRosa >= (LIMITI_RUOLI[ruoloCorrente] || 0)) {
      alert(
        `❌ Limite raggiunto! ${vincitore.nome} ha già completato i ${ruoloCorrente} (${LIMITI_RUOLI[ruoloCorrente]}/${LIMITI_RUOLI[ruoloCorrente]}). Assegnazione bloccata.`,
      );
      return;
    }

    const dettaglioVincitore = {
      calciatore: giocatoreInAsta.nome,
      ruolo: giocatoreInAsta.ruolo,
      vincitoreNome: vincitore.nome,
      prezzo: offertaCorrente,
    };

    const partecipantiAggiornati = partecipanti.map((p) =>
      p.id === vincitore.id
        ? {
            ...p,
            crediti: p.crediti - offertaCorrente,
            rosa: [...p.rosa, { ...giocatoreInAsta, prezzo: offertaCorrente }],
          }
        : p,
    );

    const giocatoriRimasti = giocatori.filter(
      (g) => g.id !== giocatoreInAsta.id,
    );

    setTimer(10);
    await salvaSuFirebase(
      giocatoriRimasti,
      partecipantiAggiornati,
      isConfigMode,
      null,
      0,
      false,
      null,
      false,
      null,
      null,
      dettaglioVincitore,
      [],
    );
  };

  const ultimoOfferente = partecipanti.find(
    (p) => p.id === parseInt(ultimoOfferenteId),
  );

  // LOGICA FILTRAGGIO GIOCATORI DISPONIBILI
  const giocatoriFiltrati = giocatori.filter((g) => {
    const rispettaLettera =
      filtroLettera === "TUTTE" ||
      g.nome.toUpperCase().startsWith(filtroLettera);
    const rispettaRuolo = filtriRuoliAttivi[g.ruolo];
    return rispettaLettera && rispettaRuolo;
  });

  if (isMobileView) {
    return (
      <MobileController
        partecipanti={partecipanti}
        giocatoreInAsta={giocatoreInAsta}
        offertaCorrente={offertaCorrente}
        timer={timer}
        isTimerStarted={isTimerStarted}
        isPaused={isPaused}
        stopChiamatoDa={stopChiamatoDa}
        stopIniziatoAt={stopIniziatoAt}
        ultimoAcquisto={ultimoAcquisto}
        storicoOfferte={storicoOfferte}
        docRef={docRef}
      />
    );
  }

  return (
    <div className="container">
      <div className="header-container">
        <h1 className="main-title">⚽ Dashboard Asta Pro (Server) ⚽</h1>
        <button onClick={resettaTutto} className="btn btn-orange">
          ⚠️ Resetta Sessione
        </button>
      </div>

      {isConfigMode ? (
        <div
          className="card"
          style={{ maxWidth: "700px", margin: "0 auto 20px auto" }}
        >
          <h2>⚙️ Configurazione Iniziale Squadre</h2>
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
            🔒 Avvia Asta Live
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <button onClick={sbloccaNomiSquadre} className="btn btn-grey">
            ✏️ Modifica Squadre
          </button>
        </div>
      )}

      <div className="grid-2-cols">
        {/* PANEL ASTA LIVE SERVER */}
        <div className="card">
          <h2>📢 Banditore Asta Live</h2>
          {giocatoreInAsta ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "15px",
                  margin: "10px 0",
                }}
              >
                <button
                  onClick={() => cambiaGiocatoreManuale("indietro")}
                  className="btn btn-grey"
                  style={{ padding: "5px 12px", fontSize: "1.2rem" }}
                >
                  ◀
                </button>

                <h3
                  style={{ color: "#38bdf8", margin: 0, textAlign: "center" }}
                >
                  🏃 {giocatoreInAsta.nome} ({giocatoreInAsta.squadra}) - [
                  {giocatoreInAsta.ruolo}]
                </h3>

                <button
                  onClick={() => cambiaGiocatoreManuale("avanti")}
                  className="btn btn-grey"
                  style={{ padding: "5px 12px", fontSize: "1.2rem" }}
                >
                  ▶
                </button>
              </div>

              <div
                className="alert-box"
                style={{ textAlign: "center", margin: "15px 0" }}
              >
                <h4 style={{ fontSize: "1.6rem", margin: 0 }}>
                  Offerta:{" "}
                  <span style={{ color: "#10b981" }}>{offertaCorrente} FM</span>
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
                  {ultimoOfferente
                    ? ultimoOfferente.nome
                    : "In attesa di rilanci"}
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
                      🛑 PAUSA STOP RICHIESTA DA:{" "}
                      <strong>{stopChiamatoDa}</strong>
                      <div style={{ fontSize: "1.4rem", marginTop: "5px" }}>
                        ⏱️ Ripresa Asta tra: {stopTimerVisivoServer}s
                      </div>
                    </div>
                  ) : (
                    <span>⏱️ Timer Asta: {timer}s</span>
                  )}
                </div>
              </div>

              {!isTimerStarted && (
                <button
                  onClick={avviaTimerManualmente}
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

              <div
                style={{ display: "flex", gap: "10px", marginBottom: "15px" }}
              >
                <button
                  onClick={() => faiOfferta(1)}
                  disabled={!isTimerStarted || timer === 0 || isPaused}
                  className="btn"
                >
                  +1 FM 🔨
                </button>
                <button
                  onClick={() => faiOfferta(5)}
                  disabled={!isTimerStarted || timer === 0 || isPaused}
                  className="btn btn-green"
                >
                  +5 FM 🚀
                </button>
              </div>

              <button
                onClick={assegnaGiocatore}
                disabled={!ultimoOfferenteId}
                className="btn btn-green"
                style={{ width: "100%", padding: "12px", fontSize: "1.1rem" }}
              >
                🏆 Assegna a {ultimoOfferente ? ultimoOfferente.nome : "..."} e
                Passa al Prossimo ⏩
              </button>
            </div>
          ) : (
            <div
              className="alert-box"
              style={{ textAlign: "center", padding: "20px" }}
            >
              <p style={{ color: "#94a3b8" }}>
                Nessun calciatore attualmente sul banditore.
              </p>

              {ultimoAcquisto && (
                <div
                  style={{
                    marginTop: "15px",
                    borderTop: "2px dashed #334155",
                    paddingTop: "15px",
                  }}
                >
                  <span style={{ fontSize: "1.2rem", color: "#38bdf8" }}>
                    🎉 <strong>ULTIMO COLPO ASSEGNATO!</strong>
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

        {/* TABELLONE ROSE */}
        <div className="card">
          <h2>👥 Rose e Crediti Residui</h2>
          {partecipanti.map((p) => {
            const contiRuoli = {
              P: p.rosa.filter((g) => g.ruolo === "P").length,
              D: p.rosa.filter((g) => g.ruolo === "D").length,
              C: p.rosa.filter((g) => g.ruolo === "C").length,
              A: p.rosa.filter((g) => g.ruolo === "A").length,
            };
            return (
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
                    fontSize: "0.8rem",
                    color: "#38bdf8",
                    marginTop: "4px",
                  }}
                >
                  P: {contiRuoli.P}/3 | D: {contiRuoli.D}/8 | C: {contiRuoli.C}
                  /8 | A: {contiRuoli.A}/6
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#94a3b8",
                    marginTop: "4px",
                  }}
                >
                  Rosa ({p.rosa.length}):{" "}
                  {p.rosa.map((g) => `${g.nome} (${g.prezzo}FM)`).join(", ") ||
                    "Nessun acquisto"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ELENCO GIOCATORI DISPONIBILI CON FILTRI */}
      <div className="card" style={{ marginTop: "20px" }}>
        <h2>
          🔍 Elenco Giocatori Disponibili ({giocatoriFiltrati.length} /{" "}
          {giocatori.length})
        </h2>

        {/* Filtri per Ruolo */}
        <div
          style={{
            display: "flex",
            gap: "15px",
            margin: "15px 0",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
            Filtra Ruoli:
          </span>
          {Object.keys(filtriRuoliAttivi).map((ruolo) => (
            <label
              key={ruolo}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <input
                type="checkbox"
                checked={filtriRuoliAttivi[ruolo]}
                onChange={() =>
                  setFiltriRuoliAttivi((prev) => ({
                    ...prev,
                    [ruolo]: !prev[ruolo],
                  }))
                }
              />
              {ruolo}
            </label>
          ))}
        </div>

        {/* Filtri per Lettera Alfabetica */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={() => setFiltroLettera("TUTTE")}
            className={`btn ${
              filtroLettera === "TUTTE" ? "btn-blue" : "btn-grey"
            }`}
            style={{ padding: "5px 10px", fontSize: "0.8rem" }}
          >
            TUTTE
          </button>
          {ALFABETO.map((lettera) => (
            <button
              key={lettera}
              onClick={() => setFiltroLettera(lettera)}
              className={`btn ${
                filtroLettera === lettera ? "btn-blue" : "btn-grey"
              }`}
              style={{
                padding: "5px 8px",
                fontSize: "0.8rem",
                minWidth: "30px",
              }}
            >
              {lettera}
            </button>
          ))}
        </div>

        {/* Lista dei Giocatori Filtrati */}
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {giocatoriFiltrati.map((g) => (
            <div
              key={g.id}
              className="player-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #1e293b",
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
    </div>
  );
}
