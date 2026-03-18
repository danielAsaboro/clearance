"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
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
  roundNumber?: number;
}

function parseVideoMeta(title: string | null | undefined) {
  if (!title) return { username: "@spotr_creator", productTitle: "Sponsored Drop" };

  const dashMatch = title.match(/^@?(\S+)\s*[—–-]\s*(.+)$/);
  if (dashMatch) {
    return { username: `@${dashMatch[1]}`, productTitle: dashMatch[2] };
  }

  const byMatch = title.match(/^@?(\S+)\s+(.+)$/);
  if (byMatch) {
    return { username: `@${byMatch[1]}`, productTitle: byMatch[2] };
  }

  return { username: "@spotr_creator", productTitle: title };
}

export default function MatchupPicker({
  videoA,
  videoB,
  onPick,
  voted,
  muted: mutedProp,
  onToggleMute: onToggleMuteProp,
  roundNumber,
}: MatchupPickerProps) {
  const [activeVideo, setActiveVideo] = useState<"a" | "b">("a");
  const [localMuted, setLocalMuted] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);

  const muted = mutedProp !== undefined ? mutedProp : localMuted;
  const handleToggleMute = onToggleMuteProp ?? (() => setLocalMuted((prev) => !prev));

  const containerRef = useRef<HTMLDivElement>(null);
  const ignoringScrollRef = useRef(false);
  const flipLockRef = useRef(false);

  const handleScroll = useCallback(() => {
    const scroller = containerRef.current;
    if (!scroller || ignoringScrollRef.current) return;

    if (!hasScrolled) setHasScrolled(true);

    const position = Math.round(scroller.scrollTop / scroller.clientHeight);
    const pick = position === 1 ? "video_b" : "video_a";
    setActiveVideo(pick === "video_a" ? "a" : "b");

    if (position >= 2) {
      ignoringScrollRef.current = true;
      scroller.scrollTop = 0;
      requestAnimationFrame(() => {
        ignoringScrollRef.current = false;
      });
    }
  }, [hasScrolled]);

  useEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) return;
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToSlot = (slot: number) => {
    const scroller = containerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: slot * scroller.clientHeight, behavior: "smooth" });
  };

  const flipTo = useCallback((slot: number) => {
    if (flipLockRef.current) return;
    flipLockRef.current = true;
    const scroller = containerRef.current;
    if (scroller) scroller.scrollTo({ top: slot * scroller.clientHeight, behavior: "smooth" });
    setTimeout(() => { flipLockRef.current = false; }, 350);
  }, []);

  useEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      flipTo(e.deltaY > 0 ? 1 : 0);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [flipTo]);

  useEffect(() => {
    const scroller = containerRef.current;
    if (!scroller) return;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0].clientY; };
    const onTouchEnd = (e: TouchEvent) => {
      const delta = startY - e.changedTouches[0].clientY;
      if (Math.abs(delta) > 30) flipTo(delta > 0 ? 1 : 0);
    };
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchend", onTouchEnd);
    };
  }, [flipTo]);

  const renderAction = (videoKey: "video_a" | "video_b") => {
    if (voted === null) {
      return (
        <button
          onClick={() => onPick(videoKey)}
          className="spotr-primary-button absolute bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-2"
        >
          <Eye className="h-4 w-4" />
          SPOT THIS
        </button>
      );
    }

    if (voted === videoKey) {
      return (
        <div className="absolute bottom-4 left-4 right-4 z-20 flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border border-[#f5d63d] bg-[#121212]/76 text-[15px] font-semibold text-[#f5d63d] backdrop-blur-sm">
          <Eye className="h-4 w-4" />
          YOUR SPOT
        </div>
      );
    }

    return (
      <button
        onClick={() => onPick(videoKey)}
        className="absolute bottom-4 left-4 right-4 z-20 flex min-h-[52px] items-center justify-center rounded-[14px] border border-[#898989] bg-[#141414]/76 text-[15px] font-semibold text-white backdrop-blur-sm"
      >
        Switch Spot
      </button>
    );
  };

  const renderSlot = (video: VideoData, label: "VIDEO A" | "VIDEO B", videoKey: "video_a" | "video_b") => {
    const meta = parseVideoMeta(video.title);

    return (
      <div className="relative h-full shrink-0 snap-start overflow-hidden">
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-[#242424] px-4 py-[5px] text-[10px] font-semibold tracking-[0.03em] text-white">
          {label}
        </div>

        {roundNumber != null ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="font-display select-none text-[160px] font-bold leading-none tracking-[-0.06em] text-white/[0.06]">
              {String(roundNumber).padStart(2, "0")}
            </span>
          </div>
        ) : null}

        {voted === videoKey ? (
          <div className="absolute right-4 top-5 z-20 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5d63d] shadow-[0_0_28px_rgba(245,214,61,0.35)]">
            <Eye className="h-6 w-6 text-black" />
          </div>
        ) : null}

        <VideoPlayer
          url={video.url}
          thumbnailUrl={video.thumbnailUrl}
          title={video.title}
          autoplay
          muted={activeVideo !== (videoKey === "video_a" ? "a" : "b") || muted}
          onToggleMute={activeVideo === (videoKey === "video_a" ? "a" : "b") ? handleToggleMute : undefined}
        />

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/36 to-transparent px-4 pb-20 pt-24">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-white">{meta.username}</p>
              <p className="truncate pt-1 text-[14px] text-[#c8c8c8]">{meta.productTitle}</p>
            </div>
            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.03em] text-[#c7ac34]">
              Sponsored Drop
            </p>
          </div>
        </div>

        {renderAction(videoKey)}
      </div>
    );
  };

  return (
    <div className="relative h-full overflow-hidden rounded-[18px]">
      <div
        ref={containerRef}
        className="h-full"
        style={{
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
        }}
      >
        {renderSlot(videoA, "VIDEO A", "video_a")}
        {renderSlot(videoB, "VIDEO B", "video_b")}
        {/* Third slot loops Video A so scroll wraps seamlessly */}
        <div className="h-full shrink-0 snap-start overflow-hidden">
          <VideoPlayer url={videoA.url} thumbnailUrl={videoA.thumbnailUrl} title={videoA.title} autoplay muted />
        </div>
      </div>

      <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
        <button
          onClick={() => flipTo(0)}
          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-[0_0_0_1px_rgba(245,214,61,0.14)] ${activeVideo === "a" ? "bg-[#d4bc40] text-black" : "bg-[#353535] text-white"}`}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => flipTo(1)}
          className={`flex h-9 w-9 items-center justify-center rounded-full ${activeVideo === "b" ? "bg-[#d4bc40] text-black" : "bg-[#353535] text-white"}`}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {!hasScrolled && voted === null ? (
        <div className="pointer-events-none absolute right-4 top-[44%] z-20 text-[11px] font-medium uppercase tracking-[0.08em] text-white/38">
          Compare
        </div>
      ) : null}
    </div>
  );
}
