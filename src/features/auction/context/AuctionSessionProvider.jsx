import useAuctionSession from '../hooks/useAuctionSession';
import { AuctionSessionContext } from './auctionContexts';

export default function AuctionSessionProvider({ isMobileView, children }) {
  const session = useAuctionSession({ isMobileView });

  return (
    <AuctionSessionContext value={session}>{children}</AuctionSessionContext>
  );
}
