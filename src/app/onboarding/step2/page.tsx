"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";

export default function Step2() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const canContinue = data.willingToDeclare !== null;

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/onboarding/step1">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">STEP 2 OF 5</span>
      </div>

      <ProgressBar currentStep={2} totalSteps={5} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Your Commitment</h1>
        <p className="text-[#888] text-sm mt-1">
          Are you willing to publicly declare your debt situation as part of the program?
        </p>

        <div className="space-y-4 mt-8">
          {/* Yes Card */}
          <button
            onClick={() => updateData({ willingToDeclare: true })}
            className={`w-full p-5 rounded-2xl border text-left transition-all ${
              data.willingToDeclare === true
                ? "bg-[#F5E642]/10 border-[#F5E642] shadow-[0_0_12px_rgba(245,230,66,0.2)]"
                : "bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#F5E642]/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckCircle
                className={`w-6 h-6 ${
                  data.willingToDeclare === true ? "text-[#F5E642]" : "text-[#555]"
                }`}
              />
              <div>
                <p className="font-bold text-white">Yes, I&apos;m ready</p>
                <p className="text-[#888] text-sm mt-0.5">
                  I&apos;m willing to share my story for debt relief
                </p>
              </div>
            </div>
          </button>

          {/* No Card */}
          <button
            onClick={() => updateData({ willingToDeclare: false })}
            className={`w-full p-5 rounded-2xl border text-left transition-all ${
              data.willingToDeclare === false
                ? "bg-[#F5E642]/10 border-[#F5E642] shadow-[0_0_12px_rgba(245,230,66,0.2)]"
                : "bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#F5E642]/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <XCircle
                className={`w-6 h-6 ${
                  data.willingToDeclare === false ? "text-[#F5E642]" : "text-[#555]"
                }`}
              />
              <div>
                <p className="font-bold text-white">Not right now</p>
                <p className="text-[#888] text-sm mt-0.5">
                  I prefer to keep my situation private
                </p>
              </div>
            </div>
          </button>
        </div>

        {data.willingToDeclare === false && (
          <div className="bg-[#1A1A1A] rounded-xl p-4 mt-4 border border-[#2A2A2A]">
            <p className="text-[#888] text-xs">
              Note: Creators who don&apos;t declare may have limited eligibility for
              certain debt relief programs. You can change this later.
            </p>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push("/onboarding/step3")}
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
