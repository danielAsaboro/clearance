"use client";

import { useState } from "react";
import { CheckCircle, Clock, XCircle, Send, ExternalLink } from "lucide-react";

interface TaskCardProps {
  task: {
    id: string;
    taskNumber: number;
    description: string;
    hashtag: string;
    deadline: string;
    tiktokUrl: string | null;
    status: string;
    rejectionNote: string | null;
  };
  onSubmit: (taskId: string, url: string) => Promise<void>;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: {
    icon: <Clock className="w-4 h-4" />,
    label: "Pending",
    color: "text-[#888] bg-[#2A2A2A]",
  },
  submitted: {
    icon: <Clock className="w-4 h-4" />,
    label: "Under Review",
    color: "text-[#F5E642] bg-[#F5E642]/10",
  },
  verified: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: "Verified",
    color: "text-green-400 bg-green-400/10",
  },
  rejected: {
    icon: <XCircle className="w-4 h-4" />,
    label: "Rejected",
    color: "text-red-400 bg-red-400/10",
  },
};

export default function TaskCard({ task, onSubmit }: TaskCardProps) {
  const [url, setUrl] = useState(task.tiktokUrl || "");
  const [submitting, setSubmitting] = useState(false);
  const status = statusConfig[task.status] || statusConfig.pending;

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(task.id, url);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = task.status === "pending" || task.status === "rejected";

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-bold text-sm">Task {task.taskNumber}</p>
          <p className="text-[#888] text-xs mt-0.5">{task.description}</p>
        </div>
        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${status.color}`}>
          {status.icon}
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#555] mb-3">
        <span>{task.hashtag}</span>
      </div>

      {task.rejectionNote && task.status === "rejected" && (
        <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 mb-3">
          <p className="text-red-400 text-xs">{task.rejectionNote}</p>
        </div>
      )}

      {canSubmit && (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Paste TikTok URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-[#111] text-white text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#444]"
          />
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || submitting}
            className="btn-yellow px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {task.tiktokUrl && task.status !== "pending" && (
        <a
          href={task.tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[#F5E642] text-xs mt-2 hover:underline"
        >
          View on TikTok <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
