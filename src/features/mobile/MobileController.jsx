import { useState } from "react";

import { ROLE_LIMITS } from "@/data/auctionDefaults";

import { placeBid, requestAuctionStop, completeContextualSwitch } from "../auction/auctionActions";

import { useAuctionSessionContext } from "../auction/context/useAuctionContexts";

import BidHistory from "./components/BidHistory";
import MobileAuctionPanel from "./components/MobileAuctionPanel";
import TeamSelector from "./components/TeamSelector";
import FantaSchedinaMobile from "../schedina/FantaSchedinaMobile";
import HighlanderMobile from "../highlander/HighlanderMobile";

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
    pendingSwitch,
    docRef,
  } = useAuctionSessionContext();

  // =====================================================
  // SQUADRA SALVATA
  // =====================================================

  const [mioId, setMioId] = useState(() => {
    return localStorage.getItem(SAVED_TEAM_KEY) || "";
  });

  const [showTeamSelector, setShowTeamSelector] = useState(true);

  const [vistaMobile, setVistaMobile] = useState("asta");

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
    // La selezione non chiude più automaticamente la schermata:
    // serve una conferma esplicita con il pulsante "SELEZIONA SQUADRA".
    setMioId(value);
  };

  const confermaSquadra = () => {
    if (!mioId) {
      return;
    }

    localStorage.setItem(SAVED_TEAM_KEY, mioId);
    setShowTeamSelector(false);
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

    const utenteCorrente = partecipanti.find(
      (participant) => participant.id === parseInt(mioId),
    );

    if (!utenteCorrente) {
      return;
    }

    // Il fatto che il reparto sia pieno NON impedisce di partecipare:
    // il taglio avverrà solo dopo l'aggiudicazione.
    // Durante l'asta il limite è invece il budget sostenibile.
    const ruoloCorrente = giocatoreInAsta.ruolo;
    const crediti = Math.max(0, Number(utenteCorrente.crediti || 0));
    const giocatoriRuolo = utenteCorrente.rosa.filter(
      (g) => String(g.ruolo) === String(ruoloCorrente),
    );

    const roleLimit = ROLE_LIMITS[ruoloCorrente] || 0;
    const ruoloPieno =
      roleLimit > 0 && giocatoriRuolo.length >= roleLimit;

    const valoreMassimoDaTagliare = ruoloPieno
      ? giocatoriRuolo.reduce(
          (max, giocatore) =>
            Math.max(max, Number(giocatore.prezzo || 0)),
          0,
        )
      : 0;

    const massimoOfferta = crediti + valoreMassimoDaTagliare;
    const prossimaOfferta =
      Number(offertaCorrente || 0) + Number(incremento || 0);

    if (prossimaOfferta > massimoOfferta) {
      alert(
        `⛔ Offerta non sostenibile. Massimo consentito: ${massimoOfferta} FM.`,
      );
      return;
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
  // TAGLIO CONTESTUALE
  // =====================================================

  const gestisciSwitch = async (candidateId) => {
    if (!mioId || !pendingSwitch) return;

    try {
      await completeContextualSwitch({ docRef, candidateId });
    } catch (err) {
      console.error("Errore completamento taglio contestuale:", err);
      alert(err?.message || "Errore durante lo svincolo del giocatore.");
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

  const MobileTopHeader = () => (
    <div className="mobile-top-header">
      <div className="mobile-header-spacer" aria-hidden="true" />
      <img
        src="/images/fantariggio-logo.png"
        alt="FantaRiggio Fantacalcio"
        className="mobile-logo"
      />
      <div className="mobile-header-spacer" aria-hidden="true" />
    </div>
  );

  const MobileNavigation = () => (
    <div
      style={{
        width: "100%",
        maxWidth: "520px",
        margin: "0 auto",
        boxSizing: "border-box",
        padding: "0 12px",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "6px",
          padding: "8px 0",
          boxSizing: "border-box",
        }}
      >
        {[
          ["asta", "🔨 ASTA"],
          ["schedina", "🎟️ SCHEDINA"],
          ["highlander", "🏆 HIGHLANDER"],
        ].map(([view, label]) => (
          <button
            key={view}
            type="button"
            className={`mobile-nav-button ${vistaMobile === view ? "active" : ""}`}
            onClick={() => setVistaMobile(view)}
            style={{
              width: "100%",
              minWidth: 0,
              border: "0",
              borderRadius: "9px",
              padding: "9px 4px",
              background: vistaMobile === view ? "#24105a" : "#16083d",
              color: vistaMobile === view ? "#38bdf8" : "#cbd5e1",
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  const MobileScreenHeader = ({ children }) => (
    <div style={{ width: "100%" }}>
      <MobileTopHeader />
      <MobileNavigation />
      {children}
    </div>
  );

  // =====================================================
  // SCHERMATA SELEZIONE SQUADRA
  // =====================================================

  if (showTeamSelector || !mioId) {
    return (
      <div
        className="container mobile-container mobile-selection-screen"
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          padding: "14px 15px 28px",
        }}
      >
        <div className="mobile-selection-header">
          <MobileTopHeader />
        </div>

        <div
          className="card mobile-selection-card"
          style={{
            textAlign: "center",
          }}
        >
          <p
            className="mobile-selection-intro"
          >
            Seleziona la tua squadra per entrare nell'asta.
          </p>

          <TeamSelector
            participants={partecipanti}
            selectedTeamId={mioId}
            selectedTeam={utenteSelezionato}
            remainingStops={stopRimanentiSelezionato}
            onTeamChange={handleTeamChange}
            onConfirm={confermaSquadra}
          />
        </div>
      </div>
    );
  }

  // =====================================================
  // FANTA SCHEDINA
  // =====================================================

  if (vistaMobile === "schedina") {
    return (
      <MobileScreenHeader>
        <FantaSchedinaMobile
          docRef={docRef}
          teamId={mioId}
          teamName={utenteSelezionato?.nome || "Squadra"}
          partecipanti={partecipanti}
          onBack={() => setVistaMobile("asta")}
        />
      </MobileScreenHeader>
    );
  }

  // =====================================================
  // HIGHLANDER MOBILE
  // =====================================================

  if (vistaMobile === "highlander") {
    return (
      <MobileScreenHeader>
        <HighlanderMobile
          auctionDocRef={docRef}
          partecipanti={partecipanti}
          onBack={() => setVistaMobile("asta")}
        />
      </MobileScreenHeader>
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
        padding: "0 12px 25px",
      }}
    >
      <MobileTopHeader />
      <MobileNavigation />
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
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#38bdf8",
              fontSize: "1.15rem",
              fontWeight: "800",
              marginTop: "2px",
            }}
          >
            <span>🟢 {utenteSelezionato?.nome}</span>
            <button
              type="button"
              className="mobile-inline-team-menu"
              aria-label="Cambia squadra"
              title="Cambia squadra"
              onClick={() => setShowTeamSelector(true)}
            >
              ⋮
            </button>
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
        stopStartedAt={stopIniziatoAt}
        selectedTeamId={mioId}
        remainingStops={stopRimanentiSelezionato}
        onBid={faiOffertaMobile}
        onStop={fermaAstaMobile}
        lastPurchase={ultimoAcquisto}
        pendingSwitch={pendingSwitch}
        selectedParticipant={utenteSelezionato}
        onSwitch={gestisciSwitch}
      />

      {/* ==============================================
          STORICO OFFERTE
      ============================================== */}

      <BidHistory bids={storicoOfferte} />

    </div>
  );
}
