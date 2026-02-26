import { SoarProgram } from "@magicblock-labs/soar-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// Use numeric values directly to avoid const enum issues with isolatedModules
const GENRE_ACTION = 2 as const;
const GAME_TYPE_WEB = 2 as const;

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL);

// Game public key — restored from env or set after initialization
let GAME_ADDRESS: PublicKey | null = process.env.SOAR_GAME_ADDRESS
  ? new PublicKey(process.env.SOAR_GAME_ADDRESS)
  : null;
let LEADERBOARD_ADDRESS: PublicKey | null = process.env.SOAR_LEADERBOARD_ADDRESS
  ? new PublicKey(process.env.SOAR_LEADERBOARD_ADDRESS)
  : null;

function getAuthority(): Keypair {
  const secretKeyEnv = process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY;
  if (!secretKeyEnv) {
    throw new Error("SOLANA_MINT_AUTHORITY_SECRET_KEY is not set");
  }
  const secretKeyArray = JSON.parse(secretKeyEnv) as number[];
  return Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
}

function getSoarClient(): SoarProgram {
  const authority = getAuthority();
  return SoarProgram.getFromConnection(connection, authority.publicKey);
}

export async function initializeLeaderboard(): Promise<{
  gameAddress: string;
  leaderboardAddress: string;
}> {
  const client = getSoarClient();
  const authority = getAuthority();
  const game = Keypair.generate();

  const { newGame, transaction: gameTransaction } =
    await client.initializeNewGame(
      game.publicKey,
      "The Clearance",
      "On-chain leaderboard for The Clearance voting sessions",
      GENRE_ACTION,
      GAME_TYPE_WEB,
      authority.publicKey, // nftMeta placeholder
      [authority.publicKey]
    );

  gameTransaction.sign(game, authority);
  await connection.sendRawTransaction(gameTransaction.serialize());

  // Add leaderboard
  const { newLeaderBoard, transaction: lbTransaction } =
    await client.addNewGameLeaderBoard(
      newGame,
      authority.publicKey,
      "Season Leaderboard",
      authority.publicKey, // nftMeta placeholder
      100, // max scores to retain
      false // scoresOrder: false = descending (highest score first)
    );

  lbTransaction.sign(authority);
  await connection.sendRawTransaction(lbTransaction.serialize());

  GAME_ADDRESS = newGame;
  LEADERBOARD_ADDRESS = newLeaderBoard;

  console.log(`[SOAR] Set env vars:\nSOAR_GAME_ADDRESS=${newGame.toBase58()}\nSOAR_LEADERBOARD_ADDRESS=${newLeaderBoard.toBase58()}`);

  return {
    gameAddress: newGame.toBase58(),
    leaderboardAddress: newLeaderBoard.toBase58(),
  };
}

export async function submitScore(
  walletAddress: string,
  score: number
): Promise<string | null> {
  try {
    const client = getSoarClient();
    const authority = getAuthority();

    if (!GAME_ADDRESS || !LEADERBOARD_ADDRESS) {
      console.error("SOAR game not initialized. Call initializeLeaderboard() first.");
      return null;
    }

    const playerPubkey = new PublicKey(walletAddress);

    // Register player if not already registered
    try {
      const { transaction: registerTx } = await client.initializePlayerAccount(
        playerPubkey,
        walletAddress.slice(0, 16),
        authority.publicKey
      );
      registerTx.sign(authority);
      await connection.sendRawTransaction(registerTx.serialize());
    } catch {
      // Player already registered — expected
    }

    // Submit score
    const { transaction: scoreTx } = await client.submitScoreToLeaderBoard(
      playerPubkey,
      authority.publicKey,
      LEADERBOARD_ADDRESS,
      new BN(score)
    );
    scoreTx.sign(authority);
    const sig = await connection.sendRawTransaction(scoreTx.serialize());
    return sig;
  } catch (error) {
    console.error("SOAR submitScore error:", error);
    return null;
  }
}

export async function getTopScores(
  limit: number = 20
): Promise<
  Array<{ wallet: string; score: number; rank: number }>
> {
  try {
    const client = getSoarClient();

    if (!LEADERBOARD_ADDRESS) {
      return [];
    }

    const scores = await client.fetchLeaderBoardTopEntriesAccount(
      LEADERBOARD_ADDRESS
    );

    if (!scores) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = ((scores as any).topScores ?? [])
      .slice(0, limit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((entry: any, idx: number) => ({
        wallet: entry.player.toBase58(),
        score: entry.entry?.score ?? 0,
        rank: idx + 1,
      }));

    return entries;
  } catch (error) {
    console.error("SOAR getTopScores error:", error);
    return [];
  }
}

export async function getPlayerAchievements(walletAddress: string) {
  try {
    const client = getSoarClient();
    const playerPubkey = new PublicKey(walletAddress);
    const playerAccount = await client.fetchPlayerAccount(
      (await client.utils.derivePlayerAddress(playerPubkey))[0]
    );
    return playerAccount;
  } catch {
    return null;
  }
}
