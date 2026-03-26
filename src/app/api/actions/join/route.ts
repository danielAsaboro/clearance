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
import { format } from "date-fns";
import { serverEnv } from "@/lib/env";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

const connection = new Connection(serverEnv.NEXT_PUBLIC_SOLANA_RPC_URL);

// GET /api/actions/join — Blink metadata for joining a live session
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session");
  const refCode = searchParams.get("ref");

  let title = "Join Live Session";
  let description =
    "Join the next live voting session on Spotr TV. Vote on video matchups and earn rewards!";
  let scheduledLabel = "Join Now";

  if (sessionId) {
    const session = await prisma.weeklySession.findUnique({
      where: { id: sessionId },
    });
    if (session) {
      title = `Join: ${session.title}`;
      const when = format(new Date(session.scheduledAt), "MMM d 'at' h:mm a");
      description = `Week ${session.weekNumber} — ${when}. Join Spotr TV live voting session and score 21+ for Gold Tier rewards!`;
      scheduledLabel =
        session.status === "live" ? "Join Live Now" : `Join — ${when}`;
    }
  }

  const payload = {
    type: "action" as const,
    icon: `${new URL(req.url).origin}/icon-512x512.png`,
    title,
    description,
    label: scheduledLabel,
    links: {
      actions: [
        {
          type: "transaction" as const,
          label: scheduledLabel,
          href: (() => {
            const params = new URLSearchParams();
            if (sessionId) params.set("session", sessionId);
            if (refCode) params.set("ref", refCode);
            const qs = params.toString();
            return `${new URL(req.url).origin}/api/actions/join${qs ? `?${qs}` : ""}`;
          })(),
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

// POST /api/actions/join — Process join via Blink
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session");
    const refCode = searchParams.get("ref");

    const body = await req.json();
    const accountPubkey = new PublicKey(body.account);

    const memoData = JSON.stringify({
      app: "spotr-tv",
      action: "join_session",
      session: sessionId || "next",
      wallet: accountPubkey.toBase58(),
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

    // Look up existing user by wallet
    const walletAddr = accountPubkey.toBase58();
    const user = await prisma.user.findFirst({
      where: { walletAddress: walletAddr },
    });

    // Record join in DB if user exists and session is active
    let skipJoin = false;
    if (sessionId) {
      const session = await prisma.weeklySession.findUnique({ where: { id: sessionId } });
      if (!session || (session.status !== "live" && session.status !== "scheduled")) {
        skipJoin = true;
      }
    }

    if (sessionId && !skipJoin && user) {
      await prisma.gameResult
        .create({
          data: {
            userId: user.id,
            sessionId,
            walletAddress: user.walletAddress,
          },
        })
        .catch((err) => {
          console.log("[blink] gameResult already exists or failed:", err.code);
        });

      // Record referral attribution if a ref code was passed and user has no referral yet
      if (refCode) {
        const existingReferral = await prisma.referral.findUnique({
          where: { referredUserId: user.id },
        });
        if (!existingReferral) {
          const referrer = await prisma.user.findUnique({ where: { referralCode: refCode } });
          if (referrer && referrer.id !== user.id) {
            await prisma.referral
              .create({
                data: { referrerId: referrer.id, referredUserId: user.id, code: refCode },
              })
              .catch((err) => {
                console.error("[blink] referral creation failed:", err.message);
              });
            await prisma.user
              .update({ where: { id: user.id }, data: { referredBy: refCode } })
              .catch((err) => {
                console.error("[blink] user referredBy update failed:", err.message);
              });
          }
        }
      }
    }

    // Tailor message: existing users go play, new users sign up via referral page
    const origin = new URL(req.url).origin;
    const message = user
      ? "You're in! Head to Spotr TV to start voting when the session goes live."
      : refCode
        ? `You're in! Sign up at ${origin}/ref/${refCode} to save your progress and start playing.`
        : `You're in! Sign up at ${origin} to start playing.`;

    const response = await createPostResponse({
      fields: {
        type: "transaction",
        transaction: tx,
        message,
      },
    });

    return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("Join action error:", error);
    return NextResponse.json(
      { message: "Failed to create join transaction" },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}
