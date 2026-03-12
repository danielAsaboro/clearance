# Spotr TV

Gamified social-impact platform connecting debt-burdened Nigerian content creators with fans through weekly interactive voting sessions on Solana.

Creators produce TikTok content tied to platform-assigned tasks. Fans vote in live 28-round sessions (30s per round) and earn Blind Box NFT rewards with real USDC value based on voting accuracy.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Privy (email, phone, wallet)
- **Blockchain**: Solana (Anchor smart contracts, Metaplex Core NFTs)
- **Styling**: Tailwind CSS 4
- **Email**: Resend
- **Storage**: S3-compatible (NFT metadata, profile photos)
- **Testing**: Jest + ts-jest (API/logic), Anchor test suite (smart contracts)

## Project Structure

```
├── anchor/                 # Solana program (Anchor)
│   ├── programs/spotr/     # Smart contract (vault, claim_with_nft)
│   ├── tests/              # 11 on-chain integration tests
│   └── src/                # TypeScript exports & IDL
├── prisma/
│   └── schema.prisma       # Database schema (User, Task, Session, Vote, GameResult, Referral)
├── public/
│   ├── sw.js               # Service worker (PWA offline support)
│   ├── manifest.json       # PWA manifest
│   └── actions.json        # Solana Actions (Blinks) config
├── src/
│   ├── app/
│   │   ├── page.tsx                # Home — role selection (Creator / Fan)
│   │   ├── arena/                  # Fan flow — sessions, game mode, results
│   │   ├── creator-hub/            # Creator flow — tasks, submissions
│   │   ├── admin/                  # Admin dashboard, sessions, tasks, results
│   │   ├── onboarding/             # 5-step creator onboarding
│   │   ├── rewards/                # Blind Box NFT collection & claims
│   │   ├── leaderboard/            # Creator rankings (SOAR on-chain)
│   │   └── api/                    # API routes
│   │       ├── actions/            # Solana Actions (Blinks) — join, claim
│   │       ├── admin/              # Admin stats, judging, DRiP distribution
│   │       ├── sessions/           # Session CRUD, rounds, join, results
│   │       ├── tasks/              # Task assignment & submission
│   │       ├── nft/                # Mint, reveal, claim USDC
│   │       ├── votes/              # Vote submission
│   │       └── users/              # User profile & role management
│   ├── components/                 # Shared UI components
│   ├── lib/                        # Utilities
│   │   ├── auth-helpers.ts         # Privy token verification + auto-user creation
│   │   ├── session-engine.ts       # Session state, tier calculation, calendar ICS
│   │   ├── nft.ts                  # Metaplex Core — mint, reveal, freeze
│   │   ├── nft-metadata.ts         # NFT metadata JSON upload to S3
│   │   ├── vault-claim.ts          # Build partially-signed claim_with_nft tx
│   │   ├── tiktok.ts               # URL validation, oEmbed, hashtag verification
│   │   ├── email.ts                # Session reminders & results emails (Resend)
│   │   ├── rate-limit.ts           # In-memory rate limiter
│   │   ├── validators.ts           # Zod schemas for all API inputs
│   │   └── solana.ts               # Solana connection helpers
│   ├── proxy.ts                    # Next.js proxy (auth + role-based routing)
│   └── __tests__/                  # Jest test suites (53 tests)
└── scripts/                        # Utility scripts
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Solana CLI + Anchor CLI (for smart contract development)

### Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://..."

# Privy Auth
NEXT_PUBLIC_PRIVY_APP_ID="..."
PRIVY_APP_SECRET="..."

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_MINT_AUTHORITY_SECRET_KEY="[...]"
USDC_MINT_ADDRESS="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# S3 Storage (NFT metadata, uploads)
S3_BUCKET="..."
S3_PUBLIC_URL="..."
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_REGION="auto"
S3_ENDPOINT="..."

# Email (Resend)
RESEND_API_KEY="..."

# Optional
NEXT_PUBLIC_APP_URL="https://spotr.tv"
DRIP_API_KEY="..."
DRIP_API_URL="..."
```

### Install & Run

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### Smart Contracts

```bash
cd anchor
anchor build
anchor test
anchor deploy
```

### Tests

```bash
npm test              # 53 Jest tests (validators, session engine, proxy, tiktok)
npm run anchor-test   # 11 Anchor smart contract tests
```

### Build

```bash
npm run build
```

## Core Flows

### Creator Flow
1. Select "Creator" on home screen (role locked after onboarding)
2. Complete 5-step onboarding (debt sources, TikTok username, consent)
3. Receive 3 weekly content tasks with `#SpotrTV` hashtag requirement
4. Submit TikTok video URLs (auto-verified for hashtag via oEmbed)
5. Admin reviews and verifies submissions

### Fan Flow
1. Select "Fan" on home screen
2. View upcoming session with countdown / "Set Reminder"
3. Join live session — vote Approve/Reject on 28 videos (30s each)
4. View results: tier calculated from correct votes
5. Receive Blind Box NFT (Gold/Base/Participation tier)
6. Reveal NFT, claim USDC reward from vault

### Reward Tiers

| Tier | Correct Votes | Reward |
|------|--------------|--------|
| Gold | 21+ / 28 | $3.50 USDC |
| Base | 10-20 / 28 | $1.75 USDC |
| Participation | 0-9 / 28 | DRiP collectible |

### Admin Flow
- Create weekly sessions and assign rounds
- Review/verify creator task submissions
- Go Live / End session with status transitions
- Judge rounds (set admin verdicts, auto-calculate results)
- Batch mint NFTs for eligible participants
- Distribute DRiP participation collectibles
- View analytics (users, votes, referrals, completion rates, NFTs, claims)

## Solana Actions (Blinks)

Shareable Blinks for wallet-native interaction:

- **Join Session**: `/api/actions/join?session={id}`
- **Claim Reward**: `/api/actions/claim?result={id}` — Builds real `claim_with_nft` vault transaction

## PWA

Installable as a Progressive Web App:
- Web app manifest with icons (192x192, 512x512)
- Service worker with cache-first static assets, network-first navigation
- Apple Web App meta tags with black-translucent status bar

## License

Private — All rights reserved.
