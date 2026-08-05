// App.jsx
import React, { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseConfig"; // Importa il database configurato
import datiJson from "./giocatori.json";
import "./App.css";

// Configurazione iniziale immutabile di backup
const GIOCATORI_INITIAL = datiJson.players.map((player) => ({
  id: player.id,
  nome: player.name,
  squadra: player.team,
  ruolo: player.role.code,
}));

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
  // Stati locali sincronizzati con Firebase
  const [giocatori, setGiocatori] = useState(GIOCATORI_INITIAL);
  const [partecipanti, setPartecipanti] = useState(PARTECIPANTI_INITIAL);
  const [isConfigMode, setIsConfigMode] = useState(true);
  const [giocatoreInAsta, setGiocatoreInAsta] = useState(null);
  const [offertaCorrente, setOffertaCorrente] = useState(0);

  // Stati solo locali per filtri e interfacce del singolo utente
  const [acquirenteId, setAcquirenteId] = useState("");
  const [timer, setTimer] = useState(10);
  const [timerAttivo, setTimerAttivo] = useState(false);
  const [ricercaNome, setRicercaNome] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState("TUTTI");
  const [letteraInizio, setLetteraInizio] = useState("A");

  const intervalloRef = useRef(null);
  const docRef = doc(db, "asta_fantacalcio", "sessione_asta");

  // ==========================================
  // LISTENER IN TEMPO REALE DA FIREBASE
  // ==========================================
  useEffect(() => {
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGiocatori(data.giocatori || GIOCATORI_INITIAL);
        setPartecipanti(data.partecipanti || PARTECIPANTI_INITIAL);
        setIsConfigMode(
          data.isConfigMode !== undefined ? data.isConfigMode : true,
        );
        setGiocatoreInAsta(data.giocatoreInAsta || null);
        setOffertaCorrente(data.offertaCorrente || 0);
      } else {
        // Se il database è vuoto (primo avvio in assoluto), crea il documento iniziale
        salvaSuFirebase(GIOCATORI_INITIAL, PARTECIPANTI_INITIAL, true, null, 0);
      }
    });
    return () => unsub();
  }, []);

  // Funzione centralizzata per scrivere i dati sul Cloud
  const salvaSuFirebase = async (
    nuoviG,
    nuoviP,
    configMode,
    gInAsta,
    offerta,
  ) => {
    try {
      await setDoc(docRef, {
        giocatori: nuoviG,
        partecipanti: nuoviP,
        isConfigMode: configMode,
        giocatoreInAsta: gInAsta,
        offertaCorrente: offerta,
      });
    } catch (err) {
      console.error("Errore nel salvataggio online: ", err);
    }
  };

  // Gestione locale del conto alla rovescia (uguale per tutti ma calcolato localmente)
  useEffect(() => {
    if (timerAttivo && timer > 0) {
      intervalloRef.current = setInterval(() => setTimer((p) => p - 1), 1000);
    } else if (timer === 0) {
      clearInterval(intervalloRef.current);
      setTimerAttivo(false);
    }
    return () => clearInterval(intervalloRef.current);
  }, [timerAttivo, timer]);

  const resettaTutto = () => {
    if (
      window.confirm(
        "Sei sicuro di resettare l'asta online? Cancellerai le rose di tutti i partecipanti.",
      )
    ) {
      salvaSuFirebase(GIOCATORI_INITIAL, PARTECIPANTI_INITIAL, true, null, 0);
      setAcquirenteId("");
      setTimer(10);
      setTimerAttivo(false);
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
    );
  };

  const chiamaGiocatore = (g) => {
    if (isConfigMode)
      return alert("Salva la configurazione prima di iniziare!");
    setTimer(10);
    setTimerAttivo(false);
    setAcquirenteId("");
    salvaSuFirebase(giocatori, partecipanti, isConfigMode, g, 1);
  };

  const faiOfferta = (valore) => {
    if (valore > offertaCorrente) {
      setTimer(10);
      setTimerAttivo(true);
      salvaSuFirebase(
        giocatori,
        partecipanti,
        isConfigMode,
        giocatoreInAsta,
        valore,
      );
    }
  };

  const getAlfabetoCircolare = (letteraPartenza) => {
    const indice = ALFABETO.indexOf(letteraPartenza);
    if (indice === -1) return ALFABETO;
    return [...ALFABETO.slice(indice), ...ALFABETO.slice(0, indice)];
  };

  const alfabetoOrdinato = getAlfabetoCircolare(letteraInizio);

  const ottieniListaOrdinata = (listaCalciatori) => {
    return listaCalciatori
      .filter(
        (g) =>
          g.nome.toLowerCase().includes(ricercaNome.toLowerCase()) &&
          (filtroRuolo === "TUTTI" || g.ruolo === filtroRuolo),
      )
      .sort(
        (a, b) =>
          alfabetoOrdinato.indexOf(a.nome.charAt(0).toUpperCase()) -
          alfabetoOrdinato.indexOf(b.nome.charAt(0).toUpperCase()),
      );
  };

  const giocatoriFiltrati = ottieniListaOrdinata(giocatori);

  const assegnaGiocatore = () => {
    if (!acquirenteId || !giocatoreInAsta)
      return alert("Seleziona una squadra!");
    const acquirente = partecipanti.find(
      (p) => p.id === parseInt(acquirenteId),
    );
    if (acquirente.crediti < offertaCorrente)
      return alert("Crediti insufficienti!");

    const ruoloG = giocatoreInAsta.ruolo;
    const giaComprati = acquirente.rosa.filter(
      (g) => g.ruolo === ruoloG,
    ).length;
    if (giaComprati >= LIMITI_RUOLO[ruoloG])
      return alert("Limite raggiunto per questo ruolo!");

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
    const listaProssimi = ottieniListaOrdinata(rimasti);

    setTimer(10);
    setTimerAttivo(false);
    setAcquirenteId("");

    if (listaProssimi.length > 0) {
      salvaSuFirebase(
        rimasti,
        fantaSquadreAggiornate,
        isConfigMode,
        listaProssimi[0],
        1,
      );
    } else {
      salvaSuFirebase(rimasti, fantaSquadreAggiornate, isConfigMode, null, 0);
      alert("Asta conclusa! Tutti i giocatori inseriti sono stati venduti.");
    }
  };

  const esportaInExcel = () => {
    let csvContent =
      "data:text/csv;charset=utf-8,Squadra;Giocatore;Ruolo;Club;Prezzo d'Acquisto\n";
    partecipanti.forEach((squadra) => {
      if (squadra.rosa.length === 0)
        csvContent += `${squadra.nome};Nessun acquisto;-;-;-\n`;
      else
        squadra.rosa.forEach(
          (g) =>
            (csvContent += `${squadra.nome};${g.nome};${g.ruolo};${g.squadra};${g.prezzo}\n`),
        );
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "resoconto_asta_fantacalcio.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container">
      <div className="header-container">
        <h1 className="main-title">⚽ Dashboard Asta Pro ⚽</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={resettaTutto} className="btn btn-orange">
            ⚠️ Resetta Online
          </button>
          {!isConfigMode && (
            <button onClick={esportaInExcel} className="btn btn-green">
              📥 Esporta Excel
            </button>
          )}
        </div>
      </div>

      {isConfigMode ? (
        <div
          className="card"
          style={{
            maxWidth: "700px",
            margin: "0 auto 20px auto",
          }}
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
                  Offerta Corrente: {offertaCorrente} FM | Timer: {timer}s
                </h4>
              </div>
              <button
                onClick={() => faiOfferta(offertaCorrente + 1)}
                className="btn"
              >
                +1 FM
              </button>
              <button
                onClick={() => setTimerAttivo(true)}
                className="btn btn-green"
              >
                Avvia Tempo
              </button>
              <div style={{ marginTop: "15px" }}>
                <select
                  value={acquirenteId}
                  onChange={(e) => setAcquirenteId(e.target.value)}
                  className="select-field"
                >
                  <option value="">Seleziona...</option>
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
          {partecipanti.map((p) => {
            const count = (r) => p.rosa.filter((g) => g.ruolo === r).length;
            const isIncompleta =
              count("P") < LIMITI_RUOLO.P ||
              count("D") < LIMITI_RUOLO.D ||
              count("C") < LIMITI_RUOLO.C ||
              count("A") < LIMITI_RUOLO.A;

            return (
              <div
                key={p.id}
                className="team-row"
                style={{ display: "block", padding: "12px 10px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>
                    {p.nome} ({p.crediti} FM)
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    P({count("P")}/{LIMITI_RUOLO.P}) D({count("D")}/
                    {LIMITI_RUOLO.D}) C({count("C")}/{LIMITI_RUOLO.C}) A(
                    {count("A")}/{LIMITI_RUOLO.A}){" "}
                    {isIncompleta ? "🔴 Incompleta" : "🟢 Completa"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginTop: "8px",
                    borderTop: "1px solid #334155",
                    paddingTop: "6px",
                    lineHeight: "1.5",
                  }}
                >
                  {p.rosa.length > 0 ? (
                    p.rosa.map((g, idx) => (
                      <span
                        key={idx}
                        style={{ marginRight: "6px", display: "inline-block" }}
                      >
                        <span
                          style={{
                            color: COLORI_RUOLO[g.ruolo] || "#fff",
                            fontWeight: "600",
                          }}
                        >
                          [{g.ruolo}] {g.nome}
                        </span>
                        <span style={{ color: "#10b981", fontWeight: "bold" }}>
                          {" "}
                          ({g.prezzo})
                        </span>
                        {idx < p.rosa.length - 1 ? " • " : ""}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: "#475569", fontStyle: "italic" }}>
                      Nessun giocatore acquistato
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <h2>🔍 Database Giocatori Online</h2>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Cerca..."
            value={ricercaNome}
            onChange={(e) => setRicercaNome(e.target.value)}
            className="input-field"
            style={{ flex: 1 }}
          />
          <select
            value={filtroRuolo}
            onChange={(e) => setFiltroRuolo(e.target.value)}
            className="select-field"
          >
            <option value="TUTTI">Tutti</option>
            <option value="P">P</option>
            <option value="D">D</option>
            <option value="C">C</option>
            <option value="A">A</option>
          </select>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "10px",
            alignItems: "center",
          }}
        >
          <span>Inizia l'ordine alfabetico dalla lettera:</span>
          <select
            value={letteraInizio}
            onChange={(e) => setLetteraInizio(e.target.value)}
            className="select-field"
          >
            {ALFABETO.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {giocatoriFiltrati.length === 0 ? (
          <div className="alert-box">
            Nessun giocatore corrisponde ai filtri.
          </div>
        ) : (
          giocatoriFiltrati.map((g) => (
            <div
              key={g.id}
              className="player-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #334155",
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
          ))
        )}
      </div>
    </div>
  );
}
