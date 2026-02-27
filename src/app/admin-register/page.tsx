"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Eye, ShieldCheck, Lock } from "lucide-react";

export default function AdminRegisterPage() {
    const router = useRouter();
    const { getAccessToken, authenticated, ready } = usePrivy();
    const [secret, setSecret] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    if (ready && !authenticated) {
        return (
            <div className="flex-1 bg-black flex items-center justify-center px-6">
                <div className="text-center">
                    <p className="text-[#888] text-sm">You must be logged in to access this page.</p>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!secret.trim()) return;

        setStatus("loading");
        setMessage("");

        try {
            const token = await getAccessToken();
            const res = await fetch("/api/admin/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ secret }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setMessage(data.message ?? "You are now an admin.");
                setTimeout(() => router.push("/admin"), 2000);
            } else {
                setStatus("error");
                setMessage(data.error ?? "Something went wrong.");
            }
        } catch {
            setStatus("error");
            setMessage("Network error. Please try again.");
        }
    };

    return (
        <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-10">
                <div className="w-8 h-8 bg-[#F5E642] rounded-xl flex items-center justify-center">
                    <Eye className="w-5 h-5 text-black" />
                </div>
                <span className="text-white font-bold text-base tracking-tight">The Clearance</span>
            </div>

            <div className="w-full max-w-sm">
                <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl p-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-[#F5E642]" />
                        </div>
                        <div>
                            <h1 className="text-white font-bold text-base">Admin Access</h1>
                            <p className="text-[#555] text-xs">Enter your secret key to register as admin</p>
                        </div>
                    </div>

                    {status === "success" ? (
                        <div className="text-center py-4">
                            <div className="w-12 h-12 bg-[#F5E642]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <ShieldCheck className="w-6 h-6 text-[#F5E642]" />
                            </div>
                            <p className="text-white font-bold text-sm">{message}</p>
                            <p className="text-[#555] text-xs mt-1">Redirecting to admin dashboard…</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                                <input
                                    type="password"
                                    placeholder="Admin secret key"
                                    value={secret}
                                    onChange={(e) => setSecret(e.target.value)}
                                    autoComplete="off"
                                    className="w-full bg-[#1A1A1A] text-white rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#444] border border-[#2A2A2A] focus:border-[#F5E642]/40 transition-colors"
                                />
                            </div>

                            {status === "error" && (
                                <p className="text-red-400 text-xs px-1">{message}</p>
                            )}

                            <button
                                type="submit"
                                disabled={!secret.trim() || status === "loading"}
                                className="w-full rounded-xl py-3 text-sm font-bold transition-all bg-[#F5E642] text-black hover:bg-[#E5D63A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === "loading" ? (
                                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ShieldCheck className="w-4 h-4" />
                                        Register as Admin
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-[#333] text-xs text-center mt-4">
                    This page is for authorized personnel only.
                </p>
            </div>
        </div>
    );
}
