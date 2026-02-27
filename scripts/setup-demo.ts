/**
 * Full lifecycle demo — Clearance localnet.
 *
 * Exercises: admin setup → completed session (DB + on-chain) → fan on-chain
 * flow (deposit → NFT mint → raffle → VRF → claim) → playable session.
 *
 * Usage:
 *   npm run setup-demo          (called automatically by dev-local.sh)
 *   npx tsx scripts/setup-demo.ts
 *
 * Prerequisites:
 *   - Local validator running with Clearance program + mpl-core deployed
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

const NUM_ROUNDS = 5;
const DEPOSIT_USDC = 100;
const ENTRY_FEE_USDC = 3.5;

const SAMPLE_TIKTOK_URLS = [
  "https://www.tiktok.com/@charlidamelio/video/7000000000000000001",
  "https://www.tiktok.com/@khloekardashian/video/7000000000000000002",
  "https://www.tiktok.com/@addisonre/video/7000000000000000003",
  "https://www.tiktok.com/@bellapoarch/video/7000000000000000004",
  "https://www.tiktok.com/@zachking/video/7000000000000000005",
];

// Admin verdicts for the completed session rounds
const ADMIN_VERDICTS: ("approved" | "rejected")[] = [
  "approved",
  "approved",
  "approved",
  "rejected",
  "rejected",
];

// Fan voting patterns for the completed session
// Fan A: 5/5 correct (gold), Fan B: 3/5 correct (base), Fan C: 0/5 correct (participation)
const FAN_VOTES: {
  label: string;
  votes: ("approve" | "reject")[];
  correct: number;
  tier: "gold" | "base" | "participation";
}[] = [
  {
    label: "Fan A",
    votes: ["approve", "approve", "approve", "reject", "reject"],
    correct: 5,
    tier: "gold",
  },
  {
    label: "Fan B",
    votes: ["approve", "reject", "reject", "reject", "reject"],
    correct: 3,
    tier: "base",
  },
  {
    label: "Fan C",
    votes: ["reject", "reject", "reject", "approve", "approve"],
    correct: 0,
    tier: "participation",
  },
];

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

/** Deserialize a base64 tx, have the fan sign, then send. */
async function signAndSendBase64Tx(
  base64Tx: string,
  fanKeypair: Keypair
): Promise<string> {
  const txBuf = Buffer.from(base64Tx, "base64");
  const tx = Transaction.from(txBuf);
  tx.partialSign(fanKeypair);
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
      email: "admin@clearance.local",
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

  // Check if already exists
  const existing = await prisma.weeklySession.findUnique({
    where: { weekNumber: WEEK },
  });
  if (existing) {
    logStep("2", `Week ${WEEK} session already exists (${existing.id}). Skipping.`);
    return existing;
  }

  // 2a. On-chain: initialize vault + deposit
  let vaultAddress: string;
  try {
    vaultAddress = await initializeVault(WEEK);
    logStep("2", `Vault PDA (week ${WEEK}): ${vaultAddress}`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      logStep("2", `Vault PDA (week ${WEEK}) already exists, continuing.`);
      // Derive the address for DB record
      const { getVaultAddress } = await import("../anchor/src/clearance-exports");
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

  // 2c. DB: Create tasks + rounds with verdicts
  const roundIds: string[] = [];
  for (let i = 0; i < NUM_ROUNDS; i++) {
    const task = await prisma.task.create({
      data: {
        creatorId: adminUserId,
        weekNumber: WEEK,
        taskNumber: i + 1,
        description: `Demo task #${i + 1}: Create a viral TikTok`,
        hashtag: "#theclearanceNG",
        deadline: scheduledAt,
        tiktokUrl: SAMPLE_TIKTOK_URLS[i],
        status: "verified",
        submittedAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
      },
    });

    const round = await prisma.sessionRound.create({
      data: {
        sessionId: session.id,
        roundNumber: i + 1,
        taskId: task.id,
        tiktokUrl: SAMPLE_TIKTOK_URLS[i],
        duration: 30,
        adminVerdict: ADMIN_VERDICTS[i],
      },
    });
    roundIds.push(round.id);
  }
  logStep(
    "2",
    `Created ${NUM_ROUNDS} rounds: ${ADMIN_VERDICTS.map((v) => v[0].toUpperCase()).join(",")}`
  );

  // 2d. DB: Create fan users + votes + game results
  for (const fan of FAN_VOTES) {
    const user = await prisma.user.upsert({
      where: { privyId: `demo-${fan.label.toLowerCase().replace(" ", "-")}` },
      update: {},
      create: {
        privyId: `demo-${fan.label.toLowerCase().replace(" ", "-")}`,
        displayName: `Demo ${fan.label}`,
        role: "fan",
        referralCode: `DEMO${fan.label.replace(" ", "").toUpperCase()}`,
        consentAccepted: true,
      },
    });

    // Create votes
    for (let i = 0; i < NUM_ROUNDS; i++) {
      await prisma.vote.upsert({
        where: { userId_roundId: { userId: user.id, roundId: roundIds[i] } },
        update: {},
        create: {
          userId: user.id,
          roundId: roundIds[i],
          decision: fan.votes[i],
        },
      });
    }

    // Create game result with tier override
    await prisma.gameResult.upsert({
      where: { userId_sessionId: { userId: user.id, sessionId: session.id } },
      update: {},
      create: {
        userId: user.id,
        sessionId: session.id,
        totalVotes: NUM_ROUNDS,
        correctVotes: fan.correct,
        tier: fan.tier,
      },
    });

    logStep(
      "2",
      `${fan.label}: ${fan.correct}/${NUM_ROUNDS} correct → ${fan.tier} (user: ${user.id})`
    );
  }

  return session;
}

// ── Phase 3: On-Chain Fan Flow (Fan A, Gold Tier) ───────────────────

async function phase3_onChainFanFlow(adminKeypair: Keypair) {
  console.log("\n  ── Phase 3: On-Chain Fan Flow (Fan A, Gold) ──\n");

  const WEEK = 1;

  // Check if Fan A already claimed (skip if re-run)
  const fanAUser = await prisma.user.findUnique({
    where: { privyId: "demo-fan-a" },
  });
  if (!fanAUser) {
    logStep("3", "Fan A user not found — skipping on-chain flow.");
    return null;
  }

  const fanAResult = await prisma.gameResult.findFirst({
    where: { userId: fanAUser.id },
    include: { session: true },
  });
  if (!fanAResult) {
    logStep("3", "Fan A game result not found — skipping on-chain flow.");
    return null;
  }
  if (fanAResult.usdcClaimed) {
    logStep("3", "Fan A already claimed. Skipping on-chain flow.");
    return {
      fanPubkey: fanAUser.walletAddress ?? "unknown",
      nftAsset: fanAResult.nftTokenId ?? "unknown",
      rewardAmount: fanAResult.rewardAmount,
    };
  }

  // Generate a local keypair for Fan A
  const fanKeypair = Keypair.generate();
  const fanPubkey = fanKeypair.publicKey;
  logStep("3", `Fan A keypair: ${fanPubkey.toBase58()}`);

  // Update Fan A's wallet address in DB
  await prisma.user.update({
    where: { id: fanAUser.id },
    data: { walletAddress: fanPubkey.toBase58() },
  });

  // 3a. Airdrop SOL to fan
  logStep("3", "Airdropping 2 SOL to fan...");
  const airdropSig = await connection.requestAirdrop(
    fanPubkey,
    2 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSig, "confirmed");
  logStep("3", `Airdrop tx: ${airdropSig.slice(0, 16)}...`);

  // 3b. Mint USDC to fan
  logStep("3", "Minting 10 USDC to fan...");
  await mintUsdcToWallet(adminKeypair, fanPubkey, 10);
  logStep("3", "Fan has 10 USDC.");

  // 3c. fan_deposit (3.50 USDC entry fee)
  logStep("3", `Fan deposit: ${ENTRY_FEE_USDC} USDC...`);
  const depositBase64 = await buildFanDepositTx({
    fanWalletAddress: fanPubkey.toBase58(),
    sessionWeekNumber: WEEK,
    amountUsdc: ENTRY_FEE_USDC,
  });
  const depositSig = await signAndSendBase64Tx(depositBase64, fanKeypair);
  logStep("3", `fan_deposit tx: ${depositSig.slice(0, 16)}...`);

  // 3d. Mint NFT via UMI (owner = fan, updateAuthority = admin)
  logStep("3", "Minting NFT (Metaplex Core)...");
  const umi = getUmiInstance(adminKeypair);
  const asset = generateSigner(umi);
  await create(umi, {
    asset,
    name: "Clearance Blind Box — Week 1",
    uri: "https://clearance.local/metadata/week1.json",
    owner: toUmiPublicKey(fanPubkey.toBase58()),
    updateAuthority: toUmiPublicKey(adminKeypair.publicKey.toBase58()),
  }).sendAndConfirm(umi);
  const nftAssetAddress = asset.publicKey.toString();
  logStep("3", `NFT asset: ${nftAssetAddress}`);

  // Update GameResult with NFT info
  await prisma.gameResult.update({
    where: { id: fanAResult.id },
    data: {
      nftMinted: true,
      nftTokenId: nftAssetAddress,
      walletAddress: fanPubkey.toBase58(),
    },
  });

  // 3e. request_raffle (tier=2 → gold)
  logStep("3", "Requesting raffle (tier=2, gold)...");
  const raffleBase64 = await buildRequestRaffleTx({
    fanWalletAddress: fanPubkey.toBase58(),
    sessionWeekNumber: WEEK,
    tier: 2, // gold
  });
  const raffleSig = await signAndSendBase64Tx(raffleBase64, fanKeypair);
  logStep("3", `request_raffle tx: ${raffleSig.slice(0, 16)}...`);

  // 3f. VRF callback (randomness[0]=0 → guaranteed high payout = $3.50)
  logStep("3", "Simulating VRF callback (randomness[0]=0 → high payout)...");
  const randomness = new Array(32).fill(0);
  const rewardUsdc = await simulateVrfCallback(
    fanPubkey.toBase58(),
    WEEK,
    randomness
  );
  logStep("3", `VRF resolved: reward = $${rewardUsdc.toFixed(2)} USDC`);

  // Update GameResult with raffle result
  await prisma.gameResult.update({
    where: { id: fanAResult.id },
    data: {
      rewardAmount: rewardUsdc,
      nftRevealed: true,
    },
  });

  // 3g. claim_with_raffle
  logStep("3", "Claiming with raffle...");
  const claimBase64 = await buildClaimWithRaffleTx({
    userWalletAddress: fanPubkey.toBase58(),
    nftAssetAddress,
    sessionWeekNumber: WEEK,
  });
  const claimSig = await signAndSendBase64Tx(claimBase64, fanKeypair);
  logStep("3", `claim_with_raffle tx: ${claimSig.slice(0, 16)}...`);

  // Update GameResult with claim info
  await prisma.gameResult.update({
    where: { id: fanAResult.id },
    data: {
      usdcClaimed: true,
      claimTxHash: claimSig,
      claimedAt: new Date(),
    },
  });

  // 3h. Verify fan USDC balance
  const fanAta = getAssociatedTokenAddressSync(USDC_MINT, fanPubkey);
  const fanAccount = await getAccount(connection, fanAta);
  const fanBalance = Number(fanAccount.amount) / 1_000_000;
  logStep("3", `Fan USDC balance: $${fanBalance.toFixed(2)}`);

  return {
    fanPubkey: fanPubkey.toBase58(),
    nftAsset: nftAssetAddress,
    rewardAmount: rewardUsdc,
    claimTx: claimSig,
    fanBalance,
  };
}

// ── Phase 4: Playable Session (Week 2) ──────────────────────────────

async function phase4_playableSession(adminUserId: string) {
  console.log("\n  ── Phase 4: Playable Session (Week 2) ──\n");

  const WEEK = 2;

  // Check if already exists
  const existing = await prisma.weeklySession.findUnique({
    where: { weekNumber: WEEK },
  });
  if (existing) {
    logStep("4", `Week ${WEEK} session already exists (${existing.id}). Skipping.`);
    return existing;
  }

  // 4a. On-chain: initialize vault + deposit
  let vaultAddress: string;
  try {
    vaultAddress = await initializeVault(WEEK);
    logStep("4", `Vault PDA (week ${WEEK}): ${vaultAddress}`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      logStep("4", `Vault PDA (week ${WEEK}) already exists, continuing.`);
      const { getVaultAddress } = await import("../anchor/src/clearance-exports");
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

  // 4c. DB: Create rounds (no verdicts — admin judges later)
  for (let i = 0; i < NUM_ROUNDS; i++) {
    const task = await prisma.task.create({
      data: {
        creatorId: adminUserId,
        weekNumber: WEEK,
        taskNumber: i + 1,
        description: `Week 2 task #${i + 1}: Create a viral TikTok`,
        hashtag: "#theclearanceNG",
        deadline: scheduledAt,
        tiktokUrl: SAMPLE_TIKTOK_URLS[i],
        status: "verified",
        submittedAt: new Date(),
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
      },
    });

    await prisma.sessionRound.create({
      data: {
        sessionId: session.id,
        roundNumber: i + 1,
        taskId: task.id,
        tiktokUrl: SAMPLE_TIKTOK_URLS[i],
        duration: 30,
      },
    });
  }
  logStep("4", `Created ${NUM_ROUNDS} rounds (no verdicts — ready for judging).`);

  return session;
}

// ── Phase 5: Print Summary ──────────────────────────────────────────

function phase5_summary(
  week1Session: { id: string; vaultAddress: string | null },
  week2Session: { id: string; vaultAddress: string | null },
  fanFlowResult: {
    fanPubkey: string;
    nftAsset: string;
    rewardAmount: number;
    claimTx?: string;
    fanBalance?: number;
  } | null
) {
  console.log("\n  ════════════════════════════════════════════════");
  console.log("  Clearance Demo — Full Lifecycle Complete!");
  console.log("  ════════════════════════════════════════════════\n");

  console.log("  Week 1 (completed):");
  console.log(`    Session ID:    ${week1Session.id}`);
  console.log(`    Vault:         ${week1Session.vaultAddress}`);
  console.log(`    Status:        ended (3 approved, 2 rejected)`);
  console.log(`    Fans:          Fan A (gold), Fan B (base), Fan C (participation)`);

  if (fanFlowResult) {
    console.log("\n  On-chain Fan Flow (Fan A):");
    console.log(`    Wallet:        ${fanFlowResult.fanPubkey}`);
    console.log(`    NFT Asset:     ${fanFlowResult.nftAsset}`);
    console.log(`    Reward:        $${fanFlowResult.rewardAmount.toFixed(2)} USDC`);
    if (fanFlowResult.claimTx) {
      console.log(`    Claim Tx:      ${fanFlowResult.claimTx}`);
    }
    if (fanFlowResult.fanBalance !== undefined) {
      console.log(`    Balance:       $${fanFlowResult.fanBalance.toFixed(2)} USDC`);
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
  console.log("    4. /rewards → Fan A's completed blind box (claimed)");
  console.log("    5. /arena   → Week 2 session → join → play → vote");
  console.log("    6. Admin judges via /admin/sessions/[id]/judge");
  console.log("    7. /rewards → Open Box → Reveal → Claim\n");
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Setup Demo — Clearance Full Lifecycle\n");

  const adminKeypair = getAdminKeypair();

  // Phase 1
  const adminUser = await phase1_adminSetup(adminKeypair);

  // Phase 2
  const week1Session = await phase2_completedSession(adminUser.id);

  // Phase 3
  const fanFlowResult = await phase3_onChainFanFlow(adminKeypair);

  // Phase 4
  const week2Session = await phase4_playableSession(adminUser.id);

  // Phase 5
  phase5_summary(
    { id: week1Session.id, vaultAddress: week1Session.vaultAddress },
    { id: week2Session.id, vaultAddress: week2Session.vaultAddress },
    fanFlowResult
  );
}

main()
  .catch((err) => {
    console.error("\n  Setup failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
