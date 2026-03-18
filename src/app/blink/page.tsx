"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Send } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import PageHeader from "@/components/PageHeader";
import SpotrIcon from "@/components/SpotrIcon";

function BlinkContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const score = searchParams.get("score");
  const total = searchParams.get("total");

  const { getAccessToken, authenticated } = usePrivy();
  const [blinkCode, setBlinkCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tribeScore, setTribeScore] = useState<number | null>(null);

  useEffect(() => {
    if (!authenticated) return;

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/referrals", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setBlinkCode(data.code ?? null);
          setTribeScore(data.tribeScore ?? 0);
        }
      } catch {
        // ignore
      }
    })();
  }, [authenticated, getAccessToken]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://spotr.tv";

  const actionUrl = blinkCode
    ? `${origin}/api/actions/join${sessionId ? `?session=${sessionId}&ref=${blinkCode}` : `?ref=${blinkCode}`}`
    : "";

  const fullUrl = blinkCode
    ? `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`
    : "";

  const blinkDisplay = blinkCode
    ? `dial.to/?action=solana-action:${encodeURIComponent(actionUrl).slice(0, 18)}...`
    : "dial.to/...";

  const truncateUrl = (url: string) => {
    const start = 22;
    const end = 7;
    if (url.length <= start + end + 3) return url;
    return `${url.slice(0, start)}...${url.slice(-end)}`;
  };

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = fullUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    const scoreText =
      score && total ? `I scored ${score}/${total} on @SpotrTV. Play through my link 👇` : `I'm building my Taste Tribe on @SpotrTV. Join through my link and let's unlock NFT rewards together.`;
    const text = `${scoreText}\n\n${fullUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareTelegram = () => {
    const text =
      score && total
        ? `I scored ${score}/${total} on Spotr TV! Join via my Blink link:`
        : `Join my Taste Tribe on Spotr TV!`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(text)}`,
      "_blank",
    );
  };

  const nftThreshold = 70;
  const scorePct = tribeScore !== null ? Math.min(100, (tribeScore / nftThreshold) * 100) : 0;
  const backHref = sessionId ? `/arena/results?session=${sessionId}` : "/arena/results";

  return (
    <div className="spotr-page flex flex-1 flex-col">
      <PageHeader title="YOUR SPOTR BLINK" backHref={backHref} />

      <div className="spotr-mobile-shell flex flex-1 flex-col px-5 py-4">
        <div className="spotr-panel px-4 py-4">
          <p className="text-[14px] leading-5 text-[#8b8b8b]">
            Share this link. Anyone who plays through it joins your Taste Tribe. Their points stack with yours.
          </p>
        </div>

        <div className="spotr-panel mt-4 flex items-center justify-between gap-3 px-4 py-4">
          <span className="text-[13px] font-medium text-[#d0b33a]">{truncateUrl(blinkDisplay)}</span>
          <button
            onClick={handleCopy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#202020] text-[#9d9d9d]"
          >
            {copied ? <Check className="h-4 w-4 text-[#45ca61]" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[11px] text-[#707070]">Preview when shared on X/Telegram/Phantom:</p>
          <div className="spotr-panel px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
                <SpotrIcon size={40} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white">SPOTR.TV — Spot what sells</p>
                <p className="mt-1 text-[13px] text-[#8b8b8b]">Play 7 rounds. Earn USDC. Build your Taste Score.</p>
                <div className="mt-3 inline-flex min-h-[36px] items-center rounded-[12px] bg-[#f5d63d] px-4 text-[14px] font-semibold text-black">
                  Join Session
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleShareX}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#2f2f2f] bg-[#101010] px-3 text-[14px] font-semibold text-white"
          >
            <svg width="14" height="14" viewBox="0 0 1200 1227" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" />
            </svg>
            Share on X
          </button>

          <button
            onClick={handleShareTelegram}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#3998e9] px-3 text-[14px] font-semibold text-white"
          >
            <Send className="h-4 w-4" />
            Telegram
          </button>

          <button
            onClick={handleCopy}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#d0b33a] px-3 text-[14px] font-semibold text-[#d0b33a]"
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        <div className="mt-auto pt-10">
          <div className="spotr-panel px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#d0b33a]">Taste Tribe Score</p>
            <p className="mt-2 text-[15px] text-[#8b8b8b]">
              {tribeScore === null ? (
                <span className="italic text-[#6d6d6d]">computing scores...</span>
              ) : (
                <><span className="font-semibold text-[#bdbdbd]">{tribeScore}</span> / {nftThreshold} points</>
              )}
            </p>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[#303030]">
              <div className="h-full rounded-full bg-[#d0b33a]" style={{ width: `${scorePct}%` }} />
            </div>
            <p className="mt-3 text-[12px] leading-4 text-[#6d6d6d]">
              Recruit activated members to unlock NFT whitelist
            </p>
          </div>
          <p className="mt-4 text-center text-[11px] leading-4 text-[#666]">
            Referred users must complete a second session with deposit to activate and count toward your tribe score.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BlinkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
        </div>
      }
    >
      <BlinkContent />
    </Suspense>
  );
}
