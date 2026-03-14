import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import { createVideoSearchText, getFileExtension } from "@/lib/video-admin";
import {
  deleteObjectFromStorage,
  downloadObjectToTempFile,
  getPublicUrlForKey,
  uploadFileToStorage,
} from "@/lib/storage";

const execFileAsync = promisify(execFile);
const activeVideoJobs = new Set<string>();
let pendingSweepPromise: Promise<void> | null = null;

interface ProbeResult {
  format?: { duration?: string };
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
    duration?: string;
  }>;
}

function getProcessingOutputBase(videoId: string, categorySlug: string) {
  return `videos/${categorySlug}/processed/${videoId}`;
}

function getSourceExtension(video: {
  sourceKey: string | null;
  originalFilename: string | null;
}) {
  return (
    getFileExtension(video.originalFilename ?? "") ||
    getFileExtension(video.sourceKey ?? "") ||
    "mp4"
  );
}

async function probeVideo(filePath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);
  const result = JSON.parse(stdout) as ProbeResult;
  const videoStream = result.streams?.find((stream) => stream.codec_type === "video");
  const durationSource = videoStream?.duration ?? result.format?.duration ?? "0";

  const metadata = {
    duration: Math.max(0, Math.round(Number(durationSource) || 0)),
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
  };

  console.log(`[video] probeVideo result:`, {
    rawDuration: durationSource,
    duration: metadata.duration,
    width: metadata.width,
    height: metadata.height,
  });

  return metadata;
}

async function transcodeVideo(sourcePath: string, outputPath: string) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputPath,
  ]);
}

async function createThumbnail(sourcePath: string, outputPath: string) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-ss",
    "00:00:00.000",
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
}

async function setVideoFailure(videoId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Video processing failed";
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "failed",
      processingError: message.slice(0, 500),
    },
  });
}

export async function processVideoById(videoId: string) {
  if (activeVideoJobs.has(videoId)) {
    console.log(`[video] Skipping ${videoId}: already being processed`);
    return;
  }
  activeVideoJobs.add(videoId);

  let tempDir: string | null = null;
  let sourcePath: string | null = null;
  let playbackKey: string | null = null;
  let thumbnailKey: string | null = null;

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { category: true },
    });

    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    if (!video.sourceKey) {
      throw new Error(`Video ${videoId} has no source key`);
    }

    const categorySlug = video.category?.slug ?? "uncategorized";
    const outputBase = getProcessingOutputBase(video.id, categorySlug);
    playbackKey = `${outputBase}.mp4`;
    thumbnailKey = `${outputBase}.jpg`;
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "spotr-process-"));
    sourcePath = await downloadObjectToTempFile(video.sourceKey, getSourceExtension(video));
    const playbackPath = path.join(tempDir, "playback.mp4");
    const thumbnailPath = path.join(tempDir, "thumbnail.jpg");

    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: "processing",
        processingError: null,
      },
    });

    await transcodeVideo(sourcePath, playbackPath);
    await createThumbnail(sourcePath, thumbnailPath);

    const metadata = await probeVideo(sourcePath);
    const sourceBytes = video.sourceBytes ?? (await fs.promises.stat(sourcePath)).size;
    const playbackStats = await fs.promises.stat(playbackPath);
    const shouldUseOptimized = playbackStats.size < sourceBytes;

    const thumbnailUrl = await uploadFileToStorage(thumbnailKey, thumbnailPath, "image/jpeg");

    let playbackUrl = getPublicUrlForKey(video.sourceKey);
    let finalPlaybackKey: string | null = null;

    if (shouldUseOptimized) {
      playbackUrl = await uploadFileToStorage(playbackKey, playbackPath, "video/mp4");
      finalPlaybackKey = playbackKey;
    } else {
      await deleteObjectFromStorage(playbackKey);
    }

    console.log(`[video] Writing metadata for ${video.id}:`, {
      duration: metadata.duration > 0 ? metadata.duration : (video.duration ?? null),
      width: metadata.width,
      height: metadata.height,
      sourceBytes,
      hasThumbnail: !!thumbnailUrl,
      hasPlayback: !!playbackUrl,
    });

    await prisma.video.update({
      where: { id: video.id },
      data: {
        url: playbackUrl,
        thumbnailUrl,
        duration: metadata.duration > 0 ? metadata.duration : (video.duration ?? null),
        width: metadata.width,
        height: metadata.height,
        sourceBytes,
        thumbnailKey,
        playbackKey: finalPlaybackKey,
        status: "ready",
        processingError: null,
        searchText: createVideoSearchText({
          title: video.title,
          categoryName: video.category?.name,
          tags: video.tags,
        }),
      },
    });

    console.log(`[video] Processing complete for ${videoId}`);
  } catch (error) {
    if (thumbnailKey) await deleteObjectFromStorage(thumbnailKey).catch(() => {});
    if (playbackKey) await deleteObjectFromStorage(playbackKey).catch(() => {});
    await setVideoFailure(videoId, error).catch(() => {});
    throw error;
  } finally {
    if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    if (sourcePath) await fs.promises.rm(path.dirname(sourcePath), { recursive: true, force: true }).catch(() => {});
    activeVideoJobs.delete(videoId);
  }
}

export async function processPendingVideos(limit = 10) {
  const pending = await prisma.video.findMany({
    where: { status: { in: ["processing", "failed"] }, sourceKey: { not: null } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results = [];
  for (const video of pending) {
    try {
      await processVideoById(video.id);
      results.push({ id: video.id, status: "ready" as const });
    } catch (error) {
      results.push({
        id: video.id,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Video processing failed",
      });
    }
  }

  return results;
}

export function queueVideoProcessingById(videoId: string) {
  if (activeVideoJobs.has(videoId)) {
    console.log(`[video] Skipping queue for ${videoId}: already active`);
    return;
  }

  console.log(`[video] Queuing processing for ${videoId}`);

  void processVideoById(videoId)
    .catch((error) => {
      console.error(`[video] Processing failed for ${videoId}:`, error);
      // Safety net: processVideoById should have already called setVideoFailure,
      // but ensure the video is marked failed even if that inner call was skipped.
      setVideoFailure(videoId, error).catch(() => {});
    });
}

export function queuePendingVideoProcessing(limit = 10) {
  if (pendingSweepPromise) {
    return pendingSweepPromise;
  }

  pendingSweepPromise = processPendingVideos(limit)
    .catch((error) => {
      console.error("[video] Pending processing sweep failed:", error);
    })
    .then(() => undefined)
    .finally(() => {
      pendingSweepPromise = null;
    });

  return pendingSweepPromise;
}
