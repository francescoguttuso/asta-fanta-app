import React, { useCallback, useEffect, useState } from "react";
import { runTransaction } from "firebase/firestore";
import { db } from "./firebaseConfig";
import MobileController from "./MobileController";
import AppHeader from "./features/auction/components/AppHeader";
import AppNavigation from "./features/auction/components/AppNavigation";
import AuctionPanel from "./features/auction/components/AuctionPanel";
import AvailablePlayers from "./features/auction/components/AvailablePlayers";
import PlaceholderView from "./features/auction/components/PlaceholderView";
import RostersView from "./features/auction/components/RostersView";
import TeamConfiguration from "./features/auction/components/TeamConfiguration";
import TeamsSummary from "./features/auction/components/TeamsSummary";
import useAuctionSession from "./features/auction/hooks/useAuctionSession";
import {
  ALPHABET,
  INITIAL_PARTICIPANTS,
  INITIAL_PLAYERS,
  INITIAL_ROLE_FILTERS,
  ROLE_LIMITS,
} from "./data/auctionDefaults";
import { AUCTION_DURATION_MS } from "./timerUtils";
import {
  filterPlayers,
  findNextPlayer,
  normalizePlayers,
} from "./utils/playerUtils";
import "./App.css";

export default function App() {
  const isMobileView =
    new URLSearchParams(window.location.search).get("mobile") === "true";
  const {
    docRef,
    giocatori,
    setGiocatori,
    partecipanti,
    setPartecipanti,
    isConfigMode,
    setIsConfigMode,
    giocatoreInAsta,
    offertaCorrente,
    isTimerStarted,
    ultimoOfferenteId,
    isPaused,
    stopChiamatoDa,
    stopIniziatoAt,
    ultimoAcquisto,
    storicoOfferte,
    timer,
    setTimer,
    stopTimer,
    salvaSuFirebase,
  } = useAuctionSession({ isMobileView });

  // 🛠️ Stato per la gestione della vista attiva (Dashboard o Rose)
  const [vistaCorrente, setVistaCorrente] = useState("dashboard");

  // Stati locali per la gestione dell'assegnazione manuale di emergenza
  const [squadraManualeId, setSquadraManualeId] = useState("");
  const [prezzoManuale, setPrezzoManuale] = useState("");

  const [filtroLettera, setFiltroLettera] = useState("TUTTE");
  const [filtriRuoliAttivi, setFiltriRuoliAttivi] = useState(
    INITIAL_ROLE_FILTERS,
  );

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

  const cambiaFiltroRuolo = (ruolo) => {
    setFiltriRuoliAttivi((filtriCorrenti) => ({
      ...filtriCorrenti,
      [ruolo]: !filtriCorrenti[ruolo],
    }));
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

  const assegnaGiocatore = useCallback(async () => {
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
  }, [
    giocatoreInAsta,
    ultimoOfferenteId,
    partecipanti,
    offertaCorrente,
    giocatori,
    filtroLettera,
    filtriRuoliAttivi,
    isConfigMode,
    salvaSuFirebase,
    setTimer,
  ]);

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
    assegnaGiocatore,
  ]);

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
        storicoOfferte={storicoOfferte}
        stopTimer={stopTimer}
        docRef={docRef}
      />
    );
  }

  return (
    <div className="container">
      <AppHeader
        onExport={esportaInExcel}
        onImport={gestisciCaricamentoJson}
        onReset={resettaTutto}
      />

      <AppNavigation
        currentView={vistaCorrente}
        onViewChange={setVistaCorrente}
      />

      <TeamConfiguration
        isConfigMode={isConfigMode}
        participants={partecipanti}
        onTeamNameChange={handleNomeSquadraChange}
        onLock={bloccaNomiSquadre}
        onUnlock={sbloccaNomiSquadre}
      />

      {/* 🛠️ Rendering condizionale in base alla vista selezionata */}
      {vistaCorrente === "dashboard" ? (
        <div className="auction-layout">
          <AuctionPanel
            player={giocatoreInAsta}
            currentBid={offertaCorrente}
            lastBidder={ultimoOfferente}
            lastBidderId={ultimoOfferenteId}
            isTimerStarted={isTimerStarted}
            isPaused={isPaused}
            stopCalledBy={stopChiamatoDa}
            stopTimer={stopTimer}
            timer={timer}
            participants={partecipanti}
            manualTeamId={squadraManualeId}
            manualPrice={prezzoManuale}
            lastPurchase={ultimoAcquisto}
            onPlayerChange={cambiaGiocatoreManuale}
            onStartTimer={avviaTimerManualmente}
            onBid={faiOfferta}
            onAssign={assegnaGiocatore}
            onManualTeamChange={setSquadraManualeId}
            onManualPriceChange={setPrezzoManuale}
            onManualAssign={assegnaGiocatoreManualmente}
          />

          <TeamsSummary participants={partecipanti} />

          <AvailablePlayers
            players={giocatoriFiltrati}
            totalPlayers={giocatori.length}
            activeRoleFilters={filtriRuoliAttivi}
            selectedLetter={filtroLettera}
            isConfigMode={isConfigMode}
            onRoleToggle={cambiaFiltroRuolo}
            onLetterChange={setFiltroLettera}
            onCallPlayer={chiamaGiocatore}
          />
        </div>
      ) : vistaCorrente === "rose" ? (
        <RostersView participants={partecipanti} />
      ) : (
        <PlaceholderView view={vistaCorrente} />
      )}
    </div>
  );
}
