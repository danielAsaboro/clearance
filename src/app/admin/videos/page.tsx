"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Video as VideoIcon,
} from "lucide-react";
import { splitTagsInput } from "@/lib/video-admin";

interface VideoCategory {
  id: string;
  name: string;
  slug: string;
}

interface Video {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
  status: "processing" | "ready" | "failed";
  tags: string[];
  processingError: string | null;
  originalFilename: string | null;
  sourceBytes: number | null;
  category: VideoCategory | null;
  usedInMatchups: number;
}

type UploadQueueStatus =
  | "queued"
  | "uploading"
  | "registering"
  | "processing"
  | "ready"
  | "failed";

interface UploadQueueItem {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  uploadedBytes: number;
  bytesPerSecond: number;
  status: UploadQueueStatus;
  error: string | null;
  videoId: string | null;
}

const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
const maxBatchSize = 10;
const requestTimeoutMs = 15000;

async function readErrorMessage(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  }

  const text = await res.text().catch(() => "");
  if (text.trim()) return text;

  return `Request failed with status ${res.status}`;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatBytes(bytes: number | null) {
  if (bytes == null) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "Duration pending";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRate(bytesPerSecond: number) {
  if (bytesPerSecond <= 0) return "Calculating rate";
  return `${formatBytes(bytesPerSecond)}/s`;
}

function getQueueStatusLabel(status: UploadQueueStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "registering":
      return "Saving";
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function createUploadId(file: File) {
  return `${file.name}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function AdminVideos() {
  const { authenticated, ready, getAccessToken } = usePrivy();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    tags: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getToken = useCallback(async () => {
    if (!ready || !authenticated) {
      throw new Error("You must be signed in as an admin to manage videos.");
    }

    const token = await getAccessToken();
    if (!token) {
      throw new Error("Unable to get an admin access token.");
    }

    return token;
  }, [authenticated, getAccessToken, ready]);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const query = params.toString();
      const res = await fetchWithTimeout(
        query ? `/api/admin/videos?${query}` : "/api/admin/videos",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const freshVideos: Video[] = await res.json();
      setVideos(freshVideos);

      // Reconcile upload queue items with fresh server state
      setUploadQueue((current) => {
        const videoMap = new Map(freshVideos.map((v) => [v.id, v]));
        let changed = false;

        const next = current.map((item) => {
          if (!item.videoId) return item;
          if (item.status === "ready" || item.status === "failed") return item;

          const server = videoMap.get(item.videoId);
          if (!server) return item;

          if (server.status === "ready") {
            changed = true;
            return { ...item, status: "ready" as const, error: null };
          }
          if (server.status === "failed") {
            changed = true;
            return { ...item, status: "failed" as const, error: server.processingError };
          }
          return item;
        });

        return changed ? next : current;
      });
    } catch (err) {
      console.error("[admin/videos] Failed to load videos:", err);
      setVideos([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load the video library."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, search, statusFilter]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setVideos([]);
      setLoading(false);
      setError("You must be signed in as an admin to view the video library.");
      return;
    }
    void fetchVideos();
  }, [authenticated, fetchVideos, ready]);

  useEffect(() => {
    if (!videos.some((video) => video.status === "processing")) return;
    const interval = window.setInterval(() => {
      void fetchVideos();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [fetchVideos, videos]);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateUploadItem = useCallback(
    (uploadId: string, updater: (item: UploadQueueItem) => UploadQueueItem) => {
      setUploadQueue((current) =>
        current.map((item) => (item.id === uploadId ? updater(item) : item))
      );
    },
    []
  );

  const uploadSummary = useMemo(() => {
    const totalBytes = uploadQueue.reduce((sum, item) => sum + item.size, 0);
    const uploadedBytes = uploadQueue.reduce(
      (sum, item) => sum + Math.min(item.uploadedBytes, item.size),
      0
    );
    const completedCount = uploadQueue.filter(
      (item) => item.status === "processing" || item.status === "ready"
    ).length;
    const failedCount = uploadQueue.filter((item) => item.status === "failed").length;
    const activeRate = uploadQueue.reduce(
      (sum, item) =>
        item.status === "uploading" ? sum + item.bytesPerSecond : sum,
      0
    );

    return {
      totalCount: uploadQueue.length,
      completedCount,
      failedCount,
      uploadedBytes,
      totalBytes,
      activeRate,
      progress:
        totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0,
    };
  }, [uploadQueue]);

  const uploadSingleFile = useCallback(
    async (file: File, token: string, uploadId: string) => {
      updateUploadItem(uploadId, (item) => ({
        ...item,
        status: "uploading",
        error: null,
        progress: 0,
        uploadedBytes: 0,
        bytesPerSecond: 0,
      }));

      try {
        const presignRes = await fetchWithTimeout("/api/admin/videos/presign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });

        if (!presignRes.ok) {
          throw new Error(await readErrorMessage(presignRes));
        }

        const { uploadUrl, sourceKey } = await presignRes.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const startedAt = performance.now();

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;

            const elapsedSeconds = Math.max(
              (performance.now() - startedAt) / 1000,
              0.25
            );
            const uploadedBytes = event.loaded;

            updateUploadItem(uploadId, (item) => ({
              ...item,
              status: "uploading",
              uploadedBytes,
              progress: Math.round((uploadedBytes / file.size) * 100),
              bytesPerSecond: uploadedBytes / elapsedSeconds,
            }));
          };

          xhr.onload = () => {
            if (xhr.status < 400) {
              resolve();
              return;
            }
            reject(new Error(`Upload failed with status ${xhr.status}`));
          };

          xhr.onerror = () => reject(new Error("Upload failed during transfer."));
          xhr.send(file);
        });

        updateUploadItem(uploadId, (item) => ({
          ...item,
          status: "registering",
          uploadedBytes: file.size,
          progress: 100,
          bytesPerSecond: 0,
        }));

        const createRes = await fetchWithTimeout("/api/admin/videos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            originalFilename: file.name,
            sourceContentType: file.type,
            sourceBytes: file.size,
            sourceKey,
          }),
        });

        if (!createRes.ok) {
          throw new Error(await readErrorMessage(createRes));
        }

        const created = (await createRes.json()) as Video;
        setVideos((current) => [created, ...current.filter((video) => video.id !== created.id)]);

        updateUploadItem(uploadId, (item) => ({
          ...item,
          status: created.status === "ready" ? "ready" : "processing",
          uploadedBytes: file.size,
          progress: 100,
          bytesPerSecond: 0,
          videoId: created.id,
          error: created.processingError,
        }));
      } catch (err) {
        console.error("[admin/videos] Upload failed:", err);
        updateUploadItem(uploadId, (item) => ({
          ...item,
          status: "failed",
          bytesPerSecond: 0,
          error: err instanceof Error ? err.message : "Upload failed",
        }));
      }
    },
    [updateUploadItem]
  );

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (files.length > maxBatchSize) {
      alert(`You can upload between 1 and ${maxBatchSize} videos at a time.`);
      resetFileInput();
      return;
    }

    const invalidFile = files.find((file) => !allowedTypes.includes(file.type));
    if (invalidFile) {
      alert("Only mp4, webm, and mov files are allowed.");
      resetFileInput();
      return;
    }

    const pendingUploads = files.map((file) => ({
      id: createUploadId(file),
      file,
    }));

    setUploadQueue(
      pendingUploads.map(({ id, file }) => ({
        id,
        fileName: file.name,
        size: file.size,
        progress: 0,
        uploadedBytes: 0,
        bytesPerSecond: 0,
        status: "queued",
        error: null,
        videoId: null,
      }))
    );
    setBatchUploading(true);

    try {
      const token = await getToken();
      for (const upload of pendingUploads) {
        await uploadSingleFile(upload.file, token, upload.id);
      }
      void fetchVideos();
    } catch (err) {
      console.error("[admin/videos] Failed to start batch upload:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Could not start the upload batch."
      );
    } finally {
      setBatchUploading(false);
      resetFileInput();
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Delete this video and its stored assets?")) return;
    setBusyId(videoId);

    try {
      const token = await getToken();
      const res = await fetchWithTimeout(`/api/admin/videos/${videoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete video");
        return;
      }

      setVideos((current) => current.filter((video) => video.id !== videoId));
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (video: Video) => {
    setEditingId(video.id);
    setEditForm({
      title: video.title ?? "",
      tags: video.tags.join(", "),
    });
  };

  const saveEdit = async (videoId: string) => {
    setBusyId(videoId);

    try {
      const token = await getToken();
      const res = await fetchWithTimeout(`/api/admin/videos/${videoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editForm.title.trim() || null,
          tags: splitTagsInput(editForm.tags),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to save changes");
        return;
      }

      setVideos((current) =>
        current.map((video) => (video.id === videoId ? data : video))
      );
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const retryProcessing = async (videoId: string) => {
    setBusyId(videoId);

    try {
      const token = await getToken();
      const res = await fetchWithTimeout(`/api/admin/videos/${videoId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to reprocess video");
        return;
      }

      setVideos((current) =>
        current.map((video) => (video.id === videoId ? data : video))
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Video Library</h1>
          <p className="mt-1 text-sm text-[#7D7D7D]">
            Upload 1 to 10 videos at a time. Categorization can happen later from the library.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={batchUploading}
          className="btn-yellow rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {batchUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {uploadSummary.progress}%
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload Videos
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleUpload}
        className="hidden"
      />

      <section className="rounded-3xl border border-[#242424] bg-[linear-gradient(160deg,#171717,#0F0F0F)] p-5">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-4 w-4 text-[#F5E642]" />
          <h2 className="text-sm font-semibold text-white">Batch Upload</h2>
        </div>
        <p className="mt-2 text-sm text-[#7D7D7D]">
          Choose up to {maxBatchSize} files in one shot. Uploads run one at a time, and processing begins automatically after each file lands.
        </p>

        {uploadQueue.length > 0 ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[#242424] bg-black/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#B8B8B8]">
                <span>
                  {uploadSummary.completedCount}/{uploadSummary.totalCount} uploaded
                </span>
                <span>{formatBytes(uploadSummary.uploadedBytes)} of {formatBytes(uploadSummary.totalBytes)}</span>
                <span>{formatRate(uploadSummary.activeRate)}</span>
                <span>{uploadSummary.failedCount} failed</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#232323]">
                <div
                  className="h-full rounded-full bg-[#F5E642] transition-all"
                  style={{ width: `${uploadSummary.progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#242424] bg-[#121212] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {item.fileName}
                      </p>
                      <p className="mt-1 text-xs text-[#7D7D7D]">
                        {formatBytes(item.size)} • {formatRate(item.bytesPerSecond)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        item.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : item.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : item.status === "processing"
                              ? "bg-sky-500/10 text-sky-300"
                              : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {getQueueStatusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#232323]">
                    <div
                      className="h-full rounded-full bg-[#F5E642] transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7D7D7D]">
                    <span>{item.progress}% complete</span>
                    <span>
                      {formatBytes(item.uploadedBytes)} of {formatBytes(item.size)}
                    </span>
                  </div>

                  {item.error ? (
                    <p className="mt-2 text-xs text-red-400/90">{item.error}</p>
                  ) : item.status === "processing" ? (
                    <p className="mt-2 text-xs text-sky-300/90">
                      Upload complete. Video processing has started.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[#2A2A2A] bg-black/30 px-4 py-8 text-center">
            <VideoIcon className="mx-auto h-10 w-10 text-[#3B3B3B]" />
            <p className="mt-3 text-sm text-[#9A9A9A]">
              No batch in progress. Tap <span className="text-white">Upload Videos</span> to add 1 to {maxBatchSize} clips.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#242424] bg-[#111] p-5">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A5A5A]" />
            <input
              type="text"
              placeholder="Search by title or tag"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-[#242424] bg-black px-11 py-3 text-sm text-white outline-none focus:border-[#F5E642]/60"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-[#242424] bg-black px-4 py-3 text-sm text-white outline-none focus:border-[#F5E642]/60"
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#F5E642]" />
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <p className="text-sm font-medium text-red-300">{error}</p>
          <button
            onClick={() => void fetchVideos()}
            className="mt-4 rounded-xl border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-200"
          >
            Retry loading videos
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#2B2B2B] bg-[#101010] py-16 text-center">
          <VideoIcon className="mx-auto h-10 w-10 text-[#373737]" />
          <p className="mt-4 text-sm text-[#9A9A9A]">No videos match the current filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {videos.map((video) => {
            const isEditing = editingId === video.id;
            const isBusy = busyId === video.id;

            return (
              <article
                key={video.id}
                className="overflow-hidden rounded-3xl border border-[#242424] bg-[#111]"
              >
                <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                  <div className="aspect-video bg-black">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title ?? "Video"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <VideoIcon className="h-8 w-8 text-[#333]" />
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {video.title ?? "Untitled"}
                        </h3>
                        <p className="mt-1 text-xs text-[#7D7D7D]">
                          {formatDuration(video.duration)} • {formatBytes(video.sourceBytes)}
                        </p>
                        {video.originalFilename ? (
                          <p className="mt-1 text-xs text-[#5F5F5F]">
                            Source: {video.originalFilename}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          video.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : video.status === "failed"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {video.status}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {video.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#1A1A1A] px-2.5 py-1 text-[11px] text-[#CFCFCF]"
                        >
                          #{tag}
                        </span>
                      ))}
                      {video.tags.length === 0 ? (
                        <span className="text-xs text-[#5A5A5A]">No tags</span>
                      ) : null}
                    </div>

                    <div className="mt-4 text-xs text-[#7D7D7D]">
                      <p>Uploaded {new Date(video.createdAt).toLocaleString()}</p>
                      <p>{video.usedInMatchups} matchup references</p>
                      {video.processingError ? (
                        <p className="mt-2 text-red-400/80">{video.processingError}</p>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-4 space-y-3 rounded-2xl border border-[#242424] bg-black/50 p-3">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-[#242424] bg-[#0E0E0E] px-3 py-2 text-sm text-white outline-none focus:border-[#F5E642]/60"
                        />
                        <input
                          type="text"
                          value={editForm.tags}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              tags: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-[#242424] bg-[#0E0E0E] px-3 py-2 text-sm text-white outline-none focus:border-[#F5E642]/60"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => void saveEdit(video.id)}
                            disabled={isBusy}
                            className="rounded-xl bg-[#F5E642] px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-xl border border-[#2A2A2A] px-4 py-2 text-xs text-[#B5B5B5]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => startEdit(video)}
                          className="rounded-xl border border-[#2A2A2A] px-3 py-2 text-xs text-[#D5D5D5] flex items-center gap-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => void retryProcessing(video.id)}
                          disabled={isBusy}
                          className="rounded-xl border border-[#2A2A2A] px-3 py-2 text-xs text-[#D5D5D5] flex items-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} />
                          Reprocess
                        </button>
                        <button
                          onClick={() => void handleDeleteVideo(video.id)}
                          disabled={isBusy}
                          className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-400 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
