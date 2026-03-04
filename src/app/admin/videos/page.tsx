"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Upload, Trash2, Search, Film, Loader2 } from "lucide-react";

interface Video {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  createdAt: string;
}

export default function AdminVideos() {
  const { getAccessToken } = usePrivy();
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVideos = useCallback(async () => {
    const token = await getAccessToken();
    const url = search
      ? `/api/admin/videos?search=${encodeURIComponent(search)}`
      : "/api/admin/videos";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setVideos(await res.json());
  }, [getAccessToken, search]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only mp4, webm, and mov files are allowed");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const token = await getAccessToken();

      // Get presigned URL
      const presignRes = await fetch("/api/admin/videos/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!presignRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await presignRes.json();

      // Upload to S3 with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => (xhr.status < 400 ? resolve() : reject());
        xhr.onerror = reject;
        xhr.send(file);
      });

      // Create video record
      await fetch("/api/admin/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ""),
          url: publicUrl,
        }),
      });

      fetchVideos();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this video?")) return;
    setDeleting(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/videos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
      fetchVideos();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Video Library</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-yellow px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> Upload
              </>
            )}
          </button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="mb-4">
          <div className="w-full bg-[#2A2A2A] rounded-full h-2">
            <div
              className="bg-[#F5E642] h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
        <input
          type="text"
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#1A1A1A] text-white text-sm rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#444] border border-[#2A2A2A]"
        />
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-2 gap-3">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden"
          >
            <div className="aspect-video bg-[#111] relative">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title ?? "Video"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-8 h-8 text-[#333]" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-white text-xs font-medium truncate">
                {video.title ?? "Untitled"}
              </p>
              <p className="text-[#555] text-[10px] mt-1">
                {new Date(video.createdAt).toLocaleDateString()}
              </p>
              <button
                onClick={() => handleDelete(video.id)}
                disabled={deleting === video.id}
                className="mt-2 text-red-400/60 hover:text-red-400 text-[10px] flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                {deleting === video.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {videos.length === 0 && !uploading && (
        <div className="text-center py-16">
          <Film className="w-16 h-16 text-[#333] mx-auto mb-4" />
          <p className="text-[#888] text-sm">No videos uploaded yet.</p>
          <p className="text-[#555] text-xs mt-1">
            Upload mp4 files to build your video library.
          </p>
        </div>
      )}
    </div>
  );
}
