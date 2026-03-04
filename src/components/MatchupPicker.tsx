"use client";

import { useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import { Check, TrendingUp } from "lucide-react";

interface VideoData {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
}

interface MatchupPickerProps {
  videoA: VideoData;
  videoB: VideoData;
  onPick: (decision: "video_a" | "video_b") => void;
  voted: "video_a" | "video_b" | null;
  disabled?: boolean;
}

export default function MatchupPicker({
  videoA,
  videoB,
  onPick,
  voted,
  disabled = false,
}: MatchupPickerProps) {
  const [activeVideo, setActiveVideo] = useState<"a" | "b">("a");

  const currentVideo = activeVideo === "a" ? videoA : videoB;

  return (
    <div className="flex flex-col h-full">
      {/* Toggle Bar */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setActiveVideo("a")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            activeVideo === "a"
              ? "bg-[#F5E642] text-black"
              : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
          }`}
        >
          Video A
        </button>
        <button
          onClick={() => setActiveVideo("b")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            activeVideo === "b"
              ? "bg-[#F5E642] text-black"
              : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
          }`}
        >
          Video B
        </button>
      </div>

      {/* Video Player */}
      <div className="flex-1 min-h-0">
        <VideoPlayer
          key={currentVideo.id}
          url={currentVideo.url}
          thumbnailUrl={currentVideo.thumbnailUrl}
          title={currentVideo.title}
          autoplay
        />
      </div>

      {/* Pick Buttons */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onPick("video_a")}
          disabled={voted !== null || disabled}
          className={`flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            voted === "video_a"
              ? "bg-[#F5E642] text-black"
              : voted !== null
              ? "bg-[#1A1A1A] text-[#444] cursor-not-allowed"
              : "bg-[#1A1A1A] text-white border border-[#2A2A2A] hover:border-[#F5E642]/50"
          }`}
        >
          {voted === "video_a" ? (
            <>
              <Check className="w-4 h-4" /> Picked A
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" /> A will trend
            </>
          )}
        </button>
        <button
          onClick={() => onPick("video_b")}
          disabled={voted !== null || disabled}
          className={`flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            voted === "video_b"
              ? "bg-[#F5E642] text-black"
              : voted !== null
              ? "bg-[#1A1A1A] text-[#444] cursor-not-allowed"
              : "bg-[#1A1A1A] text-white border border-[#2A2A2A] hover:border-[#F5E642]/50"
          }`}
        >
          {voted === "video_b" ? (
            <>
              <Check className="w-4 h-4" /> Picked B
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" /> B will trend
            </>
          )}
        </button>
      </div>
    </div>
  );
}
