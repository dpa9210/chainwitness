/**
 * Shares one connected wallet account across screens (Home, Capture, and
 * later Feed/Tip) so the user doesn't have to reconnect on every screen.
 * The underlying MWA session itself is still re-opened per action (that's
 * inherent to the protocol — see mwaClient.ts) but the resulting account
 * and its cached auth_token live here.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  connectWallet as mwaConnect,
  signMessage as mwaSignMessage,
  type ConnectedAccount,
} from "./mwaClient";

type WalletContextValue = {
  account: ConnectedAccount | null;
  connecting: boolean;
  connect: () => Promise<ConnectedAccount>;
  signMessage: (message: string) => Promise<Uint8Array>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const acct = await mwaConnect();
      setAccount(acct);
      return acct;
    } finally {
      setConnecting(false);
    }
  }, []);

  const signMessage = useCallback(
    async (message: string) => {
      if (!account) {
        throw new Error("Connect a wallet before signing.");
      }
      return mwaSignMessage(account, message);
    },
    [account],
  );

  const value = useMemo(
    () => ({ account, connecting, connect, signMessage }),
    [account, connecting, connect, signMessage],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
