"use client";

import { X, LogOut, User, Zap, Trophy, Crosshair } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useEffect, useState } from "react";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

interface ProfileStats {
  sessionsPlayed: number;
  correctPredictions: number;
  tasteScore: number;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const walletAddress = wallets[0]?.address ?? user?.wallet?.address;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/social/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats({
            sessionsPlayed: data.sessionsPlayed ?? 0,
            correctPredictions: data.correctPredictions ?? 0,
            tasteScore: data.tasteScore ?? 0,
          });
        }
      } catch {
        // ignore
      }
    })();
  }, [open, getAccessToken]);

  if (!open) return null;

  const tasteScoreMax = 70;
  const tasteScorePct = stats
    ? Math.min(100, (stats.tasteScore / tasteScoreMax) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="spotr-bottom-sheet relative w-full max-w-[380px] px-6 pb-7 pt-5 anim-slide-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-white">Your Profile</h2>
          <button onClick={onClose} className="text-[#8d8d8d] hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="spotr-divider mb-5" />

        <div className="spotr-panel-soft mb-3 flex items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#201d0a]">
            <User className="h-[18px] w-[18px] text-[#f5d63d]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="mb-1 text-[11px] text-[#7d7d7d]">Connected Wallet</p>
            <p className="truncate font-mono text-[14px] font-semibold text-white">{shortAddress}</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="spotr-panel-soft px-4 py-4">
            <Zap className="mb-2 h-4 w-4 text-[#f5d63d]" />
            <p className="text-[11px] text-[#8d8d8d]">Sessions</p>
            <p className="mt-1 text-[42px] font-semibold tracking-[-0.06em] text-white leading-none">
              {stats?.sessionsPlayed ?? "1"}
            </p>
          </div>
          <div className="spotr-panel-soft px-4 py-4">
            <Trophy className="mb-2 h-4 w-4 text-[#f5d63d]" />
            <p className="text-[11px] text-[#8d8d8d]">Correct</p>
            <p className="mt-1 text-[42px] font-semibold tracking-[-0.06em] text-white leading-none">
              {stats?.correctPredictions ?? "0"}
            </p>
          </div>
        </div>

        <div className="spotr-outline-panel mb-6 px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-[#f5d63d]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#f5d63d]">Taste Score</p>
          </div>
          <div className="mb-3 flex items-end gap-2">
            <span className="text-[60px] font-semibold tracking-[-0.07em] text-[#f5d63d] leading-none">
              {stats?.tasteScore ?? 0}
            </span>
            <span className="pb-2 text-[13px] text-[#b59d2d]">/ {tasteScoreMax} to NFT</span>
          </div>
          <div className="spotr-progress-track h-[7px] bg-[#6b5d18]/40">
            <div
              className="h-full rounded-full bg-[#d1b83c] transition-all"
              style={{ width: `${tasteScorePct}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="mb-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#da5249] text-[15px] font-semibold text-[#da5249] transition-colors hover:bg-[#da5249]/10"
        >
          <LogOut className="h-4 w-4" />
          Disconnect Wallet
        </button>
        <button
          onClick={onClose}
          className="flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-[#f5d63d] text-[15px] font-semibold text-[#f5d63d] transition-colors hover:bg-[#f5d63d]/10"
        >
          Close
        </button>
      </div>
    </div>
  );
}
