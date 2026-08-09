import AppHeader from "./components/AppHeader";
import AppNavigation from "./components/AppNavigation";
import AuctionPanel from "./components/AuctionPanel";
import AvailablePlayers from "./components/AvailablePlayers";
import PlaceholderView from "./components/PlaceholderView";
import RostersView from "./components/RostersView";
import TeamConfiguration from "./components/TeamConfiguration";
import TeamsSummary from "./components/TeamsSummary";
import AdminAuctionProvider from "./context/AdminAuctionProvider";
import { useAdminAuctionContext } from "./context/useAuctionContexts";

function AdminAuctionContent() {
  const { vistaCorrente } = useAdminAuctionContext();

  return (
    <div className="container">
      <AppHeader />
      <AppNavigation />
      <TeamConfiguration />

      {vistaCorrente === "dashboard" ? (
        <div className="auction-layout">
          <AuctionPanel />
          <TeamsSummary />
          <AvailablePlayers />
        </div>
      ) : vistaCorrente === "rose" ? (
        <RostersView />
      ) : (
        <PlaceholderView />
      )}
    </div>
  );
}

export default function AdminAuctionPage() {
  return (
    <AdminAuctionProvider>
      <AdminAuctionContent />
    </AdminAuctionProvider>
  );
}
