import { getStorageAssetPath, getStorageAssetUrl } from "@/lib/storage-url";
import { resolveVideoAssetUrls } from "@/lib/video-response";

describe("storage-url helpers", () => {
  it("encodes storage keys into proxy paths", () => {
    expect(getStorageAssetPath("videos/test clip.mp4")).toBe(
      "/api/storage/videos/test%20clip.mp4"
    );
  });

  it("builds absolute asset urls when an origin is provided", () => {
    expect(
      getStorageAssetUrl("videos/test clip.mp4", "https://app.spotr.tv")
    ).toBe("https://app.spotr.tv/api/storage/videos/test%20clip.mp4");
  });
});

describe("resolveVideoAssetUrls", () => {
  const originalStorageMode = process.env.STORAGE_MODE;

  afterEach(() => {
    process.env.STORAGE_MODE = originalStorageMode;
  });

  it("rewrites playback and thumbnail urls for r2-backed videos", () => {
    process.env.STORAGE_MODE = "r2";

    expect(
      resolveVideoAssetUrls(
        {
          url: "https://broken.example/video.mp4",
          thumbnailUrl: "https://broken.example/thumb.jpg",
          sourceKey: "videos/uploads/source/raw.mp4",
          playbackKey: "videos/processed/playback.mp4",
          thumbnailKey: "videos/processed/thumb.jpg",
        },
        "https://localhost:3000"
      )
    ).toEqual({
      url: "https://localhost:3000/api/storage/videos/processed/playback.mp4",
      thumbnailUrl: "https://localhost:3000/api/storage/videos/processed/thumb.jpg",
      sourceKey: "videos/uploads/source/raw.mp4",
      playbackKey: "videos/processed/playback.mp4",
      thumbnailKey: "videos/processed/thumb.jpg",
    });
  });
});
