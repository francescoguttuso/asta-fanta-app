import AdminAuctionPage from "./features/auction/AdminAuctionPage";
import AuctionSessionProvider from "./features/auction/context/AuctionSessionProvider";
import MobileController from "./features/mobile/MobileController";
import "./App.css";

export default function App() {
  const isMobileView =
    new URLSearchParams(window.location.search).get("mobile") === "true";

  return (
    <AuctionSessionProvider isMobileView={isMobileView}>
      {isMobileView ? <MobileController /> : <AdminAuctionPage />}
    </AuctionSessionProvider>
  );
}
