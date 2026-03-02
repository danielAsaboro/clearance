"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  AlertTriangle,
} from "lucide-react";

interface Task {
  id: string;
  creatorId: string;
  taskNumber: number;
  weekNumber: number;
  description: string;
  tiktokUrl: string | null;
  status: string;
  deadline: string;
  submittedAt: string | null;
  createdAt: string;
  rejectionNote: string | null;
  creator: { displayName: string | null; tiktokUsername: string | null };
}

interface CreatorGroup {
  creatorId: string;
  displayName: string;
  tiktokUsername: string;
  tasks: Task[];
  verifiedCount: number;
  totalCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  verified: "text-green-400 bg-green-400/10",
  rejected: "text-red-400 bg-red-400/10",
  submitted: "text-[#F5E642] bg-[#F5E642]/10",
  pending: "text-[#888] bg-[#2A2A2A]",
};

function isOverdue(task: Task): boolean {
  if (task.status === "verified") return false;
  return new Date(task.deadline) < new Date();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminTasks() {
  const { getAccessToken } = usePrivy();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [weekFilter, setWeekFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(
    new Set()
  );
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

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

  const copyTaskId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Derive available weeks from task data
  const availableWeeks = useMemo(() => {
    const weeks = [...new Set(tasks.map((t) => t.weekNumber))].sort(
      (a, b) => a - b
    );
    return weeks;
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      // Week filter
      if (weekFilter !== "all" && t.weekNumber !== parseInt(weekFilter))
        return false;
      // Search filter
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchesCreator =
          t.creator.displayName?.toLowerCase().includes(q) ||
          t.creator.tiktokUsername?.toLowerCase().includes(q);
        const matchesDescription = t.description.toLowerCase().includes(q);
        if (!matchesCreator && !matchesDescription) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, weekFilter, debouncedSearch]);

  // Summary stats for filtered set
  const stats = useMemo(() => {
    return {
      total: filteredTasks.length,
      pending: filteredTasks.filter((t) => t.status === "pending").length,
      submitted: filteredTasks.filter((t) => t.status === "submitted").length,
      verified: filteredTasks.filter((t) => t.status === "verified").length,
      rejected: filteredTasks.filter((t) => t.status === "rejected").length,
    };
  }, [filteredTasks]);

  // Group by creator
  const creatorGroups = useMemo(() => {
    const groups: Record<string, CreatorGroup> = {};
    for (const task of filteredTasks) {
      if (!groups[task.creatorId]) {
        groups[task.creatorId] = {
          creatorId: task.creatorId,
          displayName: task.creator.displayName || "Unknown",
          tiktokUsername: task.creator.tiktokUsername || "",
          tasks: [],
          verifiedCount: 0,
          totalCount: 0,
        };
      }
      groups[task.creatorId].tasks.push(task);
      groups[task.creatorId].totalCount++;
      if (task.status === "verified") groups[task.creatorId].verifiedCount++;
    }
    return Object.values(groups).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [filteredTasks]);

  // Auto-expand/collapse based on creator count
  useEffect(() => {
    if (creatorGroups.length <= 5) {
      setExpandedCreators(new Set(creatorGroups.map((g) => g.creatorId)));
    } else {
      setExpandedCreators(new Set());
    }
  }, [creatorGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCreator = (creatorId: string) => {
    setExpandedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">Task Management</h1>

      {/* Summary Bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pending, color: "text-[#888]" },
          {
            label: "Submitted",
            value: stats.submitted,
            color: "text-[#F5E642]",
          },
          { label: "Verified", value: stats.verified, color: "text-green-400" },
          { label: "Rejected", value: stats.rejected, color: "text-red-400" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className="text-[#888] text-xs">{s.label}</span>
            <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
          <input
            type="text"
            placeholder="Search creator or task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1A1A] text-white text-xs rounded-lg pl-9 pr-3 py-2.5 outline-none border border-[#2A2A2A] focus:border-[#F5E642]/50 placeholder:text-[#444]"
          />
        </div>

        {/* Week Dropdown */}
        <select
          value={weekFilter}
          onChange={(e) => setWeekFilter(e.target.value)}
          className="bg-[#1A1A1A] text-white text-xs rounded-lg px-3 py-2.5 border border-[#2A2A2A] outline-none focus:border-[#F5E642]/50 appearance-none cursor-pointer"
        >
          <option value="all">All Weeks</option>
          {availableWeeks.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["submitted", "pending", "verified", "rejected", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
              statusFilter === f
                ? "bg-[#F5E642] text-black"
                : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Creator Groups */}
      <div className="space-y-3">
        {creatorGroups.map((group) => (
          <div
            key={group.creatorId}
            className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden"
          >
            {/* Creator Header */}
            <button
              onClick={() => toggleCreator(group.creatorId)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#222] transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedCreators.has(group.creatorId) ? (
                  <ChevronDown className="w-4 h-4 text-[#888]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#888]" />
                )}
                <div className="text-left">
                  <span className="text-white font-bold text-sm">
                    {group.displayName}
                  </span>
                  {group.tiktokUsername && (
                    <span className="text-[#888] text-xs ml-2">
                      @{group.tiktokUsername}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-[#888]">
                <span className="text-green-400">{group.verifiedCount}</span>/
                {group.totalCount} verified
              </span>
            </button>

            {/* Task Rows */}
            {expandedCreators.has(group.creatorId) && (
              <div className="border-t border-[#2A2A2A]">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="px-4 py-3 border-b border-[#2A2A2A] last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      {/* Task # and ID */}
                      <div className="min-w-[100px] shrink-0">
                        <p className="text-white font-medium text-xs">
                          Week {task.weekNumber} / Task {task.taskNumber}
                        </p>
                        <button
                          onClick={() => copyTaskId(task.id)}
                          className="flex items-center gap-1 mt-0.5 group"
                          title="Copy task ID"
                        >
                          <code className="text-[#555] text-[10px] font-mono group-hover:text-[#888] transition-colors">
                            {task.id.slice(0, 8)}
                          </code>
                          <Copy className="w-2.5 h-2.5 text-[#555] group-hover:text-[#888] transition-colors" />
                        </button>
                        {copiedId === task.id && (
                          <span className="text-[10px] text-green-400">
                            Copied!
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="flex-1 text-[#aaa] text-xs truncate min-w-0">
                        {task.description}
                      </p>

                      {/* Deadline */}
                      <div className="min-w-[100px] shrink-0 text-right">
                        <p className="text-[#888] text-[10px]">
                          {formatDate(task.deadline)}
                        </p>
                        {isOverdue(task) && (
                          <span className="inline-flex items-center gap-0.5 text-red-400 text-[10px] font-medium">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>

                      {/* Status Pill */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${STATUS_COLORS[task.status] || STATUS_COLORS.pending}`}
                      >
                        {task.status}
                      </span>

                      {/* TikTok Link */}
                      <div className="w-5 shrink-0 flex justify-center">
                        {task.tiktokUrl ? (
                          <a
                            href={task.tiktokUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#F5E642] hover:text-[#F5E642]/80"
                            title="View TikTok"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="w-3.5" />
                        )}
                      </div>
                    </div>

                    {/* Rejection note display */}
                    {task.status === "rejected" && task.rejectionNote && (
                      <p className="mt-1.5 ml-[100px] text-red-400/70 text-[10px] pl-3 border-l border-red-400/20">
                        {task.rejectionNote}
                      </p>
                    )}

                    {/* Actions for submitted tasks */}
                    {task.status === "submitted" && (
                      <div className="mt-2 ml-[100px] flex gap-2">
                        <button
                          onClick={() => handleVerify(task.id)}
                          className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium flex items-center gap-1 hover:bg-green-500/20 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Verify
                        </button>
                        <button
                          onClick={() =>
                            setRejectingId(
                              rejectingId === task.id ? null : task.id
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium flex items-center gap-1 hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}

                    {/* Rejection input */}
                    {rejectingId === task.id && (
                      <div className="mt-2 ml-[100px] space-y-2">
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

                    {/* Pending indicator */}
                    {task.status === "pending" && (
                      <div className="mt-1.5 ml-[100px] flex items-center gap-1 text-[#555] text-[10px]">
                        <Clock className="w-2.5 h-2.5" /> Awaiting submission
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Empty State */}
        {creatorGroups.length === 0 && (
          <p className="text-[#888] text-sm text-center py-8">
            No tasks found.
          </p>
        )}
      </div>
    </div>
  );
}
