import React, { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig";
import MobileController from "./MobileController";
import {
  ALPHABET,
  INITIAL_PARTICIPANTS,
  INITIAL_PLAYERS,
  INITIAL_ROLE_FILTERS,
  ROLE_LIMITS,
} from "./data/auctionDefaults";
import {
  AUCTION_DURATION_MS,
  STOP_DURATION_MS,
  getRemainingSeconds,
} from "./timerUtils";
import {
  countRosterRoles,
  filterPlayers,
  findNextPlayer,
  normalizePlayer,
  normalizePlayers,
  sortPlayersAlphabetically,
} from "./utils/playerUtils";
import "./App.css";

export default function App() {
  const [giocatori, setGiocatori] = useState(INITIAL_PLAYERS);
  const [partecipanti, setPartecipanti] = useState(INITIAL_PARTICIPANTS);
  const [isConfigMode, setIsConfigMode] = useState(true);
  const [giocatoreInAsta, setGiocatoreInAsta] = useState(null);
  const [offertaCorrente, setOffertaCorrente] = useState(0);

  // 🛠️ Stato per la gestione della vista attiva (Dashboard o Rose)
  const [vistaCorrente, setVistaCorrente] = useState("dashboard");

  const [isTimerStarted, setIsTimerStarted] = useState(false);
  const [ultimoOfferenteId, setUltimoOfferenteId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [stopChiamatoDa, setStopChiamatoDa] = useState(null);
  const [stopIniziatoAt, setStopIniziatoAt] = useState(null);
  const [ultimoAcquisto, setUltimoAcquisto] = useState(null);

  // Stati locali per la gestione dell'assegnazione manuale di emergenza
  const [squadraManualeId, setSquadraManualeId] = useState("");
  const [prezzoManuale, setPrezzoManuale] = useState("");

  const [storicoOfferte, setStoricoOfferte] = useState([]);
  const [timer, setTimer] = useState(10);
  const [timerEndsAt, setTimerEndsAt] = useState(null);
  const [stopTimerVisivoServer, setStopTimerVisivoServer] = useState(30);

  const [filtroLettera, setFiltroLettera] = useState("TUTTE");
  const [filtriRuoliAttivi, setFiltriRuoliAttivi] = useState(
    INITIAL_ROLE_FILTERS,
  );

  const docRef = doc(db, "asta_fantacalcio", "sessione_asta");
  const isMobileView =
    new URLSearchParams(window.location.search).get("mobile") === "true";

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
    fineTimer = timerEndsAt,
  ) => {
    try {
      await setDoc(docRef, {
        giocatori: sortPlayersAlphabetically(nuoviG),
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
        timerEndsAt: timerStarted && !paused ? fineTimer : null,
      });
    } catch (err) {
      console.error("Errore nel salvataggio su Firestore: ", err);
    }
  };

  const gestisciCaricamentoJson = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const contenutoJson = JSON.parse(e.target.result);
        const arrayGrezzo = contenutoJson.players || contenutoJson;
        const nuoviGiocatoriParsed = normalizePlayers(arrayGrezzo);

        setGiocatori(nuoviGiocatoriParsed);
        salvaSuFirebase(
          nuoviGiocatoriParsed,
          partecipanti,
          isConfigMode,
          giocatoreInAsta,
          offertaCorrente,
          isTimerStarted,
          ultimoOfferenteId,
          isPaused,
          stopChiamatoDa,
          stopIniziatoAt,
          ultimoAcquisto,
          storicoOfferte
        );

        alert("File JSON importato e aggiornato con successo!");
      } catch (errore) {
        console.error("Errore durante il parsing del JSON:", errore);
        alert("Il file selezionato non è un JSON valido.");
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const giocatoriParsed = (data.giocatori || INITIAL_PLAYERS).map(
          normalizePlayer,
        );
        setGiocatori(sortPlayersAlphabetically(giocatoriParsed));

        setPartecipanti(data.partecipanti || INITIAL_PARTICIPANTS);
        setIsConfigMode(
          data.isConfigMode !== undefined ? data.isConfigMode : true,
        );
        setGiocatoreInAsta(
          data.giocatoreInAsta ? normalizePlayer(data.giocatoreInAsta) : null,
        );
        setOffertaCorrente(data.offertaCorrente || 0);
        setIsTimerStarted(data.isTimerStarted || false);
        setUltimoOfferenteId(data.ultimoOfferenteId || null);
        setIsPaused(data.isPaused || false);
        setStopChiamatoDa(data.stopChiamatoDa || null);
        setStopIniziatoAt(data.stopIniziatoAt || null);
        setUltimoAcquisto(data.ultimoAcquisto || null);
        setStoricoOfferte(data.storicoOfferte || []);

        const timerSalvato = data.timer !== undefined ? data.timer : 10;
        setTimer(timerSalvato);
        setTimerEndsAt(
          data.timerEndsAt ||
          (data.isTimerStarted && !data.isPaused && timerSalvato > 0
            ? Date.now() + (timerSalvato * 1000)
            : null)
        );
      } else {
        salvaSuFirebase(
          INITIAL_PLAYERS,
          INITIAL_PARTICIPANTS,
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

  useEffect(() => {
    if (!giocatoreInAsta || !isTimerStarted || isPaused) return;
    if (!timerEndsAt) return;

    const aggiornaTimer = () => {
      setTimer(getRemainingSeconds(timerEndsAt));
    };

    aggiornaTimer();
    const intervallo = setInterval(aggiornaTimer, 250);
    return () => clearInterval(intervallo);
  }, [giocatoreInAsta, isTimerStarted, isPaused, timerEndsAt]);

  useEffect(() => {
    let interval = null;
    let timeout = null;

    if (isPaused && stopIniziatoAt) {
      const aggiornaTimerStop = () => {
        const trascorsi = Math.floor((Date.now() - stopIniziatoAt) / 1000);
        const rimasti = Math.max(0, 30 - trascorsi);
        setStopTimerVisivoServer(rimasti);
      };

      aggiornaTimerStop();
      interval = setInterval(aggiornaTimerStop, 1000);

      const trascorsiMs = Date.now() - stopIniziatoAt;
      const rimastiMs = Math.max(0, STOP_DURATION_MS - trascorsiMs);

      if (!isMobileView) {
        timeout = setTimeout(async () => {
          try {
            await runTransaction(db, async (transaction) => {
              const sfDoc = await transaction.get(docRef);
              if (!sfDoc.exists()) return;

              const sessione = sfDoc.data();
              if (
                !sessione.isPaused ||
                sessione.stopIniziatoAt !== stopIniziatoAt
              ) {
                return;
              }

              const timerRimanenteMs = Math.max(
                0,
                sessione.timerRimanenteMs ?? (sessione.timer || 0) * 1000,
              );

              transaction.update(docRef, {
                isPaused: false,
                stopChiamatoDa: null,
                stopIniziatoAt: null,
                timerRimanenteMs: null,
                timer: Math.ceil(timerRimanenteMs / 1000),
                timerEndsAt:
                  timerRimanenteMs > 0 ? Date.now() + timerRimanenteMs : null,
              });
            });
          } catch (e) {
            console.error("Errore nello sblocco automatico dello STOP: ", e);
          }
        }, rimastiMs);
      }
    } else {
      setStopTimerVisivoServer(30);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isPaused, stopIniziatoAt, isMobileView]);

  useEffect(() => {
    if (
      timer === 0 &&
      giocatoreInAsta &&
      ultimoOfferenteId &&
      !isPaused &&
      isTimerStarted &&
      !isMobileView
    ) {
      assegnaGiocatore();
    }
  }, [
    timer,
    giocatoreInAsta,
    ultimoOfferenteId,
    isPaused,
    isTimerStarted,
    isMobileView,
  ]);

  const avviaTimerManualmente = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(docRef);
        if (!sfDoc.exists()) return;
        transaction.update(docRef, {
          isTimerStarted: true,
          timer: 10,
          timerEndsAt: Date.now() + AUCTION_DURATION_MS,
        });
      });
    } catch (err) {
      console.error("Errore nell'avvio del timer:", err);
    }
  };

  const cambiaGiocatoreManuale = (direzione) => {
    if (!giocatoreInAsta || isConfigMode) return;

    const listaCorrente = giocatoriFiltrati;
    const indiceAttuale = listaCorrente.findIndex(
      (g) => g.id === giocatoreInAsta.id,
    );
    const nuovoIndice =
      direzione === "avanti" ? indiceAttuale + 1 : indiceAttuale - 1;

    if (nuovoIndice >= 0 && nuovoIndice < listaCorrente.length) {
      const prossimo = listaCorrente[nuovoIndice];
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
        "Attenzione! Vuoi resettare l'intera sessione d'asta e ricaricare i giocatori dal file JSON?",
      )
    ) {
      salvaSuFirebase(
        INITIAL_PLAYERS,
        INITIAL_PARTICIPANTS,
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

  const esportaInExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,";

    partecipanti.forEach((p) => {
      if (p.rosa && p.rosa.length > 0) {
        p.rosa.forEach((g) => {
          const nomeSquadra = p.nome;
          const codiceCalciatore = g.id;
          const prezzoAcquisto = g.prezzo;

          csvContent += `${nomeSquadra},${codiceCalciatore},${prezzoAcquisto}\n`;
        });
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fantariggio_rosters.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;
    const adminId = "1";
    const adminNome = partecipanti.find((p) => p.id === 1)?.nome || "Admin";

    const offerente = partecipanti.find((p) => p.id === 1);
    if (offerente) {
      const ruoloCorrente = giocatoreInAsta.ruolo;
      const quantitaInRosa = offerente.rosa.filter(
        (g) => g.ruolo === ruoloCorrente,
      ).length;

      if (quantitaInRosa >= (ROLE_LIMITS[ruoloCorrente] || 0)) {
        alert(
          `⛔ Impossibile offrire: hai già completato i ${ruoloCorrente} (${ROLE_LIMITS[ruoloCorrente]}/${ROLE_LIMITS[ruoloCorrente]})!`,
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
          timerEndsAt: Date.now() + AUCTION_DURATION_MS,
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

    const ruoloCorrente = giocatoreInAsta.ruolo;
    const quantitaInRosa = vincitore.rosa.filter(
      (g) => g.ruolo === ruoloCorrente,
    ).length;

    if (quantitaInRosa >= (ROLE_LIMITS[ruoloCorrente] || 0)) {
      alert(
        `❌ Limite raggiunto! ${vincitore.nome} ha già completato i ${ruoloCorrente} (${ROLE_LIMITS[ruoloCorrente]}/${ROLE_LIMITS[ruoloCorrente]}). Assegnazione bloccata.`,
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

    const { player: prossimoGiocatore, letter: prossimaLettera } =
      findNextPlayer(
        giocatoriRimasti,
        filtroLettera,
        filtriRuoliAttivi,
        ALPHABET,
      );
    setFiltroLettera(prossimaLettera);

    setTimer(10);
    await salvaSuFirebase(
      giocatoriRimasti,
      partecipantiAggiornati,
      isConfigMode,
      prossimoGiocatore,
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

  const assegnaGiocatoreManualmente = async () => {
    if (!giocatoreInAsta) return;
    if (!squadraManualeId) {
      alert("Seleziona una squadra a cui assegnare il giocatore!");
      return;
    }
    const prezzoParsed = parseInt(prezzoManuale);
    if (isNaN(prezzoParsed) || prezzoParsed < 0) {
      alert("Inserisci un prezzo di acquisto valido!");
      return;
    }

    const vincitore = partecipanti.find((p) => p.id === parseInt(squadraManualeId));
    if (!vincitore) return;

    if (vincitore.crediti < prezzoParsed) {
      alert(`Attenzione: ${vincitore.nome} ha solo ${vincitore.crediti} FM e non può spendere ${prezzoParsed} FM!`);
      return;
    }

    const ruoloCorrente = giocatoreInAsta.ruolo;
    const quantitaInRosa = vincitore.rosa.filter((g) => g.ruolo === ruoloCorrente).length;

    if (quantitaInRosa >= (ROLE_LIMITS[ruoloCorrente] || 0)) {
      alert(`❌ Limite raggiunto! ${vincitore.nome} ha già completato i ${ruoloCorrente} (${ROLE_LIMITS[ruoloCorrente]}/${ROLE_LIMITS[ruoloCorrente]}).`);
      return;
    }

    const dettaglioVincitore = {
      calciatore: giocatoreInAsta.nome,
      ruolo: giocatoreInAsta.ruolo,
      vincitoreNome: vincitore.nome,
      prezzo: prezzoParsed,
    };

    const partecipantiAggiornati = partecipanti.map((p) =>
      p.id === vincitore.id
        ? {
          ...p,
          crediti: p.crediti - prezzoParsed,
          rosa: [...p.rosa, { ...giocatoreInAsta, prezzo: prezzoParsed }],
        }
        : p
    );

    const giocatoriRimasti = giocatori.filter((g) => g.id !== giocatoreInAsta.id);

    const { player: prossimoGiocatore, letter: prossimaLettera } =
      findNextPlayer(
        giocatoriRimasti,
        filtroLettera,
        filtriRuoliAttivi,
        ALPHABET,
      );
    setFiltroLettera(prossimaLettera);

    setSquadraManualeId("");
    setPrezzoManuale("");
    setTimer(10);

    await salvaSuFirebase(
      giocatoriRimasti,
      partecipantiAggiornati,
      isConfigMode,
      prossimoGiocatore,
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

  const giocatoriFiltrati = filterPlayers(
    giocatori,
    filtroLettera,
    filtriRuoliAttivi,
  );

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
        storicoOfferte={storicoOfferte}
        docRef={docRef}
      />
    );
  }

  return (
    <div className="container">
      <div className="header-container">
        <h1 className="main-title">⚽ FantaRiggio Asta Pro (Server) ⚽</h1>
        <div className="header-actions">
          <button onClick={esportaInExcel} className="btn btn-green">
            📊 Esporta CSV Pulito
          </button>

          <label className="btn btn-blue" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            📂 Aggiorna JSON
            <input
              type="file"
              accept=".json"
              onChange={gestisciCaricamentoJson}
              style={{ display: "none" }}
            />
          </label>

          <button onClick={resettaTutto} className="btn btn-orange">
            ⚠️ Resetta Sessione
          </button>
        </div>
      </div>

      {/* 🛠️ Barra di navigazione interattiva aggiornata */}
      <nav className="fanta-floating-nav">
        <span
          onClick={() => setVistaCorrente("dashboard")}
          style={{ cursor: "pointer", color: vistaCorrente === "dashboard" ? "#38bdf8" : "#94a3b8" }}
        >
          🏠 Dashboard
        </span>
        <span
          onClick={() => setVistaCorrente("rose")}
          style={{ cursor: "pointer", color: vistaCorrente === "rose" ? "#38bdf8" : "#94a3b8" }}
        >
          👥 Rose
        </span>
        <span
          onClick={() => setVistaCorrente("calendario")}
          style={{ cursor: "pointer", color: vistaCorrente === "calendario" ? "#38bdf8" : "#94a3b8" }}
        >
          📅 Calendario
        </span>
        <span
          onClick={() => setVistaCorrente("classifica")}
          style={{ cursor: "pointer", color: vistaCorrente === "classifica" ? "#38bdf8" : "#94a3b8" }}
        >
          🏆 Classifica
        </span>
      </nav>

      {isConfigMode ? (
        <div className="card config-card">
          <h2>⚙️ Configurazione Iniziale Squadre</h2>
          <div className="config-grid">
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

      {/* 🛠️ Rendering condizionale in base alla vista selezionata */}
      {vistaCorrente === "dashboard" ? (
        <div className="auction-layout">
          <div className="card auction-card">
            <h2>📢 Banditore Asta Live</h2>
            {giocatoreInAsta ? (
              <div>
                <div className="auction-player-nav">
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

                <div className="bid-actions">
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
                  style={{ width: "100%", padding: "12px", fontSize: "1.1rem", marginBottom: "15px" }}
                >
                  🏆 Assegna a {ultimoOfferente ? ultimoOfferente.nome : "..."} e
                  Passa al Prossimo ⏩
                </button>

                <div style={{ borderTop: "1px dashed #475569", paddingTop: "12px", marginTop: "10px" }}>
                  <p style={{ fontSize: "0.9rem", color: "#fbbf24", marginBottom: "8px", fontWeight: "bold" }}>
                    ⚠️ Correzione / Assegnazione Manuale d'Emergenza:
                  </p>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <select
                      value={squadraManualeId}
                      onChange={(e) => setSquadraManualeId(e.target.value)}
                      style={{ flex: 2, padding: "8px", borderRadius: "4px", background: "#1e293b", color: "#fff", border: "1px solid #475569" }}
                    >
                      <option value="">Seleziona Squadra...</option>
                      {partecipanti.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.crediti} FM)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Prezzo FM"
                      value={prezzoManuale}
                      onChange={(e) => setPrezzoManuale(e.target.value)}
                      style={{ flex: 1, padding: "8px", borderRadius: "4px", background: "#1e293b", color: "#fff", border: "1px solid #475569" }}
                    />
                  </div>
                  <button
                    onClick={assegnaGiocatoreManualmente}
                    className="btn btn-orange"
                    style={{ width: "100%", padding: "8px", fontSize: "0.95rem" }}
                  >
                    🔧 Forza Assegnazione Manuale
                  </button>
                </div>

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

          <div className="card teams-card">
            <h2>👥 Rose e Crediti Residui</h2>
            {partecipanti.map((p) => {
              const contiRuoli = countRosterRoles(p.rosa, ROLE_LIMITS);
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

          <div className="card players-card">
            <h2>
              🔍 Elenco Giocatori Disponibili ({giocatoriFiltrati.length} /{" "}
              {giocatori.length})
            </h2>

            <div className="role-filters">
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

            <div className="letter-filters">
              <button
                onClick={() => setFiltroLettera("TUTTE")}
                className={`btn ${filtroLettera === "TUTTE" ? "btn-blue" : "btn-grey"
                  }`}
                style={{ padding: "5px 10px", fontSize: "0.8rem" }}
              >
                TUTTE
              </button>
              {ALPHABET.map((lettera) => (
                <button
                  key={lettera}
                  onClick={() => setFiltroLettera(lettera)}
                  className={`btn ${filtroLettera === lettera ? "btn-blue" : "btn-grey"
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

            <div className="player-list">
              {giocatoriFiltrati.map((g) => (
                <div
                  key={g.id}
                  className="player-row"
                >
                  <span className="player-name">
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
      ) : vistaCorrente === "rose" ? (
        <div className="card" style={{ width: "100%", marginTop: "20px" }}>
          <h2>👥 Gestione Dettagliata Rose di Tutti i Partecipanti</h2>
          {partecipanti.map((p) => {
            const contiRuoli = countRosterRoles(p.rosa, ROLE_LIMITS);
            return (
              <div key={p.id} style={{ marginBottom: "20px", borderBottom: "1px solid #334155", paddingBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ color: "#38bdf8", margin: 0 }}>{p.nome}</h3>
                  <span style={{ color: "#10b981", fontWeight: "bold" }}>Crediti Residui: {p.crediti} FM</span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#fbbf24", marginTop: "5px" }}>
                  Composizione Ruoli: P: {contiRuoli.P}/3 | D: {contiRuoli.D}/8 | C: {contiRuoli.C}/8 | A: {contiRuoli.A}/6
                </div>
                {p.rosa.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                    {p.rosa.map((g, index) => (
                      <span key={index} style={{ background: "#1e293b", padding: "6px 10px", borderRadius: "6px", fontSize: "0.85rem", border: "1px solid #475569" }}>
                        <strong>{g.nome}</strong> ({g.ruolo}) - <em>{g.prezzo} FM</em>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontStyle: "italic", color: "#64748b", fontSize: "0.85rem", marginTop: "8px" }}>Nessun giocatore in rosa al momento.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ width: "100%", marginTop: "20px", textAlign: "center", padding: "40px" }}>
          <h2 style={{ color: "#94a3b8" }}>Sezione "{vistaCorrente.toUpperCase()}" in fase di sviluppo...</h2>
        </div>
      )}
    </div>
  );
}
