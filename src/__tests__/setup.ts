// Test environment setup — all required env vars must be set
// Core
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.ADMIN_SECRET = "test-admin-secret";

// Solana
process.env.SOLANA_MINT_AUTHORITY_SECRET_KEY = JSON.stringify(Array(64).fill(0));
process.env.USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
process.env.USDC_TREASURY_SECRET_KEY = JSON.stringify(Array(64).fill(0));

// Auth
process.env.PRIVY_APP_SECRET = "test-secret";
process.env.GUEST_TOKEN_SECRET = "test-guest-secret";
process.env.LOCAL_UPLOAD_SIGNING_SECRET = "test-signing-secret";

// S3 / R2
process.env.S3_ENDPOINT = "https://test.r2.cloudflarestorage.com";
process.env.S3_ACCESS_KEY_ID = "test-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_PUBLIC_URL = "https://cdn.test.com";
process.env.S3_REGION = "us-east-1";
process.env.STORAGE_MODE = "local";

// Email
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_FROM_EMAIL = "Test <test@test.com>";

// Campaign
process.env.PLAYER_POOL_PERCENT = "0.84";

// NEXT_PUBLIC_*
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_PRIVY_APP_ID = "test-app-id";
process.env.NEXT_PUBLIC_ROUNDS_PER_SESSION = "5";
process.env.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS = "30";
process.env.NEXT_PUBLIC_ENTRY_FEE_USDC = "1.00";
process.env.NEXT_PUBLIC_TRIBE_TASTE_SCORE = "70";
process.env.NEXT_PUBLIC_SOLANA_NETWORK = "devnet";
process.env.NEXT_PUBLIC_SOLANA_CLUSTER = "devnet";
