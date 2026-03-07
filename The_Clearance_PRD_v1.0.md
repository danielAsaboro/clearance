
# SPOTR TV

**Product Requirements Document (PRD)**
Version 2.0 | March 2026
Status: Current

| Prepared by | Daniel Asaboro |
| :---------- | :------------- |
| **Client**  | Chuks          |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Roles](#3-user-roles)
4. [Core Flow](#4-core-flow)
5. [Session Mechanics](#5-session-mechanics)
6. [Rewards](#6-rewards)
7. [Technical Requirements](#7-technical-requirements)
8. [Blockchain & Token Configuration](#8-blockchain--token-configuration)
9. [Environment Configuration](#9-environment-configuration)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Success Metrics](#11-success-metrics)
12. [Out of Scope (Post-MVP)](#12-out-of-scope-post-mvp)

---

## 1. Executive Summary

**Spotr TV** is a gamified prediction game where fans pay a $3.50 USDC entry fee to join live sessions, watch pairs of short videos, and pick which one will "go viral." Each session consists of up to 28 matchups with 30-second voting rounds. After all rounds, the majority vote on each matchup determines the correct answer. Fans earn tiered Blind Box NFT rewards based on their prediction accuracy, with USDC payouts determined by a raffle-within-tier mechanic. Admins create sessions, upload videos, configure matchups, and manage the session lifecycle through an admin panel.

---

## 2. Product Overview

### 2.1 Problem & Solution

Audiences crave interactive, short-form video entertainment with real stakes. Spotr TV solves this by letting fans put their trend-spotting instincts to the test: each session presents head-to-head video matchups, fans pick their winner, and accuracy earns them NFT-backed rewards with real USDC value.

### 2.2 Target Audience

| Segment | Profile |
| :------ | :------ |
| **Fans** | Social media users, aged 16–40, interested in interactive entertainment, NFTs, and predicting viral content |

### 2.3 Core Value Proposition

- Gamified voting experience with real financial stakes ($3.50 USDC entry)
- Blind Box NFT rewards tied to prediction accuracy
- Tradable NFT assets (unopened blind boxes can be sold on marketplaces)
- Simple, mobile-first UX — swipe between two videos and pick your winner

---

## 3. User Roles

### 3.1 Admin

Admins manage the entire session lifecycle. Admin access is granted via a secret key (`ADMIN_SECRET` environment variable). Any authenticated user can register as an admin by navigating to `/admin-register` and providing the correct secret key.

**Admin capabilities:**
- Upload and manage videos (via S3 presigned URLs)
- Create and schedule sessions (title, date/time, late-join cutoff)
- Configure matchups (pair videos A vs B for each round)
- Control session status transitions: `scheduled` → `live` → `ended`
- Finalize results (trigger majority-vote calculation and tier assignment)
- Trigger NFT minting, raffle, reveal, and USDC distribution
- View stats and analytics

### 3.2 Fan (Player)

Fans are the core participants. They browse sessions, pay the entry fee, vote in matchups, and earn rewards. Users default to the `player` role upon registration.

**Fan capabilities:**
- Browse upcoming, live, and past sessions
- Pay $3.50 USDC entry fee to join a live session
- Vote in each matchup round (pick video A or video B)
- View results and accuracy breakdown after a session ends
- Mint, reveal, and claim Blind Box NFT rewards
- Mint test USDC from the faucet (Mint Page)

---

## 4. Core Flow

### 4.1 Admin Flow

#### 4.1.1 Register as Admin

1. User logs in via Privy (email, phone, or wallet).
2. Navigates to `/admin-register`.
3. Enters the admin secret key.
4. Backend (`POST /api/admin/register`) validates the secret against `ADMIN_SECRET` env var.
5. On match, user's role is promoted to `admin` in the database.
6. User is redirected to the admin dashboard at `/admin`.

#### 4.1.2 Upload Videos

1. Admin navigates to `/admin/videos`.
2. Uploads video files via S3 presigned URLs (`POST /api/admin/videos/presign`).
3. After upload completes, creates a video record (`POST /api/admin/videos`) with title, URL, and optional thumbnail.

#### 4.1.3 Create a Session

1. Admin navigates to `/admin/sessions`.
2. Creates a new session (`POST /api/sessions`) with:
   - `weekNumber` — unique identifier for the session
   - `title` — display name
   - `scheduledAt` — date and time the session is scheduled to go live
   - `lateJoinCutoff` — (optional) deadline after which fans cannot join

#### 4.1.4 Configure Matchups

1. Admin selects a scheduled session.
2. Creates matchups (`POST /api/admin/sessions/:id/matchups`) — an array of video pairs, each with a `matchupNumber`, `videoAId`, and `videoBId`.
3. Matchups can only be added to sessions in `scheduled` status.
4. Creating new matchups replaces any existing matchups for that session.

#### 4.1.5 Run the Session

1. Admin sets session status to `live` (`PATCH /api/sessions/:id` with `{ status: "live" }`).
2. Email reminders are automatically sent to all registered players when a session goes live.
3. The SSE stream (`/api/sessions/:id/stream`) begins broadcasting round state (current round, seconds remaining) to connected fans.
4. When all rounds complete, admin sets status to `ended`.

#### 4.1.6 Finalize Results

1. Admin triggers finalization (`POST /api/admin/sessions/:id/finalize`).
2. The system calculates majority winners for each matchup (video_a wins ties).
3. Each fan's correct vote count is tallied against the majority winners.
4. Reward tiers are assigned based on accuracy thresholds.
5. `GameResult` records are updated with `correctVotes`, `totalVotes`, `tier`, and `rewardAmount`.

### 4.2 Fan Flow

#### 4.2.1 Session Awareness

After logging in, fans land on the **Arena** page (`/arena`). The page adapts based on session state:

| Condition | Display | Action |
| :-------- | :------ | :----- |
| Session is on a future date | Session date, time, and description | "Add to Google Calendar" button |
| Session is today but not yet live | Live countdown timer | Countdown display |
| Session is currently live | "Session is LIVE" banner with current round | "Join Now" button |
| Session has ended | Results summary and next session date | "View Results" link |

#### 4.2.2 Session Entry & Deposit

1. Fan clicks "Join Now" on a live session.
2. Entry confirmation modal is shown: "$3.50 USDC entry fee, added to the reward pool."
3. Fan confirms. The backend builds an unsigned `fan_deposit` transaction (`POST /api/sessions/:id/join`).
4. Fan signs the transaction in their wallet.
5. A `GameResult` record is created, linking the fan to the session.
6. If the fan's wallet has insufficient USDC, a friendly notification directs them to the Mint Page (`/mint`).

#### 4.2.3 Game Mode (Voting)

1. Fan enters the game UI (`/arena/game?session=<id>`).
2. The client connects to the SSE stream for real-time round synchronization.
3. Each round displays a **matchup** — two videos side by side.
4. Fan picks **video A** or **video B** (which one they think will trend/go viral).
5. Each round lasts 30 seconds (configurable via `VOTING_ROUND_DURATION_SECONDS`).
6. If the fan does not vote within the time limit, the round is skipped (no vote recorded).
7. After all rounds, the client redirects to the results page.

#### 4.2.4 Results

After the session ends and results are finalized, fans view their results at `/arena/results?session=<id>`:

- Accuracy breakdown (correct votes / total matchups)
- Blind Box tier earned (Gold, Base, or Participation)
- Reward amount
- NFT mint status
- Option to share results

---

## 5. Session Mechanics

### 5.1 Structure

| Parameter | Value | Source |
| :-------- | :---- | :----- |
| Matchups per session | 28 (default) | `MATCHUPS_PER_SESSION` env var |
| Round duration | 30 seconds (default) | `VOTING_ROUND_DURATION_SECONDS` env var |
| Estimated session duration | ~14 minutes (28 rounds x 30s) | Calculated |
| Late join window | Up to 1 hour after session start (default) | `lateJoinCutoff` on session, or 1-hour default |

### 5.2 Matchup Voting

Each matchup presents two videos. Fans pick which video they believe will trend. The vote is recorded as `video_a` or `video_b`.

### 5.3 Scoring — Majority Vote

After a session ends, the **correct answer** for each matchup is determined by majority vote:

- Count all `video_a` vs `video_b` votes per matchup.
- The video with the most votes is the winner.
- **Ties go to video_a** (first-listed video wins ties).
- A fan's vote is "correct" if it matches the majority winner.

### 5.4 Late Join

- Fans can join a live session up to 1 hour after it starts (or until `lateJoinCutoff` if set).
- Late joiners vote only on remaining rounds.
- Their tier is still calculated against the total matchup count.

### 5.5 Real-Time Sync

Round state is broadcast via **Server-Sent Events (SSE)** at `/api/sessions/:id/stream`. Each event contains:

```json
{
  "status": "live",
  "round": 5,
  "secondsRemaining": 18,
  "totalRounds": 28
}
```

When the session ends, a final event with `"status": "ended"` is sent.

---

## 6. Rewards

### 6.1 Tier Thresholds

| Accuracy | Tier | NFT Awarded |
| :------- | :--- | :---------- |
| >= 75% correct | **Gold** | Gold Blind Box |
| >= 36% correct | **Base** | Base Blind Box |
| < 36% correct | **Participation** | Participation NFT |

Thresholds are calculated dynamically: `goldThreshold = ceil(totalMatchups * 0.75)`, `baseThreshold = ceil(totalMatchups * 0.36)`.

### 6.2 Blind Box NFT Mechanics

1. After results are finalized, fans can **mint** their Blind Box as an NFT (Metaplex Core on Solana).
2. **Unopened Blind Boxes** can be listed and traded on NFT marketplaces (e.g., Magic Eden).
3. Admin triggers a **raffle** that determines the actual USDC payout within each tier.
4. On **reveal**, the NFT shows its raffle-determined USDC amount and becomes **soulbound** (non-transferable).
5. Fans **claim** their USDC payout (on-chain SPL token transfer from the session vault).
6. Revealed NFTs remain in the wallet as permanent proof of participation.

### 6.3 Raffle Distribution

| Tier | Raffle Chance | Payout |
| :--- | :------------ | :----- |
| Gold Blind Box | 10% of Gold winners | $3.50 USDC |
| Gold Blind Box | 90% of Gold winners | $1.75 USDC |
| Base Blind Box | 10% of Base winners | $1.75 USDC |
| Base Blind Box | 90% of Base winners | $0 |
| Participation NFT | — | $0 |

**Expected values:**
- Gold Box: (0.10 x $3.50) + (0.90 x $1.75) = **$1.925**
- Base Box: (0.10 x $1.75) + (0.90 x $0) = **$0.175**

### 6.4 Session Economics

| Parameter | Value |
| :-------- | :---- |
| Fan entry fee | $3.50 USDC per session |
| Treasury funding | Admin pre-loads USDC into session vault before each session |

### 6.5 DRiP Collectibles

All session participants also earn a **DRiP collectible** — a participation collectible distributed to their wallet via DRiP, regardless of tier.

---

## 7. Technical Requirements

### 7.1 Stack

| Component | Technology |
| :-------- | :--------- |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (via Prisma ORM) |
| Authentication | Privy (email, phone, social login, embedded wallets) |
| Wallet support | Privy embedded wallets + Phantom (Solana-native) |
| Blockchain | Solana (Devnet / Mainnet) |
| NFT standard | Metaplex Core |
| Token standard | SPL Token (fake USDC) |
| File storage | S3 (presigned uploads) |
| Real-time sync | Server-Sent Events (SSE) |
| Styling | Tailwind CSS |
| Validation | Zod |

### 7.2 Authentication

- **No password-based auth** — Privy handles authentication via email magic link, phone OTP, social login (Google), and wallet connection.
- Embedded wallets (via Privy) for non-crypto-native users.
- Phantom wallet adapter for Solana-native users.

### 7.3 Admin Panel

The admin panel is a protected section at `/admin` with bottom navigation:

| Section | Path | Purpose |
| :------ | :--- | :------ |
| Dashboard | `/admin` | Overview and stats |
| Videos | `/admin/videos` | Upload, list, search, and manage videos |
| Sessions | `/admin/sessions` | Create sessions, manage matchups, control session lifecycle |
| Results | `/admin/results` | View finalized results, trigger NFT distribution |

Admin authorization is enforced at the API level — every admin endpoint checks `user.role === "admin"`.

### 7.4 Key API Routes

| Method | Route | Purpose |
| :----- | :---- | :------ |
| POST | `/api/admin/register` | Register as admin with secret key |
| GET/POST | `/api/admin/videos` | List / create video records |
| POST | `/api/admin/videos/presign` | Get S3 presigned upload URL |
| GET/POST/DELETE | `/api/admin/sessions/:id/matchups` | Manage matchups for a session |
| POST | `/api/admin/sessions/:id/finalize` | Calculate majority winners & assign tiers |
| GET | `/api/sessions` | Get current, next, and last ended session |
| POST | `/api/sessions` | Create a new session (admin) |
| GET/PATCH | `/api/sessions/:id` | Get session details / update status |
| POST | `/api/sessions/:id/join` | Fan joins session (builds deposit tx) |
| GET | `/api/sessions/:id/rounds` | Get matchup list for gameplay |
| GET | `/api/sessions/:id/stream` | SSE stream for real-time round state |
| GET | `/api/sessions/:id/results` | Get fan's results for a session |
| POST | `/api/votes` | Submit a vote on a matchup |
| GET | `/api/usdc/balance` | Check USDC balance |
| POST | `/api/usdc/mint` | Mint test USDC (faucet) |
| POST | `/api/nft/mint` | Mint Blind Box NFT |
| POST | `/api/nft/raffle` | Run raffle for a session |
| POST | `/api/nft/reveal` | Reveal a Blind Box |
| POST | `/api/nft/claim` | Claim USDC reward |

### 7.5 Data Models

| Model | Purpose |
| :---- | :------ |
| `User` | Player or admin account (linked to Privy) |
| `Video` | Uploaded video with URL and metadata |
| `WeeklySession` | A voting session with status, schedule, and optional campaign link |
| `Matchup` | A video-pair round within a session (videoA vs videoB) |
| `Vote` | A fan's vote on a matchup (video_a or video_b) |
| `GameResult` | A fan's session outcome (votes, accuracy, tier, reward, NFT status) |
| `Referral` | Fan-to-fan referral tracking |

### 7.6 Mint Page (Test USDC Faucet)

The platform includes a **Mint Page** (`/mint`) accessible from navigation and insufficient-balance screens:

- Displays the user's current fake USDC balance
- Shows the mint address and mint authority for transparency
- "Mint USDC" button mints a configurable amount directly to the connected wallet
- Clear labelling: "This is test USDC used exclusively within Spotr TV"
- Transaction status feedback (pending → confirmed)

---

## 8. Blockchain & Token Configuration

### 8.1 Chain & Standards

| Parameter | Value |
| :-------- | :---- |
| Blockchain | Solana (Devnet for development, Mainnet for production) |
| NFT Standard | Metaplex Core |
| Token Standard | SPL Token (fake USDC) |
| Wallet Support | Privy (embedded) + Phantom |

### 8.2 Fake USDC Configuration

The platform uses a **platform-issued fake USDC token** to simulate USDC without real monetary value during development and initial launch.

| Key | Value |
| :-- | :---- |
| Mint Authority Keypair | `anchor/keys/usdc-mint-authority.json` |
| Mint Authority Public Key | `DYbPcr6TNCbsdwdKZEJQqNUEFthyPZoigrT17MNdJieL` |
| Mint Address Keypair | `anchor/keys/usdc-mint-address.json` |
| Mint Address (Token Address) | `Gn5mJ41R8PFTP35t1nB2hJW5hqnLFX4WcocA9hBs6c96` |
| Decimals | 6 (matching real USDC) |
| Symbol | USDC (labelled "Test USDC" in UI) |

> **Security Note:** The mint authority keypair grants the ability to mint unlimited fake USDC. It must be kept secure and never exposed in frontend code. Minting is routed through a backend API that holds the authority.

### 8.3 NFT Configuration

| Parameter | Value |
| :-------- | :---- |
| NFT Program | Metaplex Core |
| Blind Box Types | Gold Blind Box, Base Blind Box, Participation NFT |
| Soulbound Logic | Applied on reveal — NFT becomes non-transferable after opening |
| Reveal Mechanism | Admin-triggered post-session (MVP). On-chain randomness post-MVP. |
| Raffle Probabilities | Gold: 10% get $3.50 / 90% get $1.75. Base: 10% get $1.75 / 90% get $0. |
| USDC Distribution | On-chain SPL token transfer from pre-funded session vault on claim |

---

## 9. Environment Configuration

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `MATCHUPS_PER_SESSION` | `28` | Number of video-pair matchups per session |
| `VOTING_ROUND_DURATION_SECONDS` | `30` | Duration of each voting round in seconds |
| `CAMPAIGN_CYCLE_DURATION_WEEKS` | `3` | Number of weeks in a campaign cycle |
| `LIVE_SESSIONS_PER_CYCLE` | `3` | Number of sessions per campaign cycle |
| `ADMIN_SECRET` | — | Secret key required to register as admin |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PRIVY_APP_ID` | — | Privy application ID |
| `PRIVY_APP_SECRET` | — | Privy application secret |

These values are consumed by `src/lib/campaign-config.ts`:

```typescript
export const campaignConfig = {
  cycleDurationWeeks: parseInt(process.env.CAMPAIGN_CYCLE_DURATION_WEEKS ?? "3"),
  liveSessionsPerCycle: parseInt(process.env.LIVE_SESSIONS_PER_CYCLE ?? "3"),
  matchupsPerSession: parseInt(process.env.MATCHUPS_PER_SESSION ?? "28"),
  votingRoundDurationSeconds: parseInt(process.env.VOTING_ROUND_DURATION_SECONDS ?? "30"),
} as const;
```

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
| :--- | :----- | :--------- | :--------- |
| Low crypto literacy among users | High — blocks NFT claims and entry fee | High | Privy embedded wallets remove the need for external wallet setup. Mint Page provides easy access to test USDC. |
| Gas fee spikes on Solana | Low — Solana fees are minimal | Low | Platform covers gas for NFT minting. Batch where possible. |
| Concurrent user load during live sessions | High — degraded experience | Medium | SSE-based architecture (lighter than WebSockets). CDN for static assets. Load testing before launch. |
| Fan has insufficient USDC to enter session | Medium — drop-off | High | Clear notification with direct link to Mint Page faucet. |
| Fake USDC mint authority key exposure | High — unlimited minting | Low | Keypair kept server-side only. Never exposed in frontend. Backend API proxies all minting. |
| Majority-vote gaming (coordinated voting) | Medium — distorted results | Low | Large enough player base makes coordination difficult. Monitor vote distributions for anomalies. |

---

## 11. Success Metrics

| Metric | Target (per session) | Measurement |
| :----- | :------------------- | :---------- |
| Fan participation | 50+ active voters per session | Unique voters per session |
| Session completion rate | 70%+ of fans vote in all rounds | Fans completing all rounds / Total fans |
| NFT mint rate | 60%+ of eligible fans mint their NFT | Minted NFTs / Eligible fans |
| USDC claim rate | 50%+ of eligible fans claim their USDC | Claims / Eligible fans |
| Week-over-week retention | 40%+ fans return for next session | Returning fans / Previous session fans |

---

## 12. Out of Scope (Post-MVP)

The following features are explicitly deferred:

- Native mobile apps (iOS / Android)
- Creator role and onboarding flow
- TikTok integration (task assignment, submission, verification)
- Built-in secondary NFT marketplace
- Multi-language support
- Automated video sourcing (AI-based)
- Tokenomics and governance token
- On-chain randomness for Blind Box reveal (currently admin-triggered)
- Real USDC (replacing fake/test USDC)
- WebSocket-based real-time sync (currently using SSE)
- Advanced analytics dashboard

---

*End of Document — Spotr TV PRD v2.0*
