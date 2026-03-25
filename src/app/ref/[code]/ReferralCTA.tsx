"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Mail, Wallet, Zap, Trophy, Gift, ArrowRight } from "lucide-react";

export default function ReferralCTA({ code }: { code: string }) {
  const { login, authenticated } = usePrivy();
  const router = useRouter();

  // If user is already authenticated, redirect to arena
  useEffect(() => {
    if (authenticated) {
      router.push("/arena");
    }
  }, [authenticated, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-5 py-8">
      <div className="w-full max-w-[380px]">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-[#f5d63d]">
            <Zap className="h-8 w-8 text-black" />
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.04em] text-white">
            You&apos;ve been recruited
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-[#8b8b8b]">
            Someone wants you on their Taste Tribe. Sign up to join the crew and start earning together.
          </p>
        </div>

        {/* What you get */}
        <div className="mb-6 rounded-[16px] border border-white/8 bg-[#121212] px-5 py-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#646464]">
            What you unlock
          </p>
          <div className="space-y-4">
            {[
              { icon: <Trophy className="h-4 w-4 text-[#d3b93b]" />, text: "Compete in live prediction sessions" },
              { icon: <Gift className="h-4 w-4 text-[#d3b93b]" />, text: "Earn USDC rewards & discount codes" },
              { icon: <Wallet className="h-4 w-4 text-[#d3b93b]" />, text: "Build your Taste Score toward NFT whitelist" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1e1a0e]">
                  {item.icon}
                </div>
                <span className="text-[14px] text-[#d0d0d0]">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Referral code badge */}
        <div className="mb-6 rounded-[14px] border border-[#f5d63d]/20 bg-[#1a1700] px-4 py-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#8b7a2a]">
            Referral Code
          </p>
          <p className="mt-1 text-[20px] font-bold tracking-[0.12em] text-[#f5d63d]">
            {code}
          </p>
        </div>

        {/* CTA Buttons */}
        <button
          onClick={() => login()}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#f5d63d] px-6 py-4 text-[16px] font-bold text-black transition-colors hover:bg-[#e6c832]"
        >
          <Mail className="h-5 w-5" />
          Sign Up with Email
          <ArrowRight className="ml-1 h-4 w-4" />
        </button>

        <p className="mt-3 text-center text-[12px] leading-4 text-[#555]">
          You can also connect your Solana wallet during sign-up.
          <br />
          Your referral will be linked automatically.
        </p>
      </div>
    </div>
  );
}
