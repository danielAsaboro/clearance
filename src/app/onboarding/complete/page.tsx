"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  CheckCircle,
  Copy,
  Check,
  PartyPopper,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";
import { usePrivy } from "@privy-io/react-auth";

export default function CompleteStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") ?? "fan";
  const totalSteps = role === "creator" ? 7 : 4;
  const currentStep = totalSteps;

  const { data, updateData, resetData } = useOnboarding();
  const { getAccessToken } = usePrivy();
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const backHref =
    role === "creator"
      ? `/onboarding/tiktok?role=${role}`
      : `/onboarding/profile?role=${role}`;

  const terms =
    role === "creator"
      ? [
          "I understand this is a social-impact program focused on debt relief through content creation",
          "I consent to my submitted TikTok content being displayed in live voting sessions",
          "I understand that prize amounts are determined by fan voting outcomes",
          "I acknowledge that The Clearance does not guarantee specific debt relief amounts",
          "I retain ownership of my content and grant The Clearance a display license",
        ]
      : [
          "I understand The Clearance is a platform for discovering and voting on content",
          "I will participate in good faith during live voting sessions",
          "I understand that rewards are based on voting accuracy and participation",
          "I acknowledge that The Clearance does not guarantee specific reward amounts",
        ];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const body: Record<string, unknown> = {
        role,
        categories: data.categories,
        email: data.email || undefined,
        displayName: data.displayName,
        profilePhoto: data.profilePhoto || undefined,
        consentAccepted: data.consentAccepted,
      };

      // Add creator-specific fields
      if (role === "creator") {
        body.debtSources = data.debtSources;
        body.willingToDeclare = data.willingToDeclare;
        body.tiktokUsername = data.tiktokUsername;
      }

      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to submit");

      const result = await res.json();
      setReferralCode(result.referralCode);
      setSubmitted(true);

      // Record referral
      try {
        await fetch("/api/referrals", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-fatal
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

  const handleGoToNext = () => {
    resetData();
    if (role === "creator") {
      router.push("/creator-hub");
    } else {
      router.push("/arena");
    }
  };

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {!submitted ? (
          <Link href={backHref}>
            <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </div>
          </Link>
        ) : (
          <div className="w-10" />
        )}
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">
          STEP {currentStep} OF {totalSteps}
        </span>
      </div>

      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />

      {!submitted ? (
        <div className="mt-8 flex-1 flex flex-col">
          <h1 className="text-2xl font-bold text-white">
            Disclaimer & Consent
          </h1>
          <p className="text-[#888] text-sm mt-1">
            Please review and accept the following terms
          </p>

          <div className="bg-[#1A1A1A] rounded-2xl p-6 mt-8 border border-[#2A2A2A]">
            <div className="space-y-4">
              {terms.map((term, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#F5E642] flex-shrink-0 mt-0.5" />
                  <p className="text-[#ccc] text-sm">{term}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Consent Toggle */}
          <div className="bg-[#1A1A1A] rounded-2xl px-5 py-4 mt-4 flex items-center justify-between border border-[#2A2A2A]">
            <span className="text-white text-sm font-medium">
              I accept the terms above
            </span>
            <button
              onClick={() =>
                updateData({ consentAccepted: !data.consentAccepted })
              }
              className={`w-11 h-6 rounded-full relative transition-all ${
                data.consentAccepted
                  ? "bg-[#F5E642] shadow-[0_0_10px_rgba(245,230,66,0.4)]"
                  : "bg-[#333]"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  data.consentAccepted
                    ? "translate-x-[22px]"
                    : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Summary */}
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] mt-4">
            <p className="text-[#888] text-xs uppercase tracking-wider mb-3">
              Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[#888] text-sm">Role</span>
                <span className="text-white text-sm capitalize">{role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888] text-sm">Name</span>
                <span className="text-white text-sm">{data.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888] text-sm">Categories</span>
                <span className="text-white text-sm">
                  {data.categories.length} selected
                </span>
              </div>
              {role === "creator" && data.tiktokUsername && (
                <div className="flex justify-between">
                  <span className="text-[#888] text-sm">TikTok</span>
                  <span className="text-white text-sm">
                    @{data.tiktokUsername}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1" />

          <button
            onClick={handleSubmit}
            disabled={!data.consentAccepted || submitting}
            className={`w-full rounded-xl py-4 text-base font-medium flex items-center justify-center gap-2 mt-8 ${
              data.consentAccepted && !submitting
                ? "btn-yellow font-bold"
                : "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
            }`}
          >
            {submitting ? "Submitting..." : "Complete Registration"}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-[#F5E642]/20 rounded-full flex items-center justify-center mb-6">
            <PartyPopper className="w-10 h-10 text-[#F5E642]" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            You&apos;re In!
          </h1>
          <p className="text-[#888] text-sm mb-8">
            Welcome to The Clearance. Your {role} account is ready.
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
              Share this to invite others
            </p>
          </div>

          <button
            onClick={handleGoToNext}
            className="btn-yellow w-full rounded-xl py-4 text-base font-bold flex items-center justify-center gap-2 mt-8"
          >
            {role === "creator" ? "Go to Creator Hub" : "Go to Arena"}{" "}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
