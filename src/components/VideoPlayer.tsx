"use client";

import { useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  autoplay?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

export default function VideoPlayer({
  url,
  thumbnailUrl,
  autoplay = true,
  muted: mutedProp,
  onToggleMute,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [localMuted, setLocalMuted] = useState(true);

  const muted = mutedProp !== undefined ? mutedProp : localMuted;

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const toggleMute = () => {
    if (onToggleMute) {
      onToggleMute();
    } else if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setLocalMuted(videoRef.current.muted);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1a1a]">
      <video
        ref={videoRef}
        src={url}
        poster={thumbnailUrl ?? undefined}
        autoPlay={autoplay}
        muted={muted}
        loop
        playsInline
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Play overlay (shows when not playing and no autoplay) */}
      {!playing && !autoplay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <button
            onClick={handlePlay}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f5d63d] shadow-lg"
          >
            <Play className="ml-1 h-8 w-8 text-black" fill="black" />
          </button>
        </div>
      )}

      {playing && (
        <button
          onClick={toggleMute}
          className="absolute bottom-20 right-5 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/38 backdrop-blur-[1px]"
        >
          {muted ? (
            <VolumeX className="h-4 w-4 text-white" />
          ) : (
            <Volume2 className="h-4 w-4 text-white" />
          )}
        </button>
      )}
    </div>
  );
}
