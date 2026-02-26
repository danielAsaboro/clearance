"use client";

import { useState, useEffect, useCallback } from "react";
import { Eye, Users, CheckCircle, Copy, Check, Share2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import TaskCard from "@/components/TaskCard";
import DeadlineCountdown from "@/components/DeadlineCountdown";

interface Task {
  id: string;
  taskNumber: number;
  description: string;
  hashtag: string;
  deadline: string;
  tiktokUrl: string | null;
  status: string;
  rejectionNote: string | null;
}

interface UserProfile {
  id: string;
  displayName: string;
  tiktokUsername: string;
  referralCode: string;
}

export default function CreatorHub() {
  const { getAccessToken } = usePrivy();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState(0);

  const fetchData = useCallback(async () => {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [userRes, tasksRes, referralsRes] = await Promise.all([
      fetch("/api/users", { headers }),
      fetch("/api/tasks", { headers }),
      fetch("/api/referrals", { headers }),
    ]);

    if (userRes.ok) setUser(await userRes.json());
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (referralsRes.ok) {
      const refs = await referralsRes.json();
      setReferralCount(Array.isArray(refs) ? refs.length : 0);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitTask = async (taskId: string, url: string) => {
    const token = await getAccessToken();
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tiktokUrl: url }),
    });
    if (res.ok) fetchData();
  };

  const handleCopy = () => {
    if (user) {
      navigator.clipboard.writeText(`${window.location.origin}/ref/${user.referralCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // On-chain follower count component (inline)
  function FollowerCount() {
    const [count, setCount] = useState<number | null>(null);
    useEffect(() => {
      (async () => {
        try {
          const token = await getAccessToken();
          const res = await fetch("/api/social/profile", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            // Profile created/fetched; now the follower count would come from leaderboard
            // For now just show the profile was created
            setCount(0);
          }
        } catch {
          // Non-fatal
        }
      })();
    }, []);
    return (
      <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-[#2A2A2A]">
        <p className="text-blue-400 font-bold text-lg">{count ?? "—"}</p>
        <p className="text-[#888] text-xs">Followers</p>
      </div>
    );
  }

  const deadline = tasks[0]?.deadline;
  const tasksCompleted = tasks.filter((t) => t.status === "verified").length;
  const tasksSubmitted = tasks.filter(
    (t) => t.status === "submitted" || t.status === "verified"
  ).length;

  return (
    <div className="min-h-screen bg-black px-6 py-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F5E642] rounded-xl flex items-center justify-center">
            <Eye className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Creator Hub</h1>
            <p className="text-[#888] text-xs">
              {user?.displayName ? `Welcome, ${user.displayName}` : "Welcome back"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-[#2A2A2A]">
          <p className="text-[#F5E642] font-bold text-lg">{tasksCompleted}</p>
          <p className="text-[#888] text-xs">Verified</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-[#2A2A2A]">
          <p className="text-white font-bold text-lg">{tasksSubmitted}</p>
          <p className="text-[#888] text-xs">Submitted</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-[#2A2A2A]">
          <p className="text-white font-bold text-lg">{referralCount}</p>
          <p className="text-[#888] text-xs">Referrals</p>
        </div>
        <FollowerCount />
      </div>

      {/* Deadline */}
      {deadline && (
        <div className="mb-6">
          <DeadlineCountdown deadline={deadline} label="Submission deadline" />
        </div>
      )}

      {/* This Week's Tasks */}
      <div className="mb-8">
        <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#F5E642]" />
          This Week&apos;s Tasks
        </h2>

        {tasks.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] text-center">
            <p className="text-[#888] text-sm">
              No tasks assigned yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onSubmit={handleSubmitTask} />
            ))}
          </div>
        )}
      </div>

      {/* Share & Win */}
      <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#F5E642]" />
          <h3 className="text-white font-bold text-sm">Share & Invite</h3>
        </div>

        <div className="bg-[#111] rounded-xl px-4 py-3 flex items-center justify-between mb-3">
          <code className="text-[#F5E642] text-sm truncate">
            {user ? `${typeof window !== "undefined" ? window.location.origin : ""}/ref/${user.referralCode}` : "..."}
          </code>
          <button
            onClick={handleCopy}
            className="ml-2 w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center flex-shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#F5E642]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#888]" />
            )}
          </button>
        </div>

        <button className="w-full bg-[#2A2A2A] rounded-xl py-3 text-sm text-white flex items-center justify-center gap-2 hover:bg-[#333] transition-colors">
          <Share2 className="w-4 h-4" />
          Share via Social Media
        </button>
      </div>
    </div>
  );
}
