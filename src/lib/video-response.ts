import { getStorageMode } from "@/lib/storage";
import { getStorageAssetUrl } from "@/lib/storage-url";

type VideoAssetFields = {
  url: string;
  thumbnailUrl: string | null;
  sourceKey: string | null;
  playbackKey: string | null;
  thumbnailKey: string | null;
};

export function resolveVideoAssetUrls<T extends VideoAssetFields>(
  video: T,
  origin?: string
) {
  if (getStorageMode() !== "r2") {
    return video;
  }

  const playbackKey = video.playbackKey ?? video.sourceKey;

  return {
    ...video,
    url: playbackKey ? getStorageAssetUrl(playbackKey, origin) : video.url,
    thumbnailUrl: video.thumbnailKey
      ? getStorageAssetUrl(video.thumbnailKey, origin)
      : video.thumbnailUrl,
  };
}
