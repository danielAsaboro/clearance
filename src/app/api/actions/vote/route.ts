import { NextRequest, NextResponse } from "next/server";
import {
  ACTIONS_CORS_HEADERS,
  createPostResponse,
} from "@solana/actions";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { prisma } from "@/lib/db";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
);

// GET /api/actions/vote — Blink metadata for voting on The Clearance
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");

  let title = "Vote on The Clearance";
  let description =
    "Cast your vote on the latest session. Approve or reject creator content and earn rewards!";

  if (sessionId) {
    const session = await prisma.weeklySession.findUnique({
      where: { id: sessionId },
    });
    if (session) {
      if (session.status === "ended") {
        title = `Session Ended: ${session.title}`;
        description = `Week ${session.weekNumber} — This session has ended. Check your results on The Clearance!`;
      } else {
        title = `Vote: ${session.title}`;
        description = `Week ${session.weekNumber} — Cast your vote on creator content in The Clearance. Score 21+ correct for Gold Tier rewards!`;
      }
    }
  }

  const payload = {
    type: "action" as const,
    icon: `${new URL(req.url).origin}/icon-512x512.png`,
    title,
    description,
    label: "Vote Now",
    links: {
      actions: [
        {
          type: "transaction" as const,
          label: "Approve",
          href: `${new URL(req.url).origin}/api/actions/vote?decision=approve${sessionId ? `&session=${sessionId}` : ""}`,
        },
        {
          type: "transaction" as const,
          label: "Reject",
          href: `${new URL(req.url).origin}/api/actions/vote?decision=reject${sessionId ? `&session=${sessionId}` : ""}`,
        },
      ],
    },
  };

  return NextResponse.json(payload, { headers: ACTIONS_CORS_HEADERS });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });
}

// POST /api/actions/vote — Process vote via Blink
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const decision = searchParams.get("decision") || "approve";
    const sessionId = searchParams.get("session");

    const body = await req.json();
    const accountPubkey = new PublicKey(body.account);

    // Build a memo transaction encoding the vote
    const memoData = JSON.stringify({
      app: "spotr-tv",
      action: "vote",
      decision,
      session: sessionId || "current",
      ts: Date.now(),
    });

    const memoIx = new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: accountPubkey, isSigner: true, isWritable: false }],
      data: Buffer.from(memoData, "utf-8"),
    });

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = accountPubkey;
    tx.add(memoIx);

    // Record vote in DB (best effort — wallet may not be a registered user)
    let skipVote = false;
    if (sessionId) {
      const session = await prisma.weeklySession.findUnique({ where: { id: sessionId } });
      if (!session || session.status !== "live") {
        skipVote = true;
      }
    }

    if (sessionId && !skipVote) {
      const user = await prisma.user.findFirst({
        where: { walletAddress: accountPubkey.toBase58() },
      });
      if (user) {
        const currentRound = await prisma.sessionRound.findFirst({
          where: { sessionId },
          orderBy: { roundNumber: "asc" },
        });
        if (currentRound) {
          await prisma.vote
            .create({
              data: {
                userId: user.id,
                roundId: currentRound.id,
                decision: decision as "approve" | "reject",
              },
            })
            .catch(() => {
              // Duplicate vote — ignore
            });
        }
      }
    }

    const response = await createPostResponse({
      fields: {
        type: "transaction",
        transaction: tx,
        message: `Vote recorded: ${decision.toUpperCase()}! Head to The Clearance for live voting.`,
      },
    });

    return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("Vote action error:", error);
    return NextResponse.json(
      { message: "Failed to create vote transaction" },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}
