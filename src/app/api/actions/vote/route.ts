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
import { serverEnv } from "@/lib/env";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const connection = new Connection(serverEnv.NEXT_PUBLIC_SOLANA_RPC_URL);

// GET /api/actions/vote — Blink metadata for voting on Spotr TV
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");

  let title = "Vote on Spotr TV";
  let description =
    "Cast your vote on the latest session. Pick which video will trend and earn rewards!";

  if (sessionId) {
    const session = await prisma.weeklySession.findUnique({
      where: { id: sessionId },
    });
    if (session) {
      if (session.status === "ended") {
        title = `Session Ended: ${session.title}`;
        description = `Week ${session.weekNumber} — This session has ended. Check your results on Spotr TV!`;
      } else {
        title = `Vote: ${session.title}`;
        description = `Week ${session.weekNumber} — Predict which videos will trend on Spotr TV. Score 75%+ correct for Gold Tier rewards!`;
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
          label: "Video A",
          href: `${new URL(req.url).origin}/api/actions/vote?decision=video_a${sessionId ? `&session=${sessionId}` : ""}`,
        },
        {
          type: "transaction" as const,
          label: "Video B",
          href: `${new URL(req.url).origin}/api/actions/vote?decision=video_b${sessionId ? `&session=${sessionId}` : ""}`,
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
    const decision = searchParams.get("decision") || "video_a";
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
        const currentMatchup = await prisma.matchup.findFirst({
          where: { sessionId },
          orderBy: { matchupNumber: "asc" },
        });
        if (currentMatchup) {
          await prisma.vote
            .create({
              data: {
                userId: user.id,
                matchupId: currentMatchup.id,
                decision: decision as "video_a" | "video_b",
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
        message: `Vote recorded: ${decision === "video_a" ? "Video A" : "Video B"}! Head to Spotr TV for live voting.`,
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
