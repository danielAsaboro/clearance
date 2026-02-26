"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, CheckCircle } from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";

export default function Step4() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const terms = [
    "I understand this is a social-impact program focused on debt relief through content creation",
    "I consent to my submitted TikTok content being displayed in live voting sessions",
    "I understand that prize amounts are determined by fan voting outcomes",
    "I acknowledge that The Clearance does not guarantee specific debt relief amounts",
    "I retain ownership of my content and grant The Clearance a display license",
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/onboarding/step3">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">STEP 4 OF 5</span>
      </div>

      <ProgressBar currentStep={4} totalSteps={5} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Disclaimer & Consent</h1>
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
            onClick={() => updateData({ consentAccepted: !data.consentAccepted })}
            className={`w-11 h-6 rounded-full relative transition-all ${
              data.consentAccepted
                ? "bg-[#F5E642] shadow-[0_0_10px_rgba(245,230,66,0.4)]"
                : "bg-[#333]"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                data.consentAccepted ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push("/onboarding/step5")}
        disabled={!data.consentAccepted}
        className={`w-full rounded-xl py-4 text-base font-medium flex items-center justify-center gap-2 mt-8 ${
          data.consentAccepted
            ? "btn-yellow font-bold"
            : "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
        }`}
      >
        Continue <span className="text-lg">&rarr;</span>
      </button>
    </div>
  );
}
