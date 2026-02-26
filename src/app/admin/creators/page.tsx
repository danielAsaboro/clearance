"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Search } from "lucide-react";

interface Creator {
  id: string;
  displayName: string | null;
  tiktokUsername: string | null;
  email: string | null;
  debtSources: string[] | null;
  willingToDeclare: boolean | null;
  consentAccepted: boolean;
  createdAt: string;
  _count: { tasks: number; referralsMade: number };
}

export default function AdminCreators() {
  const { getAccessToken } = usePrivy();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCreators = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/stats?type=creators", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCreators(await res.json());
    };
    fetchCreators();
  }, [getAccessToken]);

  const filtered = creators.filter(
    (c) =>
      c.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      c.tiktokUsername?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4">Creators</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
        <input
          type="text"
          placeholder="Search creators..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#1A1A1A] text-white rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#555]"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((creator) => (
          <div
            key={creator.id}
            className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">
                  {creator.displayName || "Unnamed"}
                </p>
                <p className="text-[#888] text-xs">
                  @{creator.tiktokUsername || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#F5E642] text-xs font-bold">
                  {creator._count.tasks} tasks
                </p>
                <p className="text-[#888] text-xs">
                  {creator._count.referralsMade} referrals
                </p>
              </div>
            </div>
            {creator.debtSources && Array.isArray(creator.debtSources) && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {(creator.debtSources as string[]).map((s) => (
                  <span
                    key={s}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#2A2A2A] text-[#888]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-[#888] text-sm text-center py-8">
            No creators found.
          </p>
        )}
      </div>
    </div>
  );
}
