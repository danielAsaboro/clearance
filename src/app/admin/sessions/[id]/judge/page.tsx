"use client";

import { useState, useEffect, use, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface Round {
  id: string;
  roundNumber: number;
  tiktokUrl: string;
  adminVerdict: string | null;
  task: {
    creator: { displayName: string | null; tiktokUsername: string | null };
  };
}

export default function JudgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const { getAccessToken } = usePrivy();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [verdicts, setVerdicts] = useState<
    Record<string, "approved" | "rejected">
  >({});
  const [submitting, setSubmitting] = useState(false);

  const fetchRounds = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch(`/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setRounds(data.rounds || []);
      const existing: Record<string, "approved" | "rejected"> = {};
      for (const r of data.rounds || []) {
        if (r.adminVerdict) existing[r.id] = r.adminVerdict;
      }
      setVerdicts(existing);
    }
  }, [sessionId, getAccessToken]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const setVerdict = (roundId: string, verdict: "approved" | "rejected") => {
    setVerdicts((prev) => ({ ...prev, [roundId]: verdict }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const token = await getAccessToken();
    const roundVerdicts = Object.entries(verdicts).map(([roundId, verdict]) => ({
      roundId,
      verdict,
    }));

    await fetch(`/api/admin/sessions/${sessionId}/judge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rounds: roundVerdicts }),
    });

    setSubmitting(false);
    fetchRounds();
  };

  const allJudged = rounds.length > 0 && rounds.every((r) => verdicts[r.id]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-2">Judge Rounds</h1>
      <p className="text-[#888] text-sm mb-4">
        Set approve/reject verdict for each round.
      </p>

      <div className="space-y-3 mb-6">
        {rounds.map((round) => (
          <div
            key={round.id}
            className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white font-bold text-sm">
                  Round {round.roundNumber}
                </p>
                <p className="text-[#888] text-xs">
                  {round.task.creator.displayName} (@
                  {round.task.creator.tiktokUsername})
                </p>
              </div>
              <a
                href={round.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F5E642] text-xs flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setVerdict(round.id, "approved")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                  verdicts[round.id] === "approved"
                    ? "bg-green-500 text-white"
                    : "bg-green-500/10 text-green-400"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => setVerdict(round.id, "rejected")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                  verdicts[round.id] === "rejected"
                    ? "bg-red-500 text-white"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {rounds.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={!allJudged || submitting}
          className={`w-full py-4 rounded-xl font-bold text-base ${
            allJudged && !submitting
              ? "btn-yellow"
              : "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
          }`}
        >
          {submitting
            ? "Submitting..."
            : `Submit Verdicts (${Object.keys(verdicts).length}/${rounds.length})`}
        </button>
      )}
    </div>
  );
}
