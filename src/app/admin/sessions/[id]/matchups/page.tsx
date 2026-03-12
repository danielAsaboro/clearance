"use client";

import { useState, useEffect, useCallback, use } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowLeft, Shuffle, Save, Film, Check } from "lucide-react";
import Link from "next/link";

interface Video {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
}

interface MatchupSlot {
  matchupNumber: number;
  videoAId: string;
  videoBId: string;
}

interface ExistingMatchup {
  id: string;
  matchupNumber: number;
  videoA: Video;
  videoB: Video;
}

export default function MatchupBuilder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const { getAccessToken } = usePrivy();
  const [videos, setVideos] = useState<Video[]>([]);
  const [matchups, setMatchups] = useState<MatchupSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const totalSlots = parseInt(process.env.NEXT_PUBLIC_MATCHUPS_PER_SESSION ?? "28");

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();

    const [videosRes, matchupsRes] = await Promise.all([
      fetch("/api/admin/videos", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/admin/sessions/${sessionId}/matchups`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (videosRes.ok) setVideos(await videosRes.json());

    if (matchupsRes.ok) {
      const existing: ExistingMatchup[] = await matchupsRes.json();
      if (existing.length > 0) {
        setMatchups(
          existing.map((m) => ({
            matchupNumber: m.matchupNumber,
            videoAId: m.videoA.id,
            videoBId: m.videoB.id,
          }))
        );
      } else {
        // Initialize empty slots
        setMatchups(
          Array.from({ length: totalSlots }, (_, i) => ({
            matchupNumber: i + 1,
            videoAId: "",
            videoBId: "",
          }))
        );
      }
    }
  }, [getAccessToken, sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const autoPair = () => {
    // Randomly pair videos into matchups
    const shuffled = [...videos].sort(() => Math.random() - 0.5);
    const pairs: MatchupSlot[] = [];

    for (let i = 0; i < Math.min(shuffled.length - 1, totalSlots * 2); i += 2) {
      pairs.push({
        matchupNumber: pairs.length + 1,
        videoAId: shuffled[i].id,
        videoBId: shuffled[i + 1]?.id ?? "",
      });
    }

    // Fill remaining slots
    while (pairs.length < totalSlots) {
      pairs.push({
        matchupNumber: pairs.length + 1,
        videoAId: "",
        videoBId: "",
      });
    }

    setMatchups(pairs);
    setSaved(false);
  };

  const updateSlot = (
    index: number,
    field: "videoAId" | "videoBId",
    value: string
  ) => {
    setMatchups((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const validMatchups = matchups.filter((m) => m.videoAId && m.videoBId);
    if (validMatchups.length === 0) {
      alert("Add at least one matchup with both videos selected");
      return;
    }

    setSaving(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/sessions/${sessionId}/matchups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchups: validMatchups }),
      });

      if (res.ok) {
        setSaved(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save matchups");
      }
    } finally {
      setSaving(false);
    }
  };

  const filledCount = matchups.filter((m) => m.videoAId && m.videoBId).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/sessions">
          <div className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white" />
          </div>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Matchup Builder</h1>
          <p className="text-[#888] text-xs">
            {filledCount}/{totalSlots} matchups configured
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={autoPair}
          disabled={videos.length < 2}
          className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl py-2.5 text-xs font-bold text-white flex items-center justify-center gap-1 hover:border-[#F5E642]/30 transition-colors disabled:opacity-40"
        >
          <Shuffle className="w-3.5 h-3.5" /> Auto-Pair ({videos.length} videos)
        </button>
        <button
          onClick={handleSave}
          disabled={saving || filledCount === 0}
          className="flex-1 btn-yellow rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5" /> Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            <>
              <Save className="w-3.5 h-3.5" /> Save Matchups
            </>
          )}
        </button>
      </div>

      {/* Matchup Slots */}
      <div className="space-y-3">
        {matchups.map((slot, i) => (
          <div
            key={i}
            className="bg-[#1A1A1A] rounded-xl p-3 border border-[#2A2A2A]"
          >
            <p className="text-[#888] text-[10px] uppercase tracking-wider mb-2">
              Matchup {slot.matchupNumber}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[#555] text-[10px] block mb-1">
                  Video A
                </label>
                <select
                  value={slot.videoAId}
                  onChange={(e) => updateSlot(i, "videoAId", e.target.value)}
                  className="w-full bg-[#111] text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-[#F5E642] border border-[#222]"
                >
                  <option value="">Select video...</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title ?? v.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <span className="text-[#555] text-xs font-bold">vs</span>
              </div>
              <div className="flex-1">
                <label className="text-[#555] text-[10px] block mb-1">
                  Video B
                </label>
                <select
                  value={slot.videoBId}
                  onChange={(e) => updateSlot(i, "videoBId", e.target.value)}
                  className="w-full bg-[#111] text-white text-xs rounded-lg px-2 py-2 outline-none focus:ring-1 focus:ring-[#F5E642] border border-[#222]"
                >
                  <option value="">Select video...</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title ?? v.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {slot.videoAId && slot.videoBId && (
              <div className="flex gap-2 mt-2">
                {[slot.videoAId, slot.videoBId].map((vid) => {
                  const video = videos.find((v) => v.id === vid);
                  return video ? (
                    <div
                      key={vid}
                      className="flex-1 bg-[#111] rounded-lg p-1.5 flex items-center gap-2"
                    >
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#222] flex items-center justify-center">
                          <Film className="w-3 h-3 text-[#444]" />
                        </div>
                      )}
                      <span className="text-[#888] text-[10px] truncate">
                        {video.title ?? "Untitled"}
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
