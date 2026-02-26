"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { Eye } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, authenticated } = usePrivy();
  const redirect = searchParams.get("redirect") || "/";

  const { login } = useLogin({
    onComplete: () => {
      router.push(redirect);
    },
  });

  useEffect(() => {
    if (ready && authenticated) {
      router.push(redirect);
    }
  }, [ready, authenticated, redirect, router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 bg-[#F5E642] rounded-2xl flex items-center justify-center mb-4">
        <Eye className="w-8 h-8 text-black" strokeWidth={2.5} />
      </div>
      <h1 className="text-3xl font-bold tracking-wider text-white mb-8">The Clearance</h1>

      <p className="text-[#888] text-sm text-center mb-8">
        Sign in to continue
      </p>

      <button
        onClick={login}
        className="btn-yellow w-full max-w-sm rounded-2xl py-4 font-bold text-lg"
      >
        Sign In
      </button>

      <p className="text-[#888] text-xs mt-6 text-center">
        Email or Solana wallet supported
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
