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
  title,
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
    <div className="w-full aspect-[9/16] bg-[#1A1A1A] rounded-2xl overflow-hidden relative">
      <video
        ref={videoRef}
        src={url}
        poster={thumbnailUrl ?? undefined}
        autoPlay={autoplay}
        muted={muted}
        loop
        playsInline
        className="w-full h-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Play overlay (shows when not playing and no autoplay) */}
      {!playing && !autoplay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <button
            onClick={handlePlay}
            className="w-16 h-16 bg-[#F5E642] rounded-full flex items-center justify-center shadow-lg"
          >
            <Play className="w-8 h-8 text-black ml-1" fill="black" />
          </button>
        </div>
      )}

      {/* Mute toggle */}
      {playing && (
        <button
          onClick={toggleMute}
          className="absolute bottom-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-white" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
        </button>
      )}

      {/* Title overlay */}
      {title && (
        <div className="absolute bottom-3 left-3 right-12">
          <p className="text-white text-xs font-medium truncate bg-black/40 rounded-lg px-2 py-1">
            {title}
          </p>
        </div>
      )}
    </div>
  );
}
