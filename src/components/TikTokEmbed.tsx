"use client";

import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";

interface TikTokEmbedProps {
  url: string;
  thumbnailUrl?: string;
}

export default function TikTokEmbed({ url, thumbnailUrl }: TikTokEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  // Extract video ID for embed
  const videoIdMatch = url.match(/\/video\/(\d+)/);
  const videoId = videoIdMatch?.[1];

  if (!videoId) {
    return (
      <div className="w-full aspect-[9/16] bg-[#1A1A1A] rounded-2xl flex items-center justify-center">
        <p className="text-[#888] text-sm">Invalid TikTok URL</p>
      </div>
    );
  }

  return (
    <div>
      <div className="w-full aspect-[9/16] bg-[#1A1A1A] rounded-2xl overflow-hidden relative">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            {thumbnailUrl ? (
              <>
                <img
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40" />
              </>
            ) : null}
            <button
              onClick={() => setLoaded(true)}
              className="relative z-20 w-16 h-16 bg-[#F5E642] rounded-full flex items-center justify-center shadow-lg"
            >
              <Play className="w-8 h-8 text-black ml-1" fill="black" />
            </button>
          </div>
        )}
        {loaded && (
          <iframe
            src={`https://www.tiktok.com/embed/v2/${videoId}?autoplay=1`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1 text-[#888] text-xs mt-2 hover:text-[#F5E642] transition-colors"
      >
        Open on TikTok <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
