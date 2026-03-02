"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { OnboardingProvider } from "@/lib/onboarding-context";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, ready, getAccessToken } = usePrivy();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      router.replace("/");
      return;
    }

    getAccessToken()
      .then((token) =>
        fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (profile?.consentAccepted) {
          // Already onboarded — route based on role
          if (profile.role === "creator") {
            router.replace("/creator-hub");
          } else {
            router.replace("/arena");
          }
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [ready, authenticated, getAccessToken, router]);

  if (checking) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <OnboardingProvider>{children}</OnboardingProvider>;
}
