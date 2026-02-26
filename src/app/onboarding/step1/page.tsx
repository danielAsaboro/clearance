"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";

const DEBT_OPTIONS = [
  "Betting",
  "Emergency Loan",
  "Medical Bills",
  "Business Debt",
  "None",
];

export default function Step1() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const toggleSource = (source: string) => {
    if (source === "None") {
      updateData({ debtSources: ["None"] });
      return;
    }
    const filtered = data.debtSources.filter((s) => s !== "None");
    if (filtered.includes(source)) {
      updateData({ debtSources: filtered.filter((s) => s !== source) });
    } else {
      updateData({ debtSources: [...filtered, source] });
    }
  };

  const canContinue = data.debtSources.length > 0;

  return (
    <div className="min-h-screen bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">STEP 1 OF 5</span>
      </div>

      <ProgressBar currentStep={1} totalSteps={5} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Tell Us Your Story</h1>
        <p className="text-[#888] text-sm mt-1">
          What type of debt are you dealing with? Select all that apply.
        </p>

        <div className="flex flex-wrap gap-3 mt-8">
          {DEBT_OPTIONS.map((option) => {
            const selected = data.debtSources.includes(option);
            return (
              <button
                key={option}
                onClick={() => toggleSource(option)}
                className={`px-5 py-3 rounded-full text-sm font-medium transition-all ${
                  selected
                    ? "bg-[#F5E642] text-black shadow-[0_0_12px_rgba(245,230,66,0.3)]"
                    : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A] hover:border-[#F5E642]/40"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push("/onboarding/step2")}
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
