"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  Trophy,
  LogOut,
  ShieldX,
  Film,
} from "lucide-react";
import Image from "next/image";

const authInitTimeoutMs = 4000;

async function readErrorMessage(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (data && typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  }

  const text = await res.text().catch(() => "");
  if (text.trim()) return text;

  return `Request failed with status ${res.status}`;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/videos", label: "Videos", icon: Film },
  { href: "/admin/sessions", label: "Sessions", icon: Radio },
  { href: "/admin/results", label: "Results", icon: Trophy },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { logout, getAccessToken, ready, authenticated } = usePrivy();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;

    const timeoutId = window.setTimeout(() => {
      setChecking(false);
      setAuthError(
        "Admin authentication did not initialize in time. Refresh the page or sign in again."
      );
    }, authInitTimeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    setAuthError(null);

    if (!authenticated) {
      setChecking(false);
      setRole(null);
      return;
    }

    let cancelled = false;

    const loadRole = async () => {
      setChecking(true);
      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error("Unable to get an admin access token.");
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), authInitTimeoutMs);

        try {
          const res = await fetch("/api/users", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          if (!res.ok) {
            throw new Error(await readErrorMessage(res));
          }

          const user = await res.json();
          if (cancelled) return;

          setRole(user?.role ?? null);
        } finally {
          window.clearTimeout(timeoutId);
        }
      } catch (error) {
        if (cancelled) return;

        console.error("[admin/layout] Failed to resolve admin access:", error);
        setRole(null);
        setAuthError(
          error instanceof Error
            ? error.message
            : "Failed to verify admin access."
        );
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void loadRole();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  if (checking) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-14 h-14 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl flex items-center justify-center">
          <ShieldX className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">Admin Auth Unavailable</h1>
          <p className="text-[#555] text-sm mt-1 max-w-xs">{authError}</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl py-3 text-sm font-bold bg-[#F5E642] text-black text-center"
          >
            Reload Page
          </button>
          <button
            onClick={() => logout()}
            className="w-full rounded-xl py-3 text-sm font-medium bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Not logged in or not admin — show restricted screen
  if (!authenticated || role !== "admin") {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center px-6 text-center gap-5">
        <div className="w-14 h-14 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl flex items-center justify-center">
          <ShieldX className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">Access Restricted</h1>
          <p className="text-[#555] text-sm mt-1 max-w-xs">
            This area is for admins only. If you have an admin key, you can register below.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/admin-register"
            className="w-full rounded-xl py-3 text-sm font-bold bg-[#F5E642] text-black text-center"
          >
            Register as Admin
          </Link>
          <button
            onClick={() => logout()}
            className="w-full rounded-xl py-3 text-sm font-medium bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout flex-1 bg-black flex flex-col">
      {/* Top Header */}
      <div className="border-b border-[#2A2A2A] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/spotr-logo.png" alt="Spotr TV" width={28} height={28} className="rounded-lg" />
          <span className="text-white font-bold text-sm">Spotr TV</span>
          <span className="text-[#888] text-xs ml-2 px-2 py-0.5 bg-[#1A1A1A] rounded-full">
            Admin
          </span>
        </div>
        <button
          onClick={() => logout()}
          className="text-[#888] hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6 overflow-y-auto">{children}</div>

      {/* Bottom Nav */}
      <div className="border-t border-[#2A2A2A] px-2 py-2 flex justify-around">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${isActive
                  ? "text-[#F5E642]"
                  : "text-[#555] hover:text-[#888]"
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
