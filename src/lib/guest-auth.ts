import { createHmac } from "crypto";

const ADJECTIVES = [
  "Bold", "Swift", "Keen", "Cool", "Chill", "Epic", "Wild", "Neon",
  "Sonic", "Vivid", "Lucky", "Brave", "Slick", "Rapid", "Stark",
  "Fierce", "Sharp", "Bright", "Prime", "Blaze",
];

const NOUNS = [
  "Tiger", "Falcon", "Panther", "Fox", "Eagle", "Lion", "Wolf",
  "Hawk", "Cobra", "Phoenix", "Viper", "Raven", "Storm", "Blitz",
  "Spark", "Drift", "Pulse", "Flash", "Nova", "Frost",
];

export function generateGuestUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const digits = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `${adj}${noun}${digits}`;
}

function getSecret(): string {
  // Validated at startup via serverEnv
  return process.env.GUEST_TOKEN_SECRET!;
}

export function signGuestToken(userId: string): string {
  const payload = JSON.stringify({ sub: userId, iat: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `guest_${encoded}.${sig}`;
}

export function verifyGuestToken(token: string): string | null {
  if (!token.startsWith("guest_")) return null;

  const raw = token.slice(6); // remove "guest_" prefix
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encoded = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);

  const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
