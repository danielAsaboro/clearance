import {
  Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import Constants from "expo-constants";
import { Buffer } from "@craftzdog/react-native-buffer";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, "confirmed");
  }
  return _connection;
}

/**
 * Decode a base64-encoded transaction returned by the API,
 * sign it with the embedded wallet, and send it.
 *
 * @param base64Tx - Base64-encoded serialized transaction from the API
 * @param signTransaction - Privy's signTransaction function
 * @returns Transaction signature
 */
export async function signAndSendTransaction(
  base64Tx: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const connection = getConnection();
  const txBuffer = Buffer.from(base64Tx, "base64");
  const transaction = Transaction.from(txBuffer);

  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/**
 * Get USDC balance for a wallet address
 */
export async function getUsdcBalance(walletAddress: string): Promise<number> {
  const { apiFetch } = await import("./api");
  const data = await apiFetch<{ balance: number }>(
    `/api/usdc/balance?wallet=${walletAddress}`
  );
  return data.balance;
}
