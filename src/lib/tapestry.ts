const TAPESTRY_BASE_URL = "https://api.usetapestry.dev/v1";
const TAPESTRY_API_KEY = process.env.TAPESTRY_API_KEY ?? "";
const TAPESTRY_NAMESPACE = "spotr-tv";

async function tapestryFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${TAPESTRY_BASE_URL}${path}${separator}apiKey=${TAPESTRY_API_KEY}`;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export async function findOrCreateProfile(
  walletAddress: string,
  username: string
) {
  const res = await tapestryFetch("/profiles/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
      username,
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tapestry findOrCreateProfile failed: ${text}`);
  }
  return res.json();
}

export async function getFollowers(walletAddress: string) {
  const res = await tapestryFetch(
    `/profiles/followers/${walletAddress}`
  );
  if (!res.ok) return { followers: [], count: 0 };
  const data = await res.json();
  return {
    followers: data.followers ?? data ?? [],
    count: data.count ?? (Array.isArray(data) ? data.length : 0),
  };
}

export async function getFollowing(walletAddress: string) {
  const res = await tapestryFetch(
    `/profiles/following/${walletAddress}`
  );
  if (!res.ok) return { following: [], count: 0 };
  const data = await res.json();
  return {
    following: data.following ?? data ?? [],
    count: data.count ?? (Array.isArray(data) ? data.length : 0),
  };
}

export async function createReferral(
  referrerWallet: string,
  referredWallet: string
) {
  // No referral endpoint in Tapestry — use a mutual follow as "referral bond"
  const res = await tapestryFetch("/followers", {
    method: "POST",
    body: JSON.stringify({
      startId: referredWallet,
      endId: referrerWallet,
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  });
  if (!res.ok) {
    // Non-fatal — referral bond is best-effort
    console.error("Tapestry referral bond failed:", await res.text());
    return null;
  }
  return res.json();
}
