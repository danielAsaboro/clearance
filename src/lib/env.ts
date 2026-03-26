import { z } from "zod";

const serverSchema = z.object({
  // Core
  DATABASE_URL: z.string(),
  ADMIN_SECRET: z.string(),

  // Solana
  SOLANA_MINT_AUTHORITY_SECRET_KEY: z.string(),
  USDC_MINT_ADDRESS: z.string(),
  USDC_TREASURY_SECRET_KEY: z.string(),

  // Auth
  PRIVY_APP_SECRET: z.string(),
  GUEST_TOKEN_SECRET: z.string(),
  LOCAL_UPLOAD_SIGNING_SECRET: z.string(),

  // S3 / R2
  S3_ENDPOINT: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_BUCKET: z.string(),
  S3_PUBLIC_URL: z.string(),
  S3_REGION: z.string(),
  STORAGE_MODE: z.enum(["local", "r2"]),

  // Email
  RESEND_API_KEY: z.string(),
  RESEND_FROM_EMAIL: z.string(),

  // Campaign
  PLAYER_POOL_PERCENT: z.string().transform(Number),

  // Integrations
  DRIP_API_KEY: z.string(),
  DRIP_API_URL: z.string(),
  TORQUE_API_KEY: z.string(),
  // Optional flags
  SAMPLE_SESSION_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  VRF_TESTING_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  // NEXT_PUBLIC_* (validated server-side, also available to clients at build time)
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string(),
  NEXT_PUBLIC_APP_URL: z.string(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string(),
  NEXT_PUBLIC_ROUNDS_PER_SESSION: z.string().transform(Number),
  NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS: z.string().transform(Number),
  NEXT_PUBLIC_ENTRY_FEE_USDC: z.string().transform(Number),
  NEXT_PUBLIC_TRIBE_TASTE_SCORE: z.string().transform(Number),
  NEXT_PUBLIC_SOLANA_NETWORK: z.string(),
  NEXT_PUBLIC_SOLANA_CLUSTER: z.string(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let _cached: ServerEnv | null = null;

function parseServerEnv(): ServerEnv {
  if (_cached) return _cached;

  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    throw new Error(
      `\n❌ Missing or invalid environment variables:\n\n${missing}\n\nFix these in your .env / .env.local file and restart.\n`
    );
  }

  _cached = result.data;
  return _cached;
}

export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    const env = parseServerEnv();
    return env[prop as keyof ServerEnv];
  },
});

export const clientEnv = {
  SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  ROUNDS_PER_SESSION: Number(process.env.NEXT_PUBLIC_ROUNDS_PER_SESSION!),
  VOTING_ROUND_DURATION_IN_SECONDS: Number(
    process.env.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS!
  ),
  ENTRY_FEE_USDC: Number(process.env.NEXT_PUBLIC_ENTRY_FEE_USDC!),
  TRIBE_TASTE_SCORE: Number(process.env.NEXT_PUBLIC_TRIBE_TASTE_SCORE!),
  SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK!,
  SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER!,
} as const;
