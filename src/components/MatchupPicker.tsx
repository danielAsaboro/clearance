"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import VideoPlayer from "@/components/VideoPlayer";

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
  muted?: boolean;
  onToggleMute?: () => void;
}

export default function MatchupPicker({
  videoA,
  videoB,
  onPick,
  voted,
  muted: mutedProp,
  onToggleMute: onToggleMuteProp,
}: MatchupPickerProps) {
  const [activeVideo, setActiveVideo] = useState<"a" | "b">("a");
  const [localMuted, setLocalMuted] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);

  const muted = mutedProp !== undefined ? mutedProp : localMuted;
  const handleToggleMute = onToggleMuteProp ?? (() => setLocalMuted((m) => !m));

  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPickRef = useRef<"video_a" | "video_b" | null>(null);
  const ignoringScrollRef = useRef(false);
  const [slotHeight, setSlotHeight] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0) setSlotHeight(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (ignoringScrollRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    if (!hasScrolled) setHasScrolled(true);

    const pos = Math.round(el.scrollTop / el.clientHeight);

    // Positions: 0=A, 1=B, 2=A_clone (cyclic)
    // When reaching clone, set vote then silently jump back to real A
    if (pos >= 2) {
      if (lastPickRef.current !== "video_a") {
        lastPickRef.current = "video_a";
        setActiveVideo("a");
        onPick("video_a");
      }
      ignoringScrollRef.current = true;
      el.scrollTop = 0;
      requestAnimationFrame(() => {
        ignoringScrollRef.current = false;
      });
      return;
    }

    const pick = pos === 1 ? "video_b" : "video_a";
    const active = pick === "video_a" ? "a" : "b";
    if (pick !== lastPickRef.current) {
      lastPickRef.current = pick;
      setActiveVideo(active);
      onPick(pick);
    }
  }, [onPick, hasScrolled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div ref={outerRef} className="flex-1 min-h-0">
      {slotHeight > 0 && (
        <div
          ref={containerRef}
          style={{
            height: slotHeight,
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            scrollbarWidth: "none",
          }}
        >
          {/* Slot 0 — Video A */}
          <div style={{ height: slotHeight }} className="snap-start relative overflow-hidden">
            <VideoPlayer
              url={videoA.url}
              thumbnailUrl={videoA.thumbnailUrl}
              title={videoA.title}
              autoplay
              muted={activeVideo !== "a" || muted}
              onToggleMute={activeVideo === "a" ? handleToggleMute : undefined}
            />
            {voted === "video_a" && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 text-[#F5E642] text-sm font-bold rounded-full pointer-events-none">
                Your pick ✓
              </div>
            )}
            {!hasScrolled && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 text-white text-sm rounded-full pointer-events-none animate-bounce">
                ↓ scroll to compare
              </div>
            )}
          </div>

          {/* Slot 1 — Video B */}
          <div style={{ height: slotHeight }} className="snap-start relative overflow-hidden">
            <VideoPlayer
              url={videoB.url}
              thumbnailUrl={videoB.thumbnailUrl}
              title={videoB.title}
              autoplay
              muted={activeVideo !== "b" || muted}
              onToggleMute={activeVideo === "b" ? handleToggleMute : undefined}
            />
            {voted === "video_b" && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 text-[#F5E642] text-sm font-bold rounded-full pointer-events-none">
                Your pick ✓
              </div>
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 text-white text-sm rounded-full pointer-events-none">
              ↑ back · ↓ loop
            </div>
          </div>

          {/* Slot 2 — Video A clone (cyclic anchor) */}
          <div style={{ height: slotHeight }} className="snap-start relative overflow-hidden">
            <VideoPlayer
              url={videoA.url}
              thumbnailUrl={videoA.thumbnailUrl}
              title={videoA.title}
              autoplay
              muted={true}
            />
            {voted === "video_a" && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 text-[#F5E642] text-sm font-bold rounded-full pointer-events-none">
                Your pick ✓
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
