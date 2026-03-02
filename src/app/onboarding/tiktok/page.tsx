"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, AtSign } from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";

export default function TiktokStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") ?? "creator";
  const totalSteps = 7;

  const { data, updateData } = useOnboarding();

  const canContinue = data.tiktokUsername.trim() !== "";

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/onboarding/commitment?role=${role}`}>
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">STEP 6 OF {totalSteps}</span>
      </div>

      <ProgressBar currentStep={6} totalSteps={totalSteps} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Your TikTok</h1>
        <p className="text-[#888] text-sm mt-1">
          Enter your TikTok username so we can verify your content submissions.
        </p>

        <div className="mt-8">
          <label className="text-[#888] text-xs tracking-wider uppercase block mb-2">
            TikTok Username
          </label>
          <div className="relative">
            <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input
              type="text"
              placeholder="username"
              value={data.tiktokUsername}
              onChange={(e) => updateData({ tiktokUsername: e.target.value })}
              className="w-full bg-[#1A1A1A] text-white rounded-xl pl-10 pr-4 py-4 text-sm outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#555]"
            />
          </div>
          <p className="text-[#555] text-xs mt-2">
            Letters, numbers, underscores and dots only
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push(`/onboarding/complete?role=${role}`)}
        disabled={!canContinue}
        className={`w-full rounded-xl py-4 text-base font-medium flex items-center justify-center gap-2 mt-8 ${
          canContinue
            ? "btn-yellow font-bold"
            : "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
        }`}
      >
        Continue <span className="text-lg">&rarr;</span>
      </button>
    </div>
  );
}
