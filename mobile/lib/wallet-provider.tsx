import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Platform } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { Transaction } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  WalletContext,
  WalletType,
  deserializeTx,
  sendAndConfirm,
} from "./wallet";
import { getConnection } from "./solana";

const MWA_AUTH_KEY = "spotr_mwa_auth";
const MWA_PUBKEY_KEY = "spotr_mwa_pubkey";

const APP_IDENTITY = {
  name: "Spotr TV",
  uri: "https://spotr.tv",
  icon: "favicon.png",
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const privyWallet = useEmbeddedSolanaWallet();

  // MWA state
  const [mwaPublicKey, setMwaPublicKey] = useState<string | null>(null);
  const [mwaAuthToken, setMwaAuthToken] = useState<string | null>(null);
  const [mwaAvailable, setMwaAvailable] = useState(false);

  // MWA is only available on Android
  useEffect(() => {
    setMwaAvailable(Platform.OS === "android");
  }, []);

  // Restore persisted MWA session
  useEffect(() => {
    (async () => {
      const [token, pubkey] = await Promise.all([
        AsyncStorage.getItem(MWA_AUTH_KEY),
        AsyncStorage.getItem(MWA_PUBKEY_KEY),
      ]);
      if (token && pubkey) {
        setMwaAuthToken(token);
        setMwaPublicKey(pubkey);
      }
    })();
  }, []);

  // Determine active wallet type: MWA takes priority if connected
  const privyConnected =
    privyWallet.status === "connected" && privyWallet.wallets.length > 0;
  const mwaConnected = !!mwaPublicKey;

  const walletType: WalletType = mwaConnected
    ? "mwa"
    : privyConnected
      ? "privy"
      : null;

  const publicKey =
    walletType === "mwa"
      ? mwaPublicKey
      : privyConnected
        ? privyWallet.wallets[0].address
        : null;

  const connected = walletType !== null;

  // ---------------------------------------------------------------------------
  // Sign + send via Privy embedded wallet
  // ---------------------------------------------------------------------------
  const signAndSendPrivy = useCallback(
    async (base64Tx: string): Promise<string> => {
      if (privyWallet.status !== "connected" || !privyWallet.wallets[0]) {
        throw new Error("Privy wallet not connected");
      }
      const provider = await privyWallet.wallets[0].getProvider();
      const transaction = deserializeTx(base64Tx);
      const connection = getConnection();

      const { signature } = await provider.request({
        method: "signAndSendTransaction",
        params: { transaction, connection },
      });
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    [privyWallet]
  );

  // ---------------------------------------------------------------------------
  // Sign + send via MWA (external wallet)
  // ---------------------------------------------------------------------------
  const signAndSendMWA = useCallback(
    async (base64Tx: string): Promise<string> => {
      const {
        transact,
      } = require("@solana-mobile/mobile-wallet-adapter-protocol-web3js");

      const transaction = deserializeTx(base64Tx);
      const connection = getConnection();

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      const signatures: Uint8Array[] = await transact(
        async (wallet: any) => {
          // Reauthorize or authorize
          if (mwaAuthToken) {
            try {
              await wallet.reauthorize({
                auth_token: mwaAuthToken,
                identity: APP_IDENTITY,
              });
            } catch {
              const auth = await wallet.authorize({
                cluster: "devnet",
                identity: APP_IDENTITY,
              });
              await AsyncStorage.setItem(MWA_AUTH_KEY, auth.auth_token);
              setMwaAuthToken(auth.auth_token);
            }
          } else {
            const auth = await wallet.authorize({
              cluster: "devnet",
              identity: APP_IDENTITY,
            });
            await AsyncStorage.setItem(MWA_AUTH_KEY, auth.auth_token);
            setMwaAuthToken(auth.auth_token);
          }

          return await wallet.signAndSendTransactions({
            transactions: [transaction],
          });
        }
      );

      const { Buffer } = require("@craftzdog/react-native-buffer");
      const sig = Buffer.from(signatures[0]).toString("base64");
      // The MWA signAndSendTransactions returns transaction signatures
      // Convert to base58 for Solana explorer compatibility
      const bs58Sig = require("@solana/web3.js").bs58?.encode(signatures[0]);
      const finalSig = bs58Sig || sig;

      await connection.confirmTransaction(finalSig, "confirmed");
      return finalSig;
    },
    [mwaAuthToken]
  );

  // ---------------------------------------------------------------------------
  // Connect MWA
  // ---------------------------------------------------------------------------
  const connectMWA = useCallback(async () => {
    if (Platform.OS !== "android") {
      throw new Error("Mobile Wallet Adapter is only available on Android");
    }

    const {
      transact,
    } = require("@solana-mobile/mobile-wallet-adapter-protocol-web3js");

    const result = await transact(async (wallet: any) => {
      const auth = await wallet.authorize({
        cluster: "devnet",
        identity: APP_IDENTITY,
      });
      return auth;
    });

    const { PublicKey } = require("@solana/web3.js");
    // result.accounts[0].address is base64-encoded pubkey bytes
    const pubkeyBytes = Uint8Array.from(
      atob(result.accounts[0].address),
      (c: string) => c.charCodeAt(0)
    );
    const pubkey = new PublicKey(pubkeyBytes).toBase58();

    setMwaPublicKey(pubkey);
    setMwaAuthToken(result.auth_token);
    await AsyncStorage.setItem(MWA_AUTH_KEY, result.auth_token);
    await AsyncStorage.setItem(MWA_PUBKEY_KEY, pubkey);
  }, []);

  // ---------------------------------------------------------------------------
  // Disconnect MWA
  // ---------------------------------------------------------------------------
  const disconnectMWA = useCallback(() => {
    setMwaPublicKey(null);
    setMwaAuthToken(null);
    AsyncStorage.multiRemove([MWA_AUTH_KEY, MWA_PUBKEY_KEY]);
  }, []);

  // ---------------------------------------------------------------------------
  // Unified sign + send
  // ---------------------------------------------------------------------------
  const signAndSend = useCallback(
    async (base64Tx: string): Promise<string> => {
      if (walletType === "mwa") {
        return signAndSendMWA(base64Tx);
      }
      return signAndSendPrivy(base64Tx);
    },
    [walletType, signAndSendMWA, signAndSendPrivy]
  );

  const value = useMemo(
    () => ({
      walletType,
      publicKey,
      connected,
      signAndSend,
      connectMWA,
      disconnectMWA,
      mwaAvailable,
    }),
    [
      walletType,
      publicKey,
      connected,
      signAndSend,
      connectMWA,
      disconnectMWA,
      mwaAvailable,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
