import { useState } from 'react';
import { ROLE_LIMITS } from '@/data/auctionDefaults';
import { placeBid, requestAuctionStop } from '../auction/auctionActions';
import { useAuctionSessionContext } from '../auction/context/useAuctionContexts';
import BidHistory from './components/BidHistory';
import MobileAuctionPanel from './components/MobileAuctionPanel';
import TeamSelector from './components/TeamSelector';

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
    docRef,
  } = useAuctionSessionContext();
  const [mioId, setMioId] = useState('');

  const faiOffertaMobile = async (incremento = 1) => {
    if (!mioId) return alert('Seleziona prima la tua squadra!');
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const utenteCorrente = partecipanti.find((p) => p.id === parseInt(mioId));
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

    try {
      await placeBid({
        docRef,
        bidderId: mioId,
        bidderName: utenteCorrente?.nome || 'Squadra',
        increment: incremento,
      });
    } catch (err) {
      console.error('Errore rilancio mobile: ', err);
    }
  };

  const fermaAstaMobile = async () => {
    if (!mioId) return alert('Seleziona prima la tua squadra!');
    if (!giocatoreInAsta || !isTimerStarted || timer === 0 || isPaused) return;

    const utenteCorrente = partecipanti.find((p) => p.id === parseInt(mioId));
    if (!utenteCorrente) return;

    const stopRimanenti = utenteCorrente.stopDisponibili ?? 2;
    if (stopRimanenti <= 0) {
      alert('⛔ Hai esaurito i 2 stop a tua disposizione!');
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
      console.error('Errore attivazione STOP: ', err);
    }
  };

  const utenteSelezionato = partecipanti.find((p) => p.id === parseInt(mioId));
  const stopRimanentiSelezionato = utenteSelezionato
    ? (utenteSelezionato.stopDisponibili ?? 2)
    : 2;

  return (
    <div className='container mobile-container'>
      <h2 style={{ textAlign: 'center', fontSize: '1.4rem' }}>
        📱 Controller Fanta Squadra
      </h2>

      <TeamSelector
        participants={partecipanti}
        selectedTeamId={mioId}
        selectedTeam={utenteSelezionato}
        remainingStops={stopRimanentiSelezionato}
        onTeamChange={setMioId}
      />

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
      />

      <BidHistory bids={storicoOfferte} />
    </div>
  );
}
