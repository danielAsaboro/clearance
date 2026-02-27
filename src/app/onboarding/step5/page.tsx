"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Copy, Check, PartyPopper, ArrowRight } from "lucide-react";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";
import { usePrivy } from "@privy-io/react-auth";

export default function Step5() {
  const router = useRouter();
  const { data, resetData } = useOnboarding();
  const { getAccessToken } = usePrivy();
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/creators/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          debtSources: data.debtSources,
          willingToDeclare: data.willingToDeclare,
          displayName: data.displayName,
          tiktokUsername: data.tiktokUsername,
          profilePhoto: data.profilePhoto || undefined,
          consentAccepted: data.consentAccepted,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      const result = await res.json();
      setReferralCode(result.referralCode);
      setSubmitted(true);

      // Record referral if the user arrived via a referral link.
      // The server reads the HTTP-only referral_code cookie automatically.
      try {
        await fetch("/api/referrals", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-fatal: referral recording failure should not block onboarding
      }
    } catch (err) {
      console.error("Onboarding error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/ref/${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoToHub = () => {
    resetData();
    router.push("/creator-hub");
  };

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-center mb-4">
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
      </div>

      <ProgressBar currentStep={5} totalSteps={5} />

      {!submitted ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Ready to Submit?</h1>
          <p className="text-[#888] text-sm mb-8">
            Review your details and complete your registration.
          </p>

          {/* Summary */}
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] w-full text-left">
            <div className="space-y-3">
              <div>
                <p className="text-[#888] text-xs uppercase tracking-wider">Name</p>
                <p className="text-white text-sm">{data.displayName}</p>
              </div>
              <div>
                <p className="text-[#888] text-xs uppercase tracking-wider">TikTok</p>
                <p className="text-white text-sm">@{data.tiktokUsername}</p>
              </div>
              <div>
                <p className="text-[#888] text-xs uppercase tracking-wider">Debt Sources</p>
                <p className="text-white text-sm">{data.debtSources.join(", ")}</p>
              </div>
              <div>
                <p className="text-[#888] text-xs uppercase tracking-wider">Willing to Declare</p>
                <p className="text-white text-sm">
                  {data.willingToDeclare ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-yellow w-full rounded-xl py-4 text-base font-bold mt-8"
          >
            {submitting ? "Submitting..." : "Complete Registration"}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#F5E642]/20 rounded-full flex items-center justify-center mb-6">
            <PartyPopper className="w-10 h-10 text-[#F5E642]" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re In!</h1>
          <p className="text-[#888] text-sm mb-8">
            Welcome to The Clearance. Your creator account is ready.
          </p>

          {/* Referral Code */}
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] w-full">
            <p className="text-[#888] text-xs uppercase tracking-wider mb-2">
              Your Referral Code
            </p>
            <div className="flex items-center gap-3">
              <code className="text-[#F5E642] text-lg font-bold flex-1 text-left">
                {referralCode}
              </code>
              <button
                onClick={handleCopy}
                className="w-10 h-10 rounded-xl bg-[#2A2A2A] flex items-center justify-center hover:bg-[#333] transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#F5E642]" />
                ) : (
                  <Copy className="w-4 h-4 text-[#888]" />
                )}
              </button>
            </div>
            <p className="text-[#555] text-xs mt-2 text-left">
              Share this to invite other creators
            </p>
          </div>

          <button
            onClick={handleGoToHub}
            className="btn-yellow w-full rounded-xl py-4 text-base font-bold flex items-center justify-center gap-2 mt-8"
          >
            Go to Creator Hub <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
