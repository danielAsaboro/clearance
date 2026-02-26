"use client";

import { useMemo } from "react";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useCluster, getPrivySolanaChain } from "@/components/cluster/cluster-data-access";

const solanaConnectors = toSolanaWalletConnectors();

export default function Providers({ children }: { children: React.ReactNode }) {
  const { cluster } = useCluster();
  const solanaChain = getPrivySolanaChain(cluster);

  const config = useMemo<PrivyClientConfig>(
    () => ({
      loginMethods: ["email", "google", "tiktok", "twitter", "wallet"],
      appearance: {
        theme: "dark",
        accentColor: "#F5E642",
        logo: undefined,
      },
      embeddedWallets: {
        solana: {
          createOnLogin: "users-without-wallets",
        },
      },
      externalWallets: {
        solana: {
          connectors: solanaConnectors,
        },
      },
      solanaClusters: [
        {
          name: solanaChain,
          rpcUrl: cluster.endpoint,
        },
      ],
    }),
    [solanaChain, cluster.endpoint]
  );

  return (
    <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={config}>
      {children}
    </PrivyProvider>
  );
}
