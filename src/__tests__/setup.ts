// Test environment setup
process.env.NEXT_PUBLIC_PRIVY_APP_ID = "test-app-id";
process.env.PRIVY_APP_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://api.devnet.solana.com";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_PUBLIC_URL = "https://cdn.test.com";
process.env.S3_ACCESS_KEY_ID = "test-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret";
process.env.S3_REGION = "us-east-1";
