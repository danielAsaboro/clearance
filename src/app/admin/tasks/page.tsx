"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";

interface Task {
  id: string;
  taskNumber: number;
  weekNumber: number;
  description: string;
  tiktokUrl: string | null;
  status: string;
  creator: { displayName: string | null; tiktokUsername: string | null };
}

export default function AdminTasks() {
  const { getAccessToken } = usePrivy();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("submitted");
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/tasks", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setTasks(await res.json());
  }, [getAccessToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleVerify = async (taskId: string) => {
    const token = await getAccessToken();
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "verified" }),
    });
    fetchTasks();
  };

  const handleReject = async (taskId: string) => {
    const token = await getAccessToken();
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "rejected", rejectionNote }),
    });
    setRejectingId(null);
    setRejectionNote("");
    fetchTasks();
  };

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : t.status === filter
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">Task Management</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["submitted", "pending", "verified", "rejected", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
              filter === f
                ? "bg-[#F5E642] text-black"
                : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((task) => (
          <div
            key={task.id}
            className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-white font-bold text-sm">
                  Week {task.weekNumber} / Task {task.taskNumber}
                </p>
                <p className="text-[#888] text-xs mt-0.5">
                  {task.creator.displayName} (@{task.creator.tiktokUsername})
                </p>
                <p className="text-[#555] text-xs mt-1">{task.description}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  task.status === "verified"
                    ? "text-green-400 bg-green-400/10"
                    : task.status === "rejected"
                      ? "text-red-400 bg-red-400/10"
                      : task.status === "submitted"
                        ? "text-[#F5E642] bg-[#F5E642]/10"
                        : "text-[#888] bg-[#2A2A2A]"
                }`}
              >
                {task.status}
              </span>
            </div>

            {task.tiktokUrl && (
              <a
                href={task.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#F5E642] text-xs mb-3 hover:underline"
              >
                View TikTok <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {task.status === "submitted" && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleVerify(task.id)}
                  className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium flex items-center justify-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Verify
                </button>
                <button
                  onClick={() =>
                    setRejectingId(rejectingId === task.id ? null : task.id)
                  }
                  className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium flex items-center justify-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}

            {rejectingId === task.id && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Rejection reason..."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  className="w-full bg-[#111] text-white text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-red-400 placeholder:text-[#444]"
                />
                <button
                  onClick={() => handleReject(task.id)}
                  className="w-full py-2 rounded-lg bg-red-500 text-white text-xs font-medium"
                >
                  Confirm Rejection
                </button>
              </div>
            )}

            {task.status === "pending" && (
              <div className="flex items-center gap-1 text-[#555] text-xs">
                <Clock className="w-3 h-3" /> Awaiting submission
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-[#888] text-sm text-center py-8">
            No tasks found.
          </p>
        )}
      </div>
    </div>
  );
}
