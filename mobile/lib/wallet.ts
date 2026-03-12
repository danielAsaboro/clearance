import { createContext, useContext } from "react";
import { Transaction, VersionedTransaction, Connection } from "@solana/web3.js";
import { getConnection } from "./solana";

// ---------------------------------------------------------------------------
// Wallet provider types
// ---------------------------------------------------------------------------

export type WalletType = "privy" | "mwa" | null;

export interface WalletContextState {
  /** Which wallet is active */
  walletType: WalletType;
  /** Solana public key (base58) */
  publicKey: string | null;
  /** Whether wallet is ready to sign */
  connected: boolean;
  /** Sign and send a base64-encoded transaction from the API */
  signAndSend: (base64Tx: string) => Promise<string>;
  /** Connect via MWA (opens external wallet app) */
  connectMWA: () => Promise<void>;
  /** Disconnect MWA wallet */
  disconnectMWA: () => void;
  /** Whether MWA is available on this device */
  mwaAvailable: boolean;
}

export const WalletContext = createContext<WalletContextState>({
  walletType: null,
  publicKey: null,
  connected: false,
  signAndSend: async () => {
    throw new Error("Wallet not connected");
  },
  connectMWA: async () => {},
  disconnectMWA: () => {},
  mwaAvailable: false,
});

export function useWallet() {
  return useContext(WalletContext);
}

// ---------------------------------------------------------------------------
// Helper: deserialize base64 tx from API
// ---------------------------------------------------------------------------
export function deserializeTx(base64Tx: string): Transaction {
  const { Buffer } = require("@craftzdog/react-native-buffer");
  const txBuffer = Buffer.from(base64Tx, "base64");
  return Transaction.from(txBuffer);
}

// ---------------------------------------------------------------------------
// Helper: send raw signed tx and confirm
// ---------------------------------------------------------------------------
export async function sendAndConfirm(
  signed: Transaction,
  connection?: Connection
): Promise<string> {
  const conn = connection ?? getConnection();
  const signature = await conn.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}
