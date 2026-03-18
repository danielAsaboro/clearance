"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Info, Loader2, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import PageHeader from "@/components/PageHeader";

type MintStatus = "idle" | "minting" | "success" | "error";

export default function MintPage() {
  const { authenticated, login, getAccessToken } = usePrivy();
  const { wallets, ready } = useWallets();
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const walletAddress = wallets[0]?.address;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const fetchBalance = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      await fetch("/api/usdc/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleMint = async () => {
    setMintStatus("minting");
    setErrorMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Session expired — please reconnect your wallet.");

      const res = await fetch("/api/usdc/mint", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Mint failed");
      }

      setMintStatus("success");
      setTimeout(fetchBalance, 2000);
    } catch (err) {
      setMintStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <div className="spotr-page flex flex-1 flex-col">
      <PageHeader title="Get Test USDC" backHref="/arena" />

      <div className="spotr-mobile-shell flex flex-1 flex-col gap-4 px-5 py-4">
        <div className="rounded-[16px] border border-[#8a7723] bg-[#171717] px-4 py-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d7bb39]" />
            <p className="text-[14px] leading-5 text-[#8b8b8b]">
              First session is FREE. Connect your wallet to claim $10 devnet USDC for your first session.
            </p>
          </div>
        </div>

        <div className="spotr-panel flex flex-col items-center gap-5 px-5 py-7 shadow-[0_0_60px_rgba(245,214,61,0.06)]">
          <span className="rounded-full bg-[#f5d63d] px-4 py-[5px] text-[11px] font-semibold uppercase tracking-[0.06em] text-black">
            Faucet
          </span>

          <div className="flex items-baseline gap-2 leading-none">
            <span className="font-display text-[72px] font-bold tracking-[-0.08em] text-[#f5d63d]">$10</span>
            <span className="text-[34px] font-semibold tracking-[-0.05em] text-[#f5d63d]">USDC</span>
          </div>

          <p className="text-[14px] text-[#8b8b8b]">Devnet Testnet Funds</p>

          {!authenticated ? (
            <button
              onClick={() => login()}
              className="spotr-primary-button mt-1 flex w-full items-center justify-center gap-2"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          ) : null}

          {authenticated && mintStatus !== "success" ? (
            <>
              {ready && shortAddress ? (
                <div className="spotr-wallet-pill mt-2 flex w-full items-center justify-center gap-2 px-4">
                  <Wallet className="h-4 w-4 text-[#d0b43a]" />
                  <span className="font-mono text-[13px] text-[#cbcbcb]">{shortAddress}</span>
                  <CheckCircle className="h-4 w-4 text-[#49ca63]" />
                </div>
              ) : null}

              {mintStatus === "error" ? (
                <p className="text-center text-[13px] text-red-400">{errorMsg}</p>
              ) : null}

              <button
                onClick={handleMint}
                disabled={mintStatus === "minting"}
                className="spotr-primary-button flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mintStatus === "minting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Claim Test USDC
                  </>
                )}
              </button>
            </>
          ) : null}

          {mintStatus === "success" ? (
            <>
              {ready && shortAddress ? (
                <div className="spotr-wallet-pill mt-2 flex w-full items-center justify-center gap-2 px-4">
                  <Wallet className="h-4 w-4 text-[#d0b43a]" />
                  <span className="font-mono text-[13px] text-[#cbcbcb]">{shortAddress}</span>
                  <CheckCircle className="h-4 w-4 text-[#49ca63]" />
                </div>
              ) : null}

              <div className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#45ca61] text-[15px] font-semibold text-black">
                <CheckCircle className="h-4 w-4" />
                Claimed! $10 USDC sent
              </div>
            </>
          ) : null}
        </div>

        <Link href="/arena">
          <button
            className={`flex min-h-[52px] w-full items-center justify-center rounded-[14px] border text-[15px] font-semibold transition-colors ${
              mintStatus === "success"
                ? "border-[#f5d63d] text-[#f5d63d] hover:bg-[#f5d63d]/10"
                : "border-[#323232] text-[#666] hover:border-[#555]"
            }`}
          >
            Continue to Deposit
          </button>
        </Link>

        <p className="spotr-screen-footer text-center">
          Limit: $10 per wallet per 24 hours. Devnet only.
        </p>
      </div>
    </div>
  );
}
