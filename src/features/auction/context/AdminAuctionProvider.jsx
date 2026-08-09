import useAdminAuctionController from '../hooks/useAdminAuctionController';
import { AdminAuctionContext } from './auctionContexts';

export default function AdminAuctionProvider({ children }) {
  const controller = useAdminAuctionController();

  return (
    <AdminAuctionContext value={controller}>{children}</AdminAuctionContext>
  );
}
