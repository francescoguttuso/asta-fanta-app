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

  // Stati per la gestione dello STOP e Ultimo Acquisto
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
        isPaused: paused,
        stopChiamatoDa: stopDa,
        ultimoAcquisto: ultimoAcq,
        timer: 10,
      });
    } catch (err) {
      console.error("Errore nel salvataggio online: ", err);
    }
  };

  // Timer: cammina solo se NON è in pausa
  useEffect(() => {
    if (giocatoreInAsta && timer > 0 && !isPaused) {
      const intervallo = setInterval(
        () => setTimer((t) => (t <= 1 ? 0 : t - 1)),
        1000,
      );
      return () => clearInterval(intervallo);
    }
  }, [giocatoreInAsta, offertaCorrente, isPaused, timer]);

  // Gestione Sblocco Automatico della Pausa dopo 30 secondi
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
          console.error("Errore nello sblocco automatico della pausa:", err);
        }
      }, 30000); // 30 secondi
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
      isPaused,
      stopChiamatoDa,
    );
  };

  const chiamaGiocatore = (g) => {
    if (isConfigMode)
      return alert("Salva la configurazione prima di iniziare!");
    setTimer(10);
    setAcquirenteId("");
    salvaSuFirebase(giocatori, partecipanti, isConfigMode, g, 1, false, null);
  };

  const faiOfferta = async (incremento = 1) => {
    if (!giocatoreInAsta || timer === 0) return;
    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;
        const prezzoCloud = sfDoc.data().offertaCorrente || 0;
        transaction.update(docRef, {
          offertaCorrente: prezzoCloud + incremento,
          ultimoOfferenteId: "1",
          timer: 10,
          isPaused: false, // Il rilancio sblocca la pausa!
          stopChiamatoDa: null,
        });
      });
    } catch (err) {
      console.error("Errore durante il rilancio: ", err);
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
      false,
      null,
      dettaglioVincitore,
    );
  };

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
        <h1 className="main-title">⚽ Dashboard Asta Pro ⚽</h1>
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
        <div className="card">
          <h2>📢 Asta Live</h2>
          {giocatoreInAsta ? (
            <div>
              <h3>
                {giocatoreInAsta.nome} ({giocatoreInAsta.squadra}) -{" "}
                {giocatoreInAsta.ruolo}
              </h3>
              <div className="alert-box">
                <h4>
                  Offerta: {offertaCorrente} FM |{" "}
                  {isPaused
                    ? `⏸️ PAUSA STOP (${stopChiamatoDa})`
                    : `Timer: ${timer}s`}
                </h4>
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

              <div>
                <select
                  value={acquirenteId}
                  onChange={(e) => setAcquirenteId(e.target.value)}
                  className="select-field"
                >
                  <option value="">Seleziona acquisto...</option>
                  {partecipanti.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.crediti} FM)
                    </option>
                  ))}
                </select>
                <button
                  onClick={assegnaGiocatore}
                  className="btn btn-green"
                  style={{ marginLeft: "10px" }}
                >
                  Assegna
                </button>
              </div>
            </div>
          ) : (
            <div className="alert-box">
              Nessun calciatore all'asta al momento.
            </div>
          )}
        </div>

        <div className="card">
          <h2>👥 10 Squadre e Rose Online</h2>
          {partecipanti.map((p) => (
            <div
              key={p.id}
              className="team-row"
              style={{ display: "block", padding: "12px 10px" }}
            >
              <span>
                {p.nome} ({p.crediti} FM)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <h2>🔍 Database Giocatori Online</h2>
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
