import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import {
  INITIAL_PARTICIPANTS,
  INITIAL_PLAYERS,
} from "../../../data/auctionDefaults";
import {
  STOP_DURATION_MS,
  getRemainingSeconds,
} from "../../../timerUtils";
import {
  normalizePlayer,
  sortPlayersAlphabetically,
} from "../../../utils/playerUtils";

const AUCTION_SESSION_REF = doc(
  db,
  "asta_fantacalcio",
  "sessione_asta",
);

const withDefault = (value, fallback) =>
  value === undefined ? fallback : value;

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
  const [stopTimer, setStopTimer] = useState(30);

  const currentSessionRef = useRef(null);
  currentSessionRef.current = {
    isTimerStarted,
    ultimoOfferenteId,
    ultimoAcquisto,
    storicoOfferte,
    timer,
    timerEndsAt,
  };

  const salvaSuFirebase = useCallback(
    async (
      nuoviG,
      nuoviP,
      configMode,
      gInAsta,
      offerta,
      timerStarted,
      offerenteId,
      paused = false,
      stopDa = null,
      stopTime = null,
      ultimoAcq,
      storico,
      fineTimer,
    ) => {
      const currentSession = currentSessionRef.current;
      const nextTimerStarted = withDefault(
        timerStarted,
        currentSession.isTimerStarted,
      );

      try {
        await setDoc(AUCTION_SESSION_REF, {
          giocatori: sortPlayersAlphabetically(nuoviG),
          partecipanti: nuoviP,
          isConfigMode: configMode,
          giocatoreInAsta: gInAsta,
          offertaCorrente: offerta,
          isTimerStarted: nextTimerStarted,
          ultimoOfferenteId: withDefault(
            offerenteId,
            currentSession.ultimoOfferenteId,
          ),
          isPaused: paused,
          stopChiamatoDa: stopDa,
          stopIniziatoAt: stopTime,
          ultimoAcquisto: withDefault(
            ultimoAcq,
            currentSession.ultimoAcquisto,
          ),
          storicoOfferte: withDefault(storico, currentSession.storicoOfferte),
          timer: currentSession.timer,
          timerEndsAt:
            nextTimerStarted && !paused
              ? withDefault(fineTimer, currentSession.timerEndsAt)
              : null,
        });
      } catch (err) {
        console.error("Errore nel salvataggio su Firestore: ", err);
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(AUCTION_SESSION_REF, (snapshot) => {
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
              ? Date.now() + timerSalvato * 1000
              : null),
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

    return unsubscribe;
  }, [salvaSuFirebase]);

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
            await runTransaction(db, async (transaction) => {
              const sessionSnapshot = await transaction.get(
                AUCTION_SESSION_REF,
              );
              if (!sessionSnapshot.exists()) return;

              const sessione = sessionSnapshot.data();
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

              transaction.update(AUCTION_SESSION_REF, {
                isPaused: false,
                stopChiamatoDa: null,
                stopIniziatoAt: null,
                timerRimanenteMs: null,
                timer: Math.ceil(timerRimanenteMs / 1000),
                timerEndsAt:
                  timerRimanenteMs > 0 ? Date.now() + timerRimanenteMs : null,
              });
            });
          } catch (error) {
            console.error(
              "Errore nello sblocco automatico dello STOP: ",
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
    salvaSuFirebase,
  };
}
