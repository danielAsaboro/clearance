"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

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
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
      <Image src="/spotr-logo.png" alt="Spotr TV" width={64} height={64} className="rounded-2xl mb-4" />
      <h1 className="text-3xl font-bold tracking-wider text-white mb-8">Spotr TV</h1>

      <p className="text-[#888] text-sm text-center mb-8">
        Sign in to continue
      </p>

      <button
        onClick={login}
        className="btn-yellow w-full max-w-sm rounded-2xl py-4 font-bold text-lg"
      >
        Sign In
      </button>

      <Link href="/arena" className="mt-4 text-[#888] text-sm underline-offset-2 hover:text-white transition-colors">
        Skip for now
      </Link>

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
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
