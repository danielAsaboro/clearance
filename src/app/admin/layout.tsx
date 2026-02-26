"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  Radio,
  Trophy,
  Eye,
  LogOut,
  ShieldX,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/creators", label: "Creators", icon: Users },
  { href: "/admin/tasks", label: "Tasks", icon: ListTodo },
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

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setChecking(false);
      return;
    }
    getAccessToken()
      .then((token) =>
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        setRole(user?.role ?? null);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [ready, authenticated, getAccessToken]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in or not admin — show restricted screen
  if (!authenticated || role !== "admin") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-5">
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
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Header */}
      <div className="border-b border-[#2A2A2A] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#F5E642] rounded-lg flex items-center justify-center">
            <Eye className="w-4 h-4 text-black" />
          </div>
          <span className="text-white font-bold text-sm">The Clearance</span>
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
      <div className="flex-1 px-6 py-6">{children}</div>

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
