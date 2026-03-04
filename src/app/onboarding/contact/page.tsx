"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Mail, Wallet, Check } from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";
import { usePrivy } from "@privy-io/react-auth";

const TOTAL_STEPS = 4;

export default function ContactStep() {
  const router = useRouter();
  const { user, linkEmail, linkWallet } = usePrivy();
  const { data, updateData } = useOnboarding();
  const [emailInput, setEmailInput] = useState(data.email);
  const [linking, setLinking] = useState(false);

  const hasEmail = !!user?.email?.address;
  const hasWallet = !!user?.wallet?.address;

  const needsEmail = !hasEmail;
  const needsWallet = !hasWallet;
  const bothPresent = hasEmail && hasWallet;

  const handleLinkEmail = async () => {
    setLinking(true);
    try {
      await linkEmail();
    } catch {
      // User may have cancelled
    } finally {
      setLinking(false);
    }
  };

  const handleLinkWallet = async () => {
    setLinking(true);
    try {
      await linkWallet();
    } catch {
      // User may have cancelled
    } finally {
      setLinking(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value);
    updateData({ email: e.target.value });
  };

  const canContinue = true;

  const handleContinue = () => {
    if (hasEmail && !data.email) {
      updateData({ email: user!.email!.address });
    }
    router.push("/onboarding/profile");
  };

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/onboarding/categories">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">
          STEP 2 OF {TOTAL_STEPS}
        </span>
      </div>

      <ProgressBar currentStep={2} totalSteps={TOTAL_STEPS} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Contact Info</h1>
        <p className="text-[#888] text-sm mt-1">
          Help us keep you connected with updates and rewards.
        </p>

        <div className="space-y-4 mt-8">
          {/* Email section */}
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#F5E642]" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Email Address</p>
                <p className="text-[#888] text-xs">For session reminders & results</p>
              </div>
              {hasEmail && (
                <Check className="w-5 h-5 text-[#F5E642]" />
              )}
            </div>
            {hasEmail ? (
              <p className="text-[#888] text-sm bg-[#111] rounded-xl px-4 py-3">
                {user!.email!.address}
              </p>
            ) : needsEmail ? (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={emailInput}
                  onChange={handleEmailChange}
                  className="w-full bg-[#111] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#555]"
                />
                <button
                  onClick={handleLinkEmail}
                  disabled={linking}
                  className="w-full text-sm text-[#F5E642] hover:underline"
                >
                  Or link email via Privy
                </button>
              </div>
            ) : null}
          </div>

          {/* Wallet section */}
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#F5E642]" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Wallet</p>
                <p className="text-[#888] text-xs">For on-chain rewards & NFTs</p>
              </div>
              {hasWallet && (
                <Check className="w-5 h-5 text-[#F5E642]" />
              )}
            </div>
            {hasWallet ? (
              <p className="text-[#888] text-sm bg-[#111] rounded-xl px-4 py-3 font-mono truncate">
                {user!.wallet!.address}
              </p>
            ) : needsWallet ? (
              <button
                onClick={handleLinkWallet}
                disabled={linking}
                className="w-full bg-[#2A2A2A] text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-[#333] transition-colors flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                {linking ? "Connecting..." : "Connect Wallet"}
              </button>
            ) : null}
          </div>

          {bothPresent && (
            <div className="bg-[#F5E642]/10 rounded-xl p-4 border border-[#F5E642]/20">
              <p className="text-[#F5E642] text-sm font-medium">
                All set! Both your email and wallet are connected.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={handleContinue}
        disabled={!canContinue || linking}
        className={`w-full rounded-xl py-4 text-base font-medium flex items-center justify-center gap-2 mt-8 ${
          canContinue && !linking
            ? "btn-yellow font-bold"
            : "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
        }`}
      >
        Continue <span className="text-lg">&rarr;</span>
      </button>
    </div>
  );
}
