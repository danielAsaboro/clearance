"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowLeft, Eye, AtSign, Upload, X, Loader2 } from "lucide-react";
import Link from "next/link";
import ProgressBar from "@/components/ProgressBar";
import { useOnboarding } from "@/lib/onboarding-context";

export default function Step3() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const { data, updateData } = useOnboarding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(data.profilePhoto || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canContinue = data.displayName.trim() !== "" && data.tiktokUsername.trim() !== "";

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be under 2MB");
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const token = await getAccessToken();

      // Get presigned URL
      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!presignRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await presignRes.json();

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      // Store the public URL
      updateData({ profilePhoto: publicUrl });
      setPreview(publicUrl);
    } catch {
      setUploadError("Upload failed. Please try again.");
      setPreview(null);
      updateData({ profilePhoto: "" });
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setPreview(null);
    updateData({ profilePhoto: "" });
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/onboarding/step2">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <span className="text-[#888] text-xs tracking-wider">STEP 3 OF 5</span>
      </div>

      <ProgressBar currentStep={3} totalSteps={5} />

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-white">Set Up Your Profile</h1>
        <p className="text-[#888] text-sm mt-1">Tell us about yourself to get started</p>

        <div className="mt-8">
          <label className="text-[#888] text-xs tracking-wider uppercase block mb-2">
            Display Name
          </label>
          <input
            type="text"
            placeholder="Your creator name"
            value={data.displayName}
            onChange={(e) => updateData({ displayName: e.target.value })}
            className="w-full bg-[#1A1A1A] text-white rounded-xl px-4 py-4 text-sm outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#555]"
          />
        </div>

        <div className="mt-6">
          <label className="text-[#888] text-xs tracking-wider uppercase block mb-2">
            TikTok Username
          </label>
          <div className="relative">
            <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input
              type="text"
              placeholder="username"
              value={data.tiktokUsername}
              onChange={(e) => updateData({ tiktokUsername: e.target.value })}
              className="w-full bg-[#1A1A1A] text-white rounded-xl pl-10 pr-4 py-4 text-sm outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#555]"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="text-[#888] text-xs tracking-wider uppercase block mb-2">
            Profile Photo (Optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />

          {preview ? (
            <div className="relative inline-block">
              <img
                src={preview}
                alt="Profile preview"
                className="w-24 h-24 rounded-xl object-cover border border-[#333]"
              />
              {uploading ? (
                <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#F5E642] animate-spin" />
                </div>
              ) : (
                <button
                  onClick={clearPhoto}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#1A1A1A] text-[#555] rounded-xl px-4 py-4 text-sm flex items-center gap-3 hover:border-[#F5E642]/30 border border-transparent transition-colors"
            >
              <Upload className="w-4 h-4" />
              Choose an image (max 2MB)
            </button>
          )}

          {uploadError && (
            <p className="text-red-400 text-xs mt-2">{uploadError}</p>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push("/onboarding/step4")}
        disabled={!canContinue || uploading}
        className={`w-full rounded-xl py-4 text-base font-medium flex items-center justify-center gap-2 mt-8 ${
          canContinue && !uploading
            ? "btn-yellow font-bold"
            : "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
        }`}
      >
        Continue <span className="text-lg">&rarr;</span>
      </button>
    </div>
  );
}
