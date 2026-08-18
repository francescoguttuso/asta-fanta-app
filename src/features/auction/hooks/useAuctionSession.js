import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { INITIAL_PARTICIPANTS, INITIAL_PLAYERS } from '@/data/auctionDefaults';
import { STOP_DURATION_MS, getRemainingSeconds } from '@/utils/timerUtils';
import {
  normalizePlayer,
  sortPlayersAlphabetically,
} from '@/utils/playerUtils';
import { resumeAuctionAfterStop, saveAuctionSession } from '../auctionActions';

const AUCTION_SESSION_REF = doc(db, 'asta_fantacalcio', 'sessione_asta');

export default function useAuctionSession({ isMobileView }) {
  const [giocatori, setGiocatori] = useState(INITIAL_PLAYERS);
  const [giocatoriCatalogo, setGiocatoriCatalogo] = useState(INITIAL_PLAYERS);
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
  const [stopTimer, setStopTimer] = useState(30);

  const currentSessionRef = useRef(null);
  currentSessionRef.current = {
    players: giocatori,
    playersCatalog: giocatoriCatalogo,
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
      });
    } catch (err) {
      console.error('Errore nel salvataggio su Firestore: ', err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(AUCTION_SESSION_REF, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const catalogoParsed = (
          data.giocatoriCatalogo || data.giocatori || INITIAL_PLAYERS
        ).map(normalizePlayer);

        const giocatoriParsed = (data.giocatori || catalogoParsed).map(
          normalizePlayer,
        );

        setGiocatoriCatalogo(sortPlayersAlphabetically(catalogoParsed));
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
              ? Date.now() + timerSalvato * 1000
              : null),
        );
      } else {
        saveSession({
          players: INITIAL_PLAYERS,
          playersCatalog: INITIAL_PLAYERS,
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
    giocatoriCatalogo,
    setGiocatoriCatalogo,
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
    saveSession,
  };
}
