import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { INITIAL_PARTICIPANTS, INITIAL_PLAYERS } from '@/data/auctionDefaults';
import { STOP_DURATION_MS, getRemainingSeconds } from '@/utils/timerUtils';
import {
  getUnassignedPlayers,
  normalizePlayer,
  sortPlayersAlphabetically,
} from '@/utils/playerUtils';
import { resumeAuctionAfterStop, saveAuctionSession } from '../auctionActions';

const AUCTION_SESSION_REF = doc(db, 'asta_fantacalcio', 'sessione_asta');

export default function useAuctionSession({ isMobileView }) {
  const [giocatori, setGiocatori] = useState(INITIAL_PLAYERS);
  const [partecipanti, setPartecipanti] = useState(INITIAL_PARTICIPANTS);
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
  const [timerEndsAt, setTimerEndsAt] = useState(null);
  const [timerStartedAt, setTimerStartedAt] = useState(null);
  const [stopTimer, setStopTimer] = useState(30);
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [repairMarketOpen, setRepairMarketOpen] = useState(false);
  const [repairMarketInitialRosters, setRepairMarketInitialRosters] = useState(null);
  const [repairMarketOpenedAt, setRepairMarketOpenedAt] = useState(null);

  const currentSessionRef = useRef(null);
  currentSessionRef.current = {
    players: giocatori,
    participants: partecipanti,
    configMode: isConfigMode,
    playerInAuction: giocatoreInAsta,
    currentBid: offertaCorrente,
    timerStarted: isTimerStarted,
    lastBidderId: ultimoOfferenteId,
    paused: isPaused,
    stopCalledBy: stopChiamatoDa,
    stopStartedAt: stopIniziatoAt,
    lastPurchase: ultimoAcquisto,
    bidHistory: storicoOfferte,
    timer,
    timerEndsAt,
    timerStartedAt,
    pendingSwitch,
    repairMarketOpen,
    repairMarketInitialRosters,
    repairMarketOpenedAt,
  };

  const saveSession = useCallback(async (changes = {}) => {
    const currentSession = currentSessionRef.current;
    const nextSession = { ...currentSession, ...changes };
    const nextTimerStarted = nextSession.timerStarted;

    try {
      await saveAuctionSession({
        docRef: AUCTION_SESSION_REF,
        ...nextSession,
        timerStarted: nextTimerStarted,
        timerEndsAt:
          nextTimerStarted && !nextSession.paused
            ? (changes.endsAt ?? nextSession.timerEndsAt)
            : null,
        timerStartedAt:
          nextTimerStarted && !nextSession.paused
            ? (changes.timerStartedAt ?? nextSession.timerStartedAt)
            : null,
      });
    } catch (err) {
      console.error('Errore nel salvataggio su Firestore: ', err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(AUCTION_SESSION_REF, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const partecipantiParsed = data.partecipanti || INITIAL_PARTICIPANTS;

        // INVARIANTE DEL LISTONE: qui dentro devono esserci soltanto i
        // giocatori non assegnati. Uniamo il catalogo locale al listone
        // salvato così possiamo recuperare eventuali giocatori disponibili
        // mancanti da vecchie sessioni, ma filtriamo sempre quelli presenti
        // nelle rose.
        const catalogoById = new Map(
          [...(INITIAL_PLAYERS || []), ...(data.giocatori || [])].map((player) => [
            String(player.id),
            normalizePlayer(player),
          ]),
        );
        const giocatoriDisponibili = getUnassignedPlayers(
          Array.from(catalogoById.values()),
          partecipantiParsed,
        );

        setGiocatori(giocatoriDisponibili);
        setPartecipanti(partecipantiParsed);
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
        setPendingSwitch(data.pendingSwitch || null);

        // L'Asta Riparazione deve partire DISATTIVATA alla prima
        // inizializzazione della nuova gestione. Dopo questa inizializzazione
        // lo stato viene invece persistito normalmente, così un semplice
        // reload non interrompe una sessione di riparazione già aperta.
        const repairMarketInitialized = data.repairMarketInitialized === true;
        const repairMarketIsOpen = repairMarketInitialized
          ? Boolean(data.repairMarketOpen)
          : false;

        setRepairMarketOpen(repairMarketIsOpen);
        setRepairMarketInitialRosters(
          repairMarketInitialized ? data.repairMarketInitialRosters || null : null,
        );
        setRepairMarketOpenedAt(
          repairMarketInitialized ? data.repairMarketOpenedAt || null : null,
        );

        if (!repairMarketInitialized) {
          saveSession({
            repairMarketOpen: false,
            repairMarketInitialRosters: null,
            repairMarketOpenedAt: null,
            repairMarketInitialized: true,
          });
        }
        setTimerStartedAt(data.timerStartedAt || null);
        setStoricoOfferte(data.storicoOfferte || []);

        const timerSalvato = data.timer !== undefined ? data.timer : 10;
        setTimer(timerSalvato);
        // Una sola scadenza condivisa: usiamo sempre timerEndsAt scritto dal Server.
        // Non ricostruiamo la scadenza da timerStartedAt, perché introdurrebbe
        // un riferimento temporale diverso tra Server e Client.
        setTimerEndsAt(
          data.timerEndsAt ||
            (data.isTimerStarted && !data.isPaused && timerSalvato > 0
              ? Date.now() + timerSalvato * 1000
              : null),
        );
      } else {
        saveSession({
          players: INITIAL_PLAYERS,
          participants: INITIAL_PARTICIPANTS,
          configMode: true,
          playerInAuction: null,
          currentBid: 0,
          timerStarted: false,
          lastBidderId: null,
          paused: false,
          stopCalledBy: null,
          stopStartedAt: null,
          lastPurchase: null,
          bidHistory: [],
          pendingSwitch: null,
          repairMarketOpen: false,
          repairMarketInitialRosters: null,
          repairMarketOpenedAt: null,
          repairMarketInitialized: true,
          timer: 10,
          timerEndsAt: null,
          timerStartedAt: null,
        });
      }
    });

    return unsubscribe;
  }, [saveSession]);

  useEffect(() => {
    if (!giocatoreInAsta || !isTimerStarted || isPaused || !timerEndsAt) {
      return;
    }

    const aggiornaTimer = () => {
      // Il valore salvato dal Server e' il limite superiore autorevole del
      // countdown. Evita che un timestamp locale/Firestore leggermente
      // anticipato faccia visualizzare 11 quando l'asta e' partita da 10.
      // Manteniamo getRemainingSeconds (ceil) per non ripristinare il vecchio
      // salto 3 -> 0 negli ultimi secondi.
      setTimer((currentTimer) =>
        Math.min(currentTimer > 0 ? currentTimer : 10, getRemainingSeconds(timerEndsAt)),
      );
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
        setStopTimer(Math.max(0, 30 - trascorsi));
      };

      aggiornaTimerStop();
      interval = setInterval(aggiornaTimerStop, 1000);

      if (!isMobileView) {
        const trascorsiMs = Date.now() - stopIniziatoAt;
        const rimastiMs = Math.max(0, STOP_DURATION_MS - trascorsiMs);

        timeout = setTimeout(async () => {
          try {
            await resumeAuctionAfterStop({
              docRef: AUCTION_SESSION_REF,
              stopStartedAt: stopIniziatoAt,
            });
          } catch (error) {
            console.error(
              'Errore nello sblocco automatico dello STOP: ',
              error,
            );
          }
        }, rimastiMs);
      }
    } else {
      setStopTimer(30);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isPaused, stopIniziatoAt, isMobileView]);

  return {
    docRef: AUCTION_SESSION_REF,
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
    pendingSwitch,
    repairMarketOpen,
    repairMarketInitialRosters,
    saveSession,
  };
}
