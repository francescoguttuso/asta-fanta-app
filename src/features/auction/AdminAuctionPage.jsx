import { signOut } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import AppHeader from "./components/AppHeader";
import AppNavigation from "./components/AppNavigation";
import CalendarView from "./components/CalendarView";
import PlaceholderView from "./components/PlaceholderView";
import RostersView from "./components/RostersView";
import TeamConfiguration from "./components/TeamConfiguration";
import ServerDashboard from "./components/ServerDashboard";
import FantaSchedinaAdminView from "../schedina/FantaSchedinaAdminView";
import HighlanderAdminView from "../highlander/HighlanderAdminView";
import AdminAuctionProvider from "./context/AdminAuctionProvider";
import {
  useAdminAuctionContext,
  useAuctionSessionContext,
} from "./context/useAuctionContexts";

function AdminAuctionContent() {
  const { vistaCorrente, impostaModalitaConfigurazione } = useAdminAuctionContext();
  const { isConfigMode } = useAuctionSessionContext();

  return (
    <div className="server-shell-v5">
      <aside className="server-sidebar-v5">
        <div className="server-sidebar-brand-v5">
          <img src="/images/fantariggio-logo.png" alt="FantaRiggio" />
          <span>SERVER</span>
        </div>

        <AppNavigation />

        {!isConfigMode && (
          <button
            type="button"
            className="server-sidebar-settings"
            onClick={() => impostaModalitaConfigurazione(true)}
          >
            ⚙ Impostazioni squadre
          </button>
        )}

        <div className="server-sidebar-status">● Server operativo</div>

        <button
          type="button"
          className="server-sidebar-logout"
          onClick={() => signOut(auth)}
        >
          ↪ Esci
        </button>
      </aside>

      <main className={`server-main-v5 ${vistaCorrente === "rose" && !isConfigMode ? "server-main-rosters-wide" : ""}`}>
        <AppHeader />
        <div className="server-mobile-nav-v5">
          <AppNavigation />
          <button
            type="button"
            className="server-mobile-logout"
            onClick={() => signOut(auth)}
          >
            ↪ Esci
          </button>
        </div>

        {isConfigMode ? (
          <TeamConfiguration />
        ) : vistaCorrente === "dashboard" ? (
          <ServerDashboard />
        ) : vistaCorrente === "rose" ? (
          <RostersView />
        ) : vistaCorrente === "calendario" ? (
          <CalendarView />
        ) : vistaCorrente === "schedina" ? (
          <FantaSchedinaAdminView />
        ) : vistaCorrente === "highlander" ? (
          <HighlanderAdminView />
        ) : (
          <PlaceholderView />
        )}
      </main>
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
