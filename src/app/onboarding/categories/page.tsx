"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";

const CATEGORIES = [
  "Afrobeats",
  "Nollywood",
  "Comedy Skits",
  "Fashion",
  "Food/Cooking",
  "Dance",
  "Tech",
  "Sports",
  "Education",
  "Lifestyle",
  "Beauty",
  "Motivation",
  "Music",
  "Gaming",
  "Fitness",
];

const TOTAL_STEPS = 4;

export default function CategoriesStep() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  const toggleCategory = (category: string) => {
    if (data.categories.includes(category)) {
      updateData({
        categories: data.categories.filter((c) => c !== category),
      });
    } else if (data.categories.length < 5) {
      updateData({ categories: [...data.categories, category] });
    }
  };

  const canContinue = data.categories.length === 5;

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <Image src="/spotr-logo.png" alt="Spotr TV" width={32} height={32} className="rounded-full" />
        <span className="text-[#888] text-xs tracking-wider">
          STEP 1 OF {TOTAL_STEPS}
        </span>
      </div>

      <ProgressBar currentStep={1} totalSteps={TOTAL_STEPS} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Pick Your Interests</h1>
        <p className="text-[#888] text-sm mt-1">
          Select exactly 5 content categories you love.
        </p>

        <div className="flex items-center justify-between mt-4 mb-2">
          <span className="text-[#888] text-xs tracking-wider uppercase">
            Categories
          </span>
          <span
            className={`text-xs font-medium ${
              data.categories.length === 5 ? "text-[#F5E642]" : "text-[#888]"
            }`}
          >
            {data.categories.length} of 5 selected
          </span>
        </div>

        <div className="flex flex-wrap gap-3 mt-2">
          {CATEGORIES.map((category) => {
            const selected = data.categories.includes(category);
            const disabled = !selected && data.categories.length >= 5;
            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                disabled={disabled}
                className={`px-5 py-3 rounded-full text-sm font-medium transition-all ${
                  selected
                    ? "bg-[#F5E642] text-black shadow-[0_0_12px_rgba(245,230,66,0.3)]"
                    : disabled
                    ? "bg-[#1A1A1A] text-[#444] border border-[#222] cursor-not-allowed"
                    : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A] hover:border-[#F5E642]/40"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push("/onboarding/contact")}
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
