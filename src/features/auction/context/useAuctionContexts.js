import { useContext } from "react";
import {
  AdminAuctionContext,
  AuctionSessionContext,
} from "./auctionContexts";

const useRequiredContext = (context, hookName, providerName) => {
  const value = useContext(context);

  if (!value) {
    throw new Error(`${hookName} deve essere usato dentro ${providerName}`);
  }

  return value;
};

export const useAuctionSessionContext = () =>
  useRequiredContext(
    AuctionSessionContext,
    "useAuctionSessionContext",
    "AuctionSessionProvider",
  );

export const useAdminAuctionContext = () =>
  useRequiredContext(
    AdminAuctionContext,
    "useAdminAuctionContext",
    "AdminAuctionProvider",
  );
