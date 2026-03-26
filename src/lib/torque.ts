import { serverEnv } from "@/lib/env";

const TORQUE_API_URL = "https://api.torque.so/v1";
const TORQUE_API_KEY = serverEnv.TORQUE_API_KEY;

type LoyaltyAction =
  | "session_vote"
  | "nft_reveal"
  | "referral_signup"
  | "session_join";

async function torqueFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  if (!TORQUE_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${TORQUE_API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TORQUE_API_KEY}`,
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Torque] ${options.method ?? "GET"} ${path} → ${res.status}: ${body}`);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export async function trackAction(
  walletAddress: string,
  actionType: LoyaltyAction
) {
  try {
    const res = await torqueFetch("/actions/track", {
      method: "POST",
      body: JSON.stringify({
        wallet: walletAddress,
        action: actionType,
        namespace: "spotr-tv",
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res || !res.ok) return null;
    return res.json();
  } catch (error) {
    // Fire-and-forget — never block the main flow
    console.error("Torque track action error:", error);
    return null;
  }
}

export async function getCampaignProgress(walletAddress: string) {
  try {
    const res = await torqueFetch(
      `/campaigns/progress?wallet=${walletAddress}&namespace=spotr-tv`
    );
    if (!res || !res.ok) return { campaigns: [], streaks: 0, totalActions: 0 };
    return res.json();
  } catch {
    return { campaigns: [], streaks: 0, totalActions: 0 };
  }
}

export async function getRewards(walletAddress: string) {
  try {
    const res = await torqueFetch(
      `/rewards?wallet=${walletAddress}&namespace=spotr-tv`
    );
    if (!res || !res.ok) return { rewards: [], totalEarned: 0 };
    return res.json();
  } catch {
    return { rewards: [], totalEarned: 0 };
  }
}
