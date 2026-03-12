import { usePrivy, useLoginWithOAuth, useLoginWithEmail } from "@privy-io/expo";
import { useEffect, useCallback, useMemo } from "react";
import { router } from "expo-router";
import { setTokenGetter } from "./api";
import type { User } from "@privy-io/api-types";

/**
 * Extract email from Privy user's linked_accounts.
 */
export function getUserEmail(user: User | null): string | null {
  if (!user) return null;
  const emailAccount = user.linked_accounts.find(
    (a) => a.type === "email"
  );
  return emailAccount && "address" in emailAccount
    ? (emailAccount as any).address
    : null;
}

/**
 * Extract wallet address from Privy user's linked_accounts.
 */
export function getUserWallet(user: User | null): string | null {
  if (!user) return null;
  const walletAccount = user.linked_accounts.find(
    (a) => a.type === "wallet"
  );
  return walletAccount && "address" in walletAccount
    ? (walletAccount as any).address
    : null;
}

/**
 * Hook that wires Privy auth into the API client and provides auth state.
 */
export function useAuth() {
  const { user, isReady, logout, getAccessToken } = usePrivy();
  const { login: oauthLogin } = useLoginWithOAuth();

  const authenticated = !!user;

  // Wire token getter into API client
  useEffect(() => {
    if (isReady) {
      setTokenGetter(getAccessToken);
    }
  }, [isReady, getAccessToken]);

  const signOut = useCallback(async () => {
    await logout();
    router.replace("/");
  }, [logout]);

  const login = useCallback(() => {
    oauthLogin({ provider: "google" });
  }, [oauthLogin]);

  const email = useMemo(() => getUserEmail(user), [user]);
  const walletAddress = useMemo(() => getUserWallet(user), [user]);

  return {
    user,
    isReady,
    authenticated,
    login,
    logout: signOut,
    getAccessToken,
    email,
    walletAddress,
  };
}
