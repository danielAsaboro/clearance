/**
 * Full lifecycle demo — Spotr TV localnet.
 *
 * Exercises: admin setup → completed session (DB + on-chain) → player on-chain
 * flow (deposit → NFT mint → raffle → VRF → claim) → playable session.
 *
 * Usage:
 *   npm run setup-demo          (called automatically by dev-local.sh)
 *   npx tsx scripts/setup-demo.ts
 *
 * Prerequisites:
 *   - Local validator running with Spotr program + mpl-core deployed
 *   - USDC mint created on localnet
 *   - Database accessible
 *   - Env vars: DATABASE_URL, SOLANA_MINT_AUTHORITY_SECRET_KEY, USDC_MINT_ADDRESS,
 *     NEXT_PUBLIC_SOLANA_RPC_URL
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env as fallback
import { prisma } from "../src/lib/db";
import {
  initializeVault,
  adminDepositToVault,
  buildFanDepositTx,
  buildRequestRaffleTx,
  buildClaimWithRaffleTx,
  simulateVrfCallback,
} from "../src/lib/vault-claim";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, mplCore } from "@metaplex-foundation/mpl-core";
import {
  generateSigner,
  createSignerFromKeypair,
  signerIdentity,
  publicKey as toUmiPublicKey,
} from "@metaplex-foundation/umi";

// ── Config ──────────────────────────────────────────────────────────

const LIVE_SESSION_MATCHUPS = parseInt(
  process.env.VIDEOS_PER_LIVE_SESSION ?? "28"
);
const DEPOSIT_USDC = 100;
const ENTRY_FEE_USDC = parseFloat(process.env.ENTRY_FEE_USDC ?? "3.50");
const ROUND_DURATION = parseInt(process.env.VOTING_ROUND_DURATION_IN_SECONDS ?? "30");

const SAMPLE_VIDEO_URLS = [
  "https://spotr-demo.s3.amazonaws.com/videos/sample-1.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-2.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-3.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-4.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-5.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-6.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-7.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-8.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-9.mp4",
  "https://spotr-demo.s3.amazonaws.com/videos/sample-10.mp4",
];

// Player voting patterns for the completed session
// Majority vote determines the winner per matchup.
// With 3 players: 2+ votes for the same side = majority.
// Matchup majority winners: [video_a, video_a, video_b, video_b, video_a]
const PLAYER_VOTES: {
  label: string;
  votes: ("video_a" | "video_b")[];
  correct: number;
  tier: "gold" | "base" | "participation";
}[] = [
  {
    label: "Player A",
    votes: ["video_a", "video_a", "video_b", "video_b", "video_a"],
    correct: 5,
    tier: "gold",
  },
  {
    label: "Player B",
    votes: ["video_a", "video_a", "video_a", "video_b", "video_b"],
    correct: 3,
    tier: "base",
  },
  {
    label: "Player C",
    votes: ["video_b", "video_b", "video_a", "video_a", "video_b"],
    correct: 0,
    tier: "participation",
  },
];

const COMPLETED_SESSION_WINNERS: ("video_a" | "video_b")[] = [
  "video_a",
  "video_a",
  "video_b",
  "video_b",
  "video_a",
];

const COMPLETED_SESSION_MATCHUPS = COMPLETED_SESSION_WINNERS.length;

// ── Helpers ─────────────────────────────────────────────────────────

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://localhost:8899",
  "confirmed"
);

const USDC_MINT = new PublicKey(
  process.env.USDC_MINT_ADDRESS ??
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

function getAdminKeypair(): Keypair {
  const secret = process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY;
  if (!secret) throw new Error("SOLANA_MINT_AUTHORITY_SECRET_KEY not set");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

function logStep(phase: string, step: string) {
  console.log(`  [${phase}] ${step}`);
}

function getDemoVideoUrl(index: number) {
  const sampleUrl = SAMPLE_VIDEO_URLS[index % SAMPLE_VIDEO_URLS.length];
  const sampleNumber = (index % SAMPLE_VIDEO_URLS.length) + 1;
  return `${sampleUrl}?variant=${index + 1}&sample=${sampleNumber}`;
}

async function resetDemoSession(weekNumber: number, phase: string) {
  const existing = await prisma.weeklySession.findUnique({
    where: { weekNumber },
    include: {
      matchups: {
        select: {
          id: true,
          videoAId: true,
          videoBId: true,
        },
      },
    },
  });

  if (!existing) {
    return;
  }

  const matchupIds = existing.matchups.map((matchup) => matchup.id);
  const videoIds = Array.from(
    new Set(
      existing.matchups.flatMap((matchup) => [matchup.videoAId, matchup.videoBId])
    )
  );

  if (matchupIds.length > 0) {
    await prisma.vote.deleteMany({
      where: { matchupId: { in: matchupIds } },
    });
  }

  await prisma.gameResult.deleteMany({
    where: { sessionId: existing.id },
  });

  await prisma.matchup.deleteMany({
    where: { sessionId: existing.id },
  });

  await prisma.weeklySession.delete({
    where: { id: existing.id },
  });

  if (videoIds.length > 0) {
    await prisma.video.deleteMany({
      where: { id: { in: videoIds } },
    });
  }

  logStep(phase, `Reset stale demo data for week ${weekNumber} (${existing.id}).`);
}

/** Deserialize a base64 tx, have the player sign, then send. */
async function signAndSendBase64Tx(
  base64Tx: string,
  playerKeypair: Keypair
): Promise<string> {
  const txBuf = Buffer.from(base64Tx, "base64");
  const tx = Transaction.from(txBuf);
  tx.partialSign(playerKeypair);
  const rawTx = tx.serialize();
  const sig = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/** Mint USDC to a wallet (admin = mint authority). */
async function mintUsdcToWallet(
  adminKeypair: Keypair,
  recipientPubkey: PublicKey,
  amountUsdc: number
): Promise<void> {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    adminKeypair, // payer
    USDC_MINT,
    recipientPubkey
  );
  await mintTo(
    connection,
    adminKeypair, // payer
    USDC_MINT,
    ata.address,
    adminKeypair, // mint authority
    Math.round(amountUsdc * 1_000_000)
  );
}

/** Create a UMI instance pointing at localnet with admin as identity. */
function getUmiInstance(adminKeypair: Keypair) {
  const umi = createUmi(connection.rpcEndpoint, "confirmed").use(mplCore());
  const secretKey = new Uint8Array(adminKeypair.secretKey);
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const adminSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(adminSigner, true));
  return umi;
}

// ── Phase 1: Admin Setup ────────────────────────────────────────────

async function phase1_adminSetup(adminKeypair: Keypair) {
  console.log("\n  ── Phase 1: Admin Setup ──\n");

  const adminPubkey = adminKeypair.publicKey.toBase58();
  logStep("1", `Admin wallet: ${adminPubkey}`);

  const adminUser = await prisma.user.upsert({
    where: { privyId: "demo-admin-local" },
    update: { role: "admin", walletAddress: adminPubkey },
    create: {
      privyId: "demo-admin-local",
      email: "admin@spotr.local",
      displayName: "Demo Admin",
      role: "admin",
      walletAddress: adminPubkey,
      referralCode: "DEMOADM1",
      consentAccepted: true,
    },
  });
  logStep("1", `Admin user: ${adminUser.id} (${adminUser.email})`);

  return adminUser;
}

// ── Phase 2: Completed Session (Week 1) ─────────────────────────────

async function phase2_completedSession(adminUserId: string) {
  console.log("\n  ── Phase 2: Completed Session (Week 1) ──\n");

  const WEEK = 1;
  await resetDemoSession(WEEK, "2");

  // 2a. On-chain: initialize vault + deposit
  let vaultAddress: string;
  try {
    vaultAddress = await initializeVault(WEEK);
    logStep("2", `Vault PDA (week ${WEEK}): ${vaultAddress}`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      logStep("2", `Vault PDA (week ${WEEK}) already exists, continuing.`);
      const { getVaultAddress } = await import("../anchor/src/spotr-exports");
      const [pda] = getVaultAddress(WEEK);
      vaultAddress = pda.toBase58();
    } else {
      throw err;
    }
  }

  const depositTx = await adminDepositToVault(WEEK, DEPOSIT_USDC);
  logStep("2", `Deposited ${DEPOSIT_USDC} USDC → tx: ${depositTx.slice(0, 16)}...`);

  // 2b. DB: Create session (ended)
  const scheduledAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const session = await prisma.weeklySession.create({
    data: {
      weekNumber: WEEK,
      title: `Demo Session — Week ${WEEK}`,
      scheduledAt,
      status: "ended",
      vaultAddress,
    },
  });
  logStep("2", `Session: ${session.id} (status=ended)`);

  // 2c. DB: Upload demo videos + create matchups
  const videoIds: string[] = [];
  for (let i = 0; i < COMPLETED_SESSION_MATCHUPS * 2; i++) {
    const video = await prisma.video.create({
      data: {
        title: `Demo Video ${i + 1}`,
        url: getDemoVideoUrl(i),
        uploadedById: adminUserId,
      },
    });
    videoIds.push(video.id);
  }
  logStep("2", `Uploaded ${COMPLETED_SESSION_MATCHUPS * 2} demo videos.`);

  const matchupIds: string[] = [];
  for (let i = 0; i < COMPLETED_SESSION_MATCHUPS; i++) {
    const matchup = await prisma.matchup.create({
      data: {
        sessionId: session.id,
        matchupNumber: i + 1,
        videoAId: videoIds[i * 2],
        videoBId: videoIds[i * 2 + 1],
        duration: ROUND_DURATION,
      },
    });
    matchupIds.push(matchup.id);
  }
  logStep("2", `Created ${COMPLETED_SESSION_MATCHUPS} matchups.`);

  // 2d. DB: Create player users + votes + game results
  for (const player of PLAYER_VOTES) {
    const user = await prisma.user.upsert({
      where: { privyId: `demo-${player.label.toLowerCase().replace(" ", "-")}` },
      update: {},
      create: {
        privyId: `demo-${player.label.toLowerCase().replace(" ", "-")}`,
        displayName: `Demo ${player.label}`,
        role: "player",
        referralCode: `DEMO${player.label.replace(" ", "").toUpperCase()}`,
        consentAccepted: true,
      },
    });

    // Create votes
    for (let i = 0; i < COMPLETED_SESSION_MATCHUPS; i++) {
      await prisma.vote.upsert({
        where: { userId_matchupId: { userId: user.id, matchupId: matchupIds[i] } },
        update: {},
        create: {
          userId: user.id,
          matchupId: matchupIds[i],
          decision: player.votes[i],
        },
      });
    }

    // Create game result with tier
    await prisma.gameResult.upsert({
      where: { userId_sessionId: { userId: user.id, sessionId: session.id } },
      update: {},
      create: {
        userId: user.id,
        sessionId: session.id,
        totalVotes: COMPLETED_SESSION_MATCHUPS,
        correctVotes: player.correct,
        tier: player.tier,
      },
    });

    logStep(
      "2",
      `${player.label}: ${player.correct}/${COMPLETED_SESSION_MATCHUPS} correct → ${player.tier} (user: ${user.id})`
    );
  }

  // 2e. Set majority winners on matchups
  // Majority: video_a wins matchups 1,2,5; video_b wins matchups 3,4
  for (let i = 0; i < COMPLETED_SESSION_MATCHUPS; i++) {
    const matchup = await prisma.matchup.findFirst({
      where: { sessionId: session.id, matchupNumber: i + 1 },
    });
    if (matchup) {
      const winningVideoId =
        COMPLETED_SESSION_WINNERS[i] === "video_a"
          ? matchup.videoAId
          : matchup.videoBId;
      await prisma.matchup.update({
        where: { id: matchup.id },
        data: { winningVideoId },
      });
    }
  }
  logStep(
    "2",
    `Set majority winners: ${COMPLETED_SESSION_WINNERS.map((v) =>
      v.toUpperCase().replace("VIDEO_", "")
    ).join(",")}`
  );

  return session;
}

// ── Phase 3: On-Chain Player Flow (Player A, Gold Tier) ──────────────

async function phase3_onChainPlayerFlow(adminKeypair: Keypair) {
  console.log("\n  ── Phase 3: On-Chain Player Flow (Player A, Gold) ──\n");

  const WEEK = 1;

  // Check if Player A already claimed (skip if re-run)
  const playerAUser = await prisma.user.findUnique({
    where: { privyId: "demo-player-a" },
  });
  if (!playerAUser) {
    logStep("3", "Player A user not found — skipping on-chain flow.");
    return null;
  }

  const playerAResult = await prisma.gameResult.findFirst({
    where: { userId: playerAUser.id },
    include: { session: true },
  });
  if (!playerAResult) {
    logStep("3", "Player A game result not found — skipping on-chain flow.");
    return null;
  }
  if (playerAResult.usdcClaimed) {
    logStep("3", "Player A already claimed. Skipping on-chain flow.");
    return {
      playerPubkey: playerAUser.walletAddress ?? "unknown",
      nftAsset: playerAResult.nftTokenId ?? "unknown",
      rewardAmount: playerAResult.rewardAmount,
    };
  }

  // Generate a local keypair for Player A
  const playerKeypair = Keypair.generate();
  const playerPubkey = playerKeypair.publicKey;
  logStep("3", `Player A keypair: ${playerPubkey.toBase58()}`);

  // Update Player A's wallet address in DB
  await prisma.user.update({
    where: { id: playerAUser.id },
    data: { walletAddress: playerPubkey.toBase58() },
  });

  // 3a. Airdrop SOL to player
  logStep("3", "Airdropping 2 SOL to player...");
  const airdropSig = await connection.requestAirdrop(
    playerPubkey,
    2 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSig, "confirmed");
  logStep("3", `Airdrop tx: ${airdropSig.slice(0, 16)}...`);

  // 3b. Mint USDC to player
  logStep("3", "Minting 10 USDC to player...");
  await mintUsdcToWallet(adminKeypair, playerPubkey, 10);
  logStep("3", "Player has 10 USDC.");

  // 3c. player deposit (3.50 USDC entry fee)
  logStep("3", `Player deposit: ${ENTRY_FEE_USDC} USDC...`);
  const depositBase64 = await buildFanDepositTx({
    fanWalletAddress: playerPubkey.toBase58(),
    sessionWeekNumber: WEEK,
    amountUsdc: ENTRY_FEE_USDC,
  });
  const depositSig = await signAndSendBase64Tx(depositBase64, playerKeypair);
  logStep("3", `fan_deposit tx: ${depositSig.slice(0, 16)}...`);

  // 3d. Mint NFT via UMI (owner = player, updateAuthority = admin)
  logStep("3", "Minting NFT (Metaplex Core)...");
  const umi = getUmiInstance(adminKeypair);
  const asset = generateSigner(umi);
  await create(umi, {
    asset,
    name: "Spotr TV Blind Box — Week 1",
    uri: "https://spotr.tv/metadata/week1.json",
    owner: toUmiPublicKey(playerPubkey.toBase58()),
    updateAuthority: toUmiPublicKey(adminKeypair.publicKey.toBase58()),
  }).sendAndConfirm(umi);
  const nftAssetAddress = asset.publicKey.toString();
  logStep("3", `NFT asset: ${nftAssetAddress}`);

  // Update GameResult with NFT info
  await prisma.gameResult.update({
    where: { id: playerAResult.id },
    data: {
      nftMinted: true,
      nftTokenId: nftAssetAddress,
      walletAddress: playerPubkey.toBase58(),
    },
  });

  // 3e. request_raffle (tier=2 → gold)
  logStep("3", "Requesting raffle (tier=2, gold)...");
  const raffleBase64 = await buildRequestRaffleTx({
    fanWalletAddress: playerPubkey.toBase58(),
    sessionWeekNumber: WEEK,
    tier: 2, // gold
  });
  const raffleSig = await signAndSendBase64Tx(raffleBase64, playerKeypair);
  logStep("3", `request_raffle tx: ${raffleSig.slice(0, 16)}...`);

  // 3f. VRF callback (randomness[0]=0 → guaranteed high payout = $3.50)
  logStep("3", "Simulating VRF callback (randomness[0]=0 → high payout)...");
  const randomness = new Array(32).fill(0);
  const rewardUsdc = await simulateVrfCallback(
    playerPubkey.toBase58(),
    WEEK,
    randomness
  );
  logStep("3", `VRF resolved: reward = $${rewardUsdc.toFixed(2)} USDC`);

  // Update GameResult with raffle result
  await prisma.gameResult.update({
    where: { id: playerAResult.id },
    data: {
      rewardAmount: rewardUsdc,
      nftRevealed: true,
    },
  });

  // 3g. claim_with_raffle
  logStep("3", "Claiming with raffle...");
  const claimBase64 = await buildClaimWithRaffleTx({
    userWalletAddress: playerPubkey.toBase58(),
    nftAssetAddress,
    sessionWeekNumber: WEEK,
  });
  const claimSig = await signAndSendBase64Tx(claimBase64, playerKeypair);
  logStep("3", `claim_with_raffle tx: ${claimSig.slice(0, 16)}...`);

  // Update GameResult with claim info
  await prisma.gameResult.update({
    where: { id: playerAResult.id },
    data: {
      usdcClaimed: true,
      claimTxHash: claimSig,
      claimedAt: new Date(),
    },
  });

  // 3h. Verify player USDC balance
  const playerAta = getAssociatedTokenAddressSync(USDC_MINT, playerPubkey);
  const playerAccount = await getAccount(connection, playerAta);
  const playerBalance = Number(playerAccount.amount) / 1_000_000;
  logStep("3", `Player USDC balance: $${playerBalance.toFixed(2)}`);

  return {
    playerPubkey: playerPubkey.toBase58(),
    nftAsset: nftAssetAddress,
    rewardAmount: rewardUsdc,
    claimTx: claimSig,
    playerBalance,
  };
}

// ── Phase 4: Playable Session (Week 2) ──────────────────────────────

async function phase4_playableSession(adminUserId: string) {
  console.log("\n  ── Phase 4: Playable Session (Week 2) ──\n");

  const WEEK = 2;
  await resetDemoSession(WEEK, "4");

  // 4a. On-chain: initialize vault + deposit
  let vaultAddress: string;
  try {
    vaultAddress = await initializeVault(WEEK);
    logStep("4", `Vault PDA (week ${WEEK}): ${vaultAddress}`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      logStep("4", `Vault PDA (week ${WEEK}) already exists, continuing.`);
      const { getVaultAddress } = await import("../anchor/src/spotr-exports");
      const [pda] = getVaultAddress(WEEK);
      vaultAddress = pda.toBase58();
    } else {
      throw err;
    }
  }

  const depositTx = await adminDepositToVault(WEEK, DEPOSIT_USDC);
  logStep("4", `Deposited ${DEPOSIT_USDC} USDC → tx: ${depositTx.slice(0, 16)}...`);

  // 4b. DB: Create session (scheduled, 2 min from now)
  const scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
  const session = await prisma.weeklySession.create({
    data: {
      weekNumber: WEEK,
      title: `Demo Session — Week ${WEEK}`,
      scheduledAt,
      status: "scheduled",
      vaultAddress,
    },
  });
  logStep("4", `Session: ${session.id} (status=scheduled, starts in ~2 min)`);

  // 4c. DB: Upload videos + create matchups (no winners yet — determined by majority vote)
  const videoIds: string[] = [];
  for (let i = 0; i < LIVE_SESSION_MATCHUPS * 2; i++) {
    const video = await prisma.video.create({
      data: {
        title: `Week 2 Video ${i + 1}`,
        url: getDemoVideoUrl(COMPLETED_SESSION_MATCHUPS * 2 + i),
        uploadedById: adminUserId,
      },
    });
    videoIds.push(video.id);
  }

  for (let i = 0; i < LIVE_SESSION_MATCHUPS; i++) {
    await prisma.matchup.create({
      data: {
        sessionId: session.id,
        matchupNumber: i + 1,
        videoAId: videoIds[i * 2],
        videoBId: videoIds[i * 2 + 1],
        duration: ROUND_DURATION,
      },
    });
  }
  logStep(
    "4",
    `Created ${LIVE_SESSION_MATCHUPS} matchups (no winners — ready for voting).`
  );

  return session;
}

// ── Phase 5: Print Summary ──────────────────────────────────────────

function phase5_summary(
  week1Session: { id: string; vaultAddress: string | null },
  week2Session: { id: string; vaultAddress: string | null },
  playerFlowResult: {
    playerPubkey: string;
    nftAsset: string;
    rewardAmount: number;
    claimTx?: string;
    playerBalance?: number;
  } | null
) {
  console.log("\n  ════════════════════════════════════════════════");
  console.log("  Spotr TV Demo — Full Lifecycle Complete!");
  console.log("  ════════════════════════════════════════════════\n");

  console.log("  Week 1 (completed):");
  console.log(`    Session ID:    ${week1Session.id}`);
  console.log(`    Vault:         ${week1Session.vaultAddress}`);
  console.log(`    Status:        ended (majority vote finalized)`);
  console.log(`    Players:       Player A (gold), Player B (base), Player C (participation)`);

  if (playerFlowResult) {
    console.log("\n  On-chain Player Flow (Player A):");
    console.log(`    Wallet:        ${playerFlowResult.playerPubkey}`);
    console.log(`    NFT Asset:     ${playerFlowResult.nftAsset}`);
    console.log(`    Reward:        $${playerFlowResult.rewardAmount.toFixed(2)} USDC`);
    if (playerFlowResult.claimTx) {
      console.log(`    Claim Tx:      ${playerFlowResult.claimTx}`);
    }
    if (playerFlowResult.playerBalance !== undefined) {
      console.log(`    Balance:       $${playerFlowResult.playerBalance.toFixed(2)} USDC`);
    }
  }

  console.log("\n  Week 2 (playable):");
  console.log(`    Session ID:    ${week2Session.id}`);
  console.log(`    Vault:         ${week2Session.vaultAddress}`);
  console.log(`    Status:        scheduled (~2 min from setup)`);

  console.log("\n  How to play:");
  console.log("    1. Open http://localhost:3000");
  console.log('    2. Select "local" cluster in the header dropdown');
  console.log("    3. Login with Privy");
  console.log("    4. /rewards → Player A's completed blind box (claimed)");
  console.log("    5. /arena   → Week 2 session → join → play → pick winners");
  console.log("    6. After session ends → /admin/sessions → Finalize Results");
  console.log("    7. /rewards → Open Box → Reveal → Claim\n");
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Setup Demo — Spotr TV Full Lifecycle\n");

  const adminKeypair = getAdminKeypair();

  // Phase 1
  const adminUser = await phase1_adminSetup(adminKeypair);

  // Phase 2
  const week1Session = await phase2_completedSession(adminUser.id);

  // Phase 3
  const playerFlowResult = await phase3_onChainPlayerFlow(adminKeypair);

  // Phase 4
  const week2Session = await phase4_playableSession(adminUser.id);

  // Phase 5
  phase5_summary(
    { id: week1Session.id, vaultAddress: week1Session.vaultAddress },
    { id: week2Session.id, vaultAddress: week2Session.vaultAddress },
    playerFlowResult
  );
}

main()
  .catch((err) => {
    console.error("\n  Setup failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
