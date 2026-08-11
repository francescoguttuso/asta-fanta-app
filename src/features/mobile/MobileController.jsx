import { useState } from "react";

import { ROLE_LIMITS } from "@/data/auctionDefaults";

import { placeBid, requestAuctionStop } from "../auction/auctionActions";

import { useAuctionSessionContext } from "../auction/context/useAuctionContexts";

import BidHistory from "./components/BidHistory";
import MobileAuctionPanel from "./components/MobileAuctionPanel";
import TeamSelector from "./components/TeamSelector";

const SAVED_TEAM_KEY = "fantaAstaTeamId";

export default function MobileController() {
  const {
    partecipanti,
    giocatoreInAsta,
    offertaCorrente,
    timer,
    isTimerStarted,
    isPaused,
    stopChiamatoDa,
    storicoOfferte,
    stopTimer,
    ultimoAcquisto,
    docRef,
  } = useAuctionSessionContext();

  // =====================================================
  // SQUADRA SALVATA
  // =====================================================

  const [mioId, setMioId] = useState(() => {
    return localStorage.getItem(SAVED_TEAM_KEY) || "";
  });

  const [showTeamSelector, setShowTeamSelector] = useState(
    () => !localStorage.getItem(SAVED_TEAM_KEY),
  );

  // =====================================================
  // SQUADRA SELEZIONATA
  // =====================================================

  const utenteSelezionato = partecipanti.find(
    (participant) => participant.id === parseInt(mioId),
  );

  // =====================================================
  // CAMBIO SQUADRA
  // =====================================================

  const handleTeamChange = (value) => {
    setMioId(value);

    if (value) {
      localStorage.setItem(SAVED_TEAM_KEY, value);

      setShowTeamSelector(false);
    }
  };

  // =====================================================
  // CAMBIA SQUADRA
  // =====================================================

  const cambiaSquadra = () => {
    setShowTeamSelector(true);
  };

  // =====================================================
  // OFFERTA MOBILE
  // =====================================================

  const faiOffertaMobile = async (incremento = 1) => {
    if (!mioId) {
      return alert("Seleziona prima la tua squadra!");
    }

    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) {
      return;
    }

    // ================================================
    // CONTROLLO REPARTO
    // ================================================

    const utenteCorrente = partecipanti.find(
      (participant) => participant.id === parseInt(mioId),
    );

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

    // ================================================
    // INVIO OFFERTA
    // ================================================

    try {
      await placeBid({
        docRef,

        bidderId: mioId,

        bidderName: utenteCorrente?.nome || "Squadra",

        increment: incremento,
      });
    } catch (err) {
      console.error("Errore rilancio mobile:", err);
    }
  };

  // =====================================================
  // STOP MOBILE
  // =====================================================

  const fermaAstaMobile = async () => {
    if (!mioId) {
      return alert("Seleziona prima la tua squadra!");
    }

    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) {
      return;
    }

    const utenteCorrente = partecipanti.find(
      (participant) => participant.id === parseInt(mioId),
    );

    if (!utenteCorrente) {
      return;
    }

    const stopRimanenti = utenteCorrente.stopDisponibili ?? 2;

    if (stopRimanenti <= 0) {
      alert("⛔ Hai esaurito i 2 stop a tua disposizione!");

      return;
    }

    try {
      await requestAuctionStop({
        docRef,

        participantId: parseInt(mioId),

        participantName: utenteCorrente.nome,

        participants: partecipanti,

        timer,
      });
    } catch (err) {
      console.error("Errore attivazione STOP:", err);
    }
  };

  // =====================================================
  // STOP RIMANENTI
  // =====================================================

  const stopRimanentiSelezionato = utenteSelezionato
    ? (utenteSelezionato.stopDisponibili ?? 2)
    : 2;

  // =====================================================
  // SCHERMATA SELEZIONE SQUADRA
  // =====================================================

  if (showTeamSelector || !mioId) {
    return (
      <div
        className="container mobile-container"
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          padding: "20px 15px",
        }}
      >
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "25px 20px",
          }}
        >
          <div
            style={{
              fontSize: "2.5rem",
              marginBottom: "10px",
            }}
          >
            ⚽
          </div>

          <h2
            style={{
              color: "#38bdf8",
              marginBottom: "8px",
            }}
          >
            Fanta Asta
          </h2>

          <p
            style={{
              color: "#94a3b8",
              marginBottom: "20px",
            }}
          >
            Seleziona la tua squadra per entrare nell'asta.
          </p>

          <TeamSelector
            participants={partecipanti}
            selectedTeamId={mioId}
            selectedTeam={utenteSelezionato}
            remainingStops={stopRimanentiSelezionato}
            onTeamChange={handleTeamChange}
          />
        </div>
      </div>
    );
  }

  // =====================================================
  // CONTROLLER ASTA
  // =====================================================

  return (
    <div
      className="container mobile-container"
      style={{
        maxWidth: "520px",
        margin: "0 auto",
        padding: "10px 12px 25px",
      }}
    >
      {/* ==============================================
          TESTATA SQUADRA
      ============================================== */}

      <div
        className="card"
        style={{
          padding: "10px 14px",
          marginBottom: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            La tua squadra
          </div>

          <div
            style={{
              color: "#38bdf8",
              fontSize: "1.15rem",
              fontWeight: "800",
              marginTop: "2px",
            }}
          >
            🟢 {utenteSelezionato?.nome}
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <div
            style={{
              color: "#94a3b8",
              fontSize: "0.7rem",
            }}
          >
            CREDITI
          </div>

          <strong
            style={{
              color: "#10b981",
              fontSize: "1.1rem",
            }}
          >
            {utenteSelezionato?.crediti} FM
          </strong>
        </div>

        <button
          type="button"
          onClick={cambiaSquadra}
          title="Cambia squadra"
          style={{
            border: "none",
            background: "transparent",
            color: "#94a3b8",
            fontSize: "1.4rem",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          ⋮
        </button>
      </div>

      {/* ==============================================
          ASTA
      ============================================== */}

      <MobileAuctionPanel
        player={giocatoreInAsta}
        currentBid={offertaCorrente}
        timer={timer}
        isTimerStarted={isTimerStarted}
        isPaused={isPaused}
        stopCalledBy={stopChiamatoDa}
        stopTimer={stopTimer}
        selectedTeamId={mioId}
        remainingStops={stopRimanentiSelezionato}
        onBid={faiOffertaMobile}
        onStop={fermaAstaMobile}
        lastPurchase={ultimoAcquisto}
      />

      {/* ==============================================
          STORICO OFFERTE
      ============================================== */}

      <BidHistory bids={storicoOfferte} />
    </div>
  );
}
