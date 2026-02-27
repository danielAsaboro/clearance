
# THE CLEARANCE

**Product Requirements Document (PRD)**
MVP Stage — 3-Week Development Cycle
Version 1.1 | February 2026
Status: Draft for Review

| Prepared by | Daniel Asaboro |
| :---------- | :------------- |
| **Client**  | Chuks          |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Roles & Detailed Flows](#3-user-roles--detailed-flows)
4. [Weekly Campaign Cycle](#4-weekly-campaign-cycle)
5. [Technical Requirements](#5-technical-requirements-mvp)
6. [Blockchain & Token Configuration](#6-blockchain--token-configuration)
7. [Identified Gaps & Resolutions](#7-identified-gaps--resolutions)
8. [MVP Development Milestones](#8-mvp-development-milestones-3-week-cycle)
9. [Key Risks & Mitigations](#9-key-risks--mitigations)
10. [MVP Success Metrics](#10-mvp-success-metrics)
11. [Out of Scope (Post-MVP)](#11-out-of-scope-post-mvp)

---

## 1. Executive Summary

**The Clearance** is a gamified, social-impact web application targeting the Nigerian market. It connects debt-burdened content creators with engaged fans through weekly interactive live sessions. Creators produce TikTok content tied to platform-assigned tasks; fans participate in live voting sessions where their predictive accuracy earns them **Blind Box NFT rewards** with real USDC value.

The platform runs on a fixed **3-week campaign cycle**. Each week features one live session with up to **28 creator videos**, **30-second voting rounds**, and NFT-based reward distribution. Fans pay a **$3.50 USDC entry fee** per session, which funds the reward pool and creates real stakes for every vote.

---

## 2. Product Overview

### 2.1 Problem Statement

Many Nigerian content creators carry personal debt from various sources (betting, medical emergencies, business failures) and lack structured paths to monetize their content for debt relief. Meanwhile, audiences who want to support creators have no engaging mechanism beyond passive viewership.

### 2.2 Solution

The Clearance bridges this gap by creating a structured, time-bound campaign where creators complete content tasks for visibility and debt relief consideration, while fans engage in gamified voting sessions that reward accuracy with tradable NFT assets.

### 2.3 Target Audience

| Segment | Profile |
| :------ | :------ |
| **Creators** | Nigerian TikTok content creators, aged 18–35, carrying personal debt, willing to produce content for the platform |
| **Fans** | Nigerian social media users, aged 16–40, interested in interactive entertainment, NFTs, and supporting creators |

### 2.4 Core Value Propositions

| For Creators | For Fans |
| :----------- | :------- |
| Structured path to earn debt relief through content creation | Gamified voting experience with real stakes |
| Amplified reach via the `#theclearanceNG` hashtag campaign | Earn Blind Box NFTs with real USDC value based on voting accuracy |
| Referral tools to mobilize fan support | Tradable NFT assets (unopened blind boxes) |
| | Raffle-based reward: $3.50 entry, tiered blind box reveal with up to $3.50 payout |

---

## 3. User Roles & Detailed Flows

### 3.1 Entry Point — All Users

On app launch, the user is presented with a **role selection screen**. This is a **one-time, irreversible choice** for the duration of the campaign cycle. The two available roles are:

- **Creator**
- **Fan**

Upon selection, the user is redirected to the corresponding onboarding experience. No traditional account creation is required at this stage — identification is handled via wallet connection (Privy) or a simple email/phone capture.

---

### 3.2 Creator Flow

#### 3.2.1 Step 1 — Profile Setup

Creators complete a mandatory onboarding form before accessing the platform.

| Field | Type / Options | Notes |
| :---- | :------------- | :---- |
| Source of Debt | Multi-select: Betting, Emergency, Medical, Business, None | Required. Used for creator profiling and storytelling context. "None" allows debt-free creators to participate. |
| Willingness Declaration | Binary: Yes / No | Required. Confirms creator is willing to complete any legal task assigned. Selecting "No" triggers a confirmation modal explaining limited task options. |
| TikTok Username | Text input (validated format: `@username`) | Required. Must be a valid, publicly accessible TikTok profile. Handle format is validated on submit. |
| Disclaimer / Consent | Checkbox acceptance | Required. Creator grants the platform full ownership of submitted video content and permission to use, distribute, and modify it. Must include a link to full legal terms. |
| Display Name | Text input | Required. The name shown to fans during voting sessions. |
| Profile Photo | Image upload (max 2MB, JPG/PNG) | Optional for MVP. Default avatar assigned if skipped. |

#### 3.2.2 Step 2 — Task Assignment

Upon completing profile setup, each creator is assigned exactly **3 content tasks** for the current week by the platform admin.

**Task Requirements:**
- Each task must be filmed and posted as a **TikTok video** on the creator's own account.
- Every video must include the hashtag `#theclearanceNG` in the caption.
- The creator must submit the **TikTok video URL** inside the platform via a submission form.
- All 3 submissions must be completed before the weekly deadline: **Thursday, 7:00 PM CET**.

**Submission States:**

| State | Description |
| :---- | :---------- |
| **Pending** | Task assigned, not yet submitted |
| **Submitted** | Link provided, awaiting admin verification |
| **Verified** | Link confirmed as valid TikTok URL with correct hashtag |
| **Rejected** | Invalid link or missing hashtag; creator notified to re-submit before deadline |

**Missed Deadline Policy:** Creators who do not submit all 3 videos by the deadline are excluded from that week's session. Their slot is left empty (reducing session below 28 videos) or filled by a backup creator from the waitlist.

#### 3.2.3 Step 3 — Referral System

Each creator receives a **unique referral link/code** upon completing their profile. The referral system serves two purposes: driving fan engagement to their specific videos and tracking creator reach for future incentives.

**Referral Mechanics:**
- Format: `theclearance.ng/ref/[creator_code]` or a short alphanumeric code.
- Fans who join via a referral link are tagged to that creator (tracked internally).
- Creator dashboard shows referral count and fan engagement metrics.
- For MVP, referrals provide **visibility tracking only** — no direct monetary reward is attached.

---

### 3.3 Fan Flow

#### 3.3.1 Step 1 — Session Awareness

After selecting the Fan role, the user lands on the **Session Page**. This page adapts dynamically based on session timing:

| Condition | Display | Action |
| :-------- | :------ | :----- |
| Session is on a future date (>24 hours away) | Session date, time, and brief description | "Add to Google Calendar" button (generates `.ics` or Google Calendar deep link) |
| Session is today but not yet started | Live countdown timer (hours, minutes, seconds) | "Set Reminder" option + countdown display |
| Session is currently live | "Session is LIVE" banner with current round indicator | "Join Now" button (available up to 1 hour after session start) |
| Session has ended | Session results summary and next session date | "View Results" + "Add Next Session to Calendar" |

#### 3.3.2 Step 2 — Session Entry & Deposit

When a fan clicks **"Join Now"**, before entering Game Mode they go through a brief entry flow:

**Entry Flow:**
1. Fan is prompted to **connect their wallet** via Privy (embedded wallet or Phantom).
2. Platform checks the fan's USDC balance.
3. If balance ≥ $3.50 USDC:
   - A clear **entry confirmation screen** is shown: _"Joining this session costs $3.50 USDC, which is added to the reward pool. You may win up to $3.50 USDC back. Your voting accuracy determines your Blind Box tier; a raffle at reveal determines your exact reward."_
   - Fan confirms. $3.50 USDC is deducted from their wallet and added to the **session reward pool**.
   - Fan enters Game Mode.
4. If balance < $3.50 USDC:
   - A **friendly, styled notification** is shown: _"You don't have enough USDC to join this session. You need at least $3.50 USDC. Head to the Mint Page to get some test USDC."_
   - A prominent **"Get USDC →"** button links to the Mint Page.

> **Note:** The $3.50 entry fee is a core mechanic. Gold Box holders have a 10% chance of breaking even ($3.50 back) and a 90% chance of getting $1.75 back. Base Box holders have a 10% chance of getting $1.75 back.

#### 3.3.3 Step 3 — Session Participation (Game Mode)

When the session goes live and entry fee is confirmed, fans enter the **Game Mode** interface.

**Session Structure:**

| Parameter | Value |
| :-------- | :---- |
| Total videos per session | 28 (from ~9–10 creators × 3 videos each, minus no-shows) |
| Round duration | 30 seconds per video |
| Total session duration | ~14 minutes active voting + transitions |
| Late join window | Up to 1 hour after session start |
| Late joiner behaviour | Votes on remaining rounds only |

**Voting Mechanic:**
- Each round, the fan watches a short **TikTok video embed** (TikTok oEmbed API) or thumbnail + link (fallback).
- Fan votes either **Approve (✅)** or **Reject (❌)**.
- If a fan does not vote within 30 seconds, the round is skipped (counted as no vote — neither correct nor incorrect).

**Voting Criteria:**
Fans predict which videos will be selected as winning entries by the platform judges. The platform determines the "correct" outcome after the session based on internal judging criteria: content quality, engagement, creativity, and adherence to task.

#### 3.3.4 Step 4 — Results & Blind Box NFT Rewards

At the end of the session, results are calculated and each participating fan receives one **Blind Box NFT** based on voting accuracy. Earning a tier is only the first step — the actual USDC payout is determined by a **raffle at reveal**:

| Accuracy | Tier Earned | Reveal Outcome (Raffle) | Payout |
| :------- | :---------- | :---------------------- | :----- |
| ≥ 21/28 (75%) | **Gold Blind Box** | 10% chance | $3.50 USDC |
| ≥ 21/28 (75%) | **Gold Blind Box** | 90% chance | $1.75 USDC |
| ≥ 10/28 (36%) | **Base Blind Box** | 10% chance | $1.75 USDC |
| ≥ 10/28 (36%) | **Base Blind Box** | 90% chance | $0 (Participation) |
| < 10/28 | **Participation NFT** | — | $0 |

> Earning a Gold or Base Blind Box does not guarantee a fixed payout. The tier earned determines probabilities — the actual value is revealed when the fan opens their box. This is the core "blind box" mechanic.

The results screen shows a full **accuracy breakdown** and the fan's **Blind Box tier reveal**.

#### 3.3.5 Step 5 — NFT Minting & Management

After results are calculated:

1. Fans are prompted to **mint their Blind Box** as an NFT (wallet must be connected via Privy or Phantom).
2. **Unopened Blind Boxes** can be listed and traded on supported external NFT marketplaces (e.g., Magic Eden).
3. Once **opened ("revealed")**, the NFT:
   - Shows the raffle-determined USDC amount based on the fan's tier.
   - Becomes **soulbound (non-transferable)**.
   - Unlocks the **USDC claim flow** (on-chain SPL token transfer from the treasury).
4. Opened NFTs remain in the user's wallet as permanent proof of participation.

---

### 3.4 Mint Page (Test USDC Faucet)

The platform includes a dedicated **Mint Page** accessible from the main navigation and the insufficient-balance notification. This page allows users to mint test USDC from the platform's fake USDC mint for development/MVP purposes.

**Mint Page Features:**
- Displays the user's current fake USDC balance.
- Shows the **mint address** and **mint authority** for transparency.
- A single **"Mint USDC"** button mints a configurable amount (e.g., 10 USDC) directly to the connected wallet.
- Clear labelling: _"This is test USDC used exclusively within The Clearance platform."_
- Transaction status: pending → confirmed, with a toast notification on success/failure.

---

## 4. Weekly Campaign Cycle

The Clearance operates on a fixed 3-week campaign cycle. Each week follows the same operational cadence:

| Day | Creator Activity | Fan Activity | Admin Activity |
| :-- | :--------------- | :----------- | :------------- |
| **Monday** | Receive 3 new task assignments | View upcoming session; add to calendar | Assign tasks to creators; configure session; fund USDC treasury |
| **Tue–Thu** | Film, post on TikTok, submit links | Browse creator profiles; use referral links | Review submissions; verify links |
| **Thursday 7 PM CET** | Submission deadline | — | Lock submissions; finalize video pool |
| **Saturday** | Watch session results | Pay entry fee; join live session; vote in rounds | Run session; judge videos; trigger results |
| **Sunday** | Review performance metrics | Mint NFTs; trade or reveal rewards | Distribute USDC rewards; prepare next week |

After Week 3, the campaign cycle concludes. A new cycle may begin with a fresh cohort of creators.

---

## 5. Technical Requirements (MVP)

### 5.1 Platform

- **Mobile-first** responsive web application (PWA recommended for MVP).
- No native app required for MVP — browser-based experience.
- Optimized for **low-bandwidth environments** (target market: Nigeria).

### 5.2 Authentication

- MVP: Simple **email/phone capture** + wallet connection via **Privy** for NFT features.
- **No password-based auth** — magic link or OTP-based authentication only.
- **Social login (Google)** as optional enhancement.
- Wallet connection via **Privy** (embedded wallets for non-crypto users) + **Phantom** (for Solana-native users).

### 5.3 Key Integrations

| Integration | Purpose | MVP Priority | Notes |
| :---------- | :------ | :----------- | :---- |
| TikTok oEmbed API | Embed creator videos in voting rounds | **P0 — Critical** | Fallback: thumbnail + external link. Cache embeds. |
| Privy SDK | Wallet connection, embedded wallets, auth | **P0 — Critical** | Handles both non-crypto and native Solana users |
| Phantom Wallet | Native Solana wallet connection | **P0 — Critical** | Via Privy or direct wallet adapter |
| Google Calendar API | Session reminders for fans | **P1 — Important** | `.ics` file as fallback |
| Metaplex Core (Solana) | Blind Box NFT minting, reveal, soulbound logic | **P0 — Critical** | Deploy on Solana (low fees, fast finality) |
| SPL USDC Token (Fake) | Entry fee collection, reward distribution | **P0 — Critical** | Platform-issued fake USDC. Pre-funded treasury per session. |
| WebSockets | Real-time session sync (round timer, votes) | **P0 — Critical** | Required for synchronized 30s countdown across all fans |

### 5.4 Admin Panel (MVP)

- Manage creator applications and task assignments.
- Configure weekly session date and time.
- Review and verify video submissions (mark Verified / Rejected).
- Judge videos post-session (mark Selected / Not Selected).
- Trigger NFT reward distribution to eligible fans.
- Fund USDC treasury wallet before each session.
- View analytics: fan count, entry fee collected, voting stats, referral tracking.

---

## 6. Blockchain & Token Configuration

### 6.1 Chain & Standards

| Parameter | Value |
| :-------- | :---- |
| **Blockchain** | Solana (Devnet for development, Mainnet for production) |
| **NFT Standard** | Metaplex Core |
| **Token Standard** | SPL Token (fake USDC) |
| **Wallet Support** | Privy (embedded) + Phantom |

### 6.2 Fake USDC Configuration

The platform uses a **platform-issued fake USDC token** for the MVP. This is a standard SPL token deployed on Solana Devnet (and later Mainnet) to simulate USDC without real monetary value during development and initial launch.

| Key | Value |
| :-- | :---- |
| **Mint Authority Keypair** | `anchor/keys/usdc-mint-authority.json` |
| **Mint Authority Public Key** | `DYbPcr6TNCbsdwdKZEJQqNUEFthyPZoigrT17MNdJieL` |
| **Mint Address Keypair** | `anchor/keys/usdc-mint-address.json` |
| **Mint Address (Token Address)** | `Gn5mJ41R8PFTP35t1nB2hJW5hqnLFX4WcocA9hBs6c96` |
| **Decimals** | 6 (matching real USDC) |
| **Symbol** | USDC (labelled "Test USDC" in UI) |

> **Security Note:** The mint authority keypair grants the ability to mint unlimited fake USDC. It must be kept secure and never exposed in frontend code. Minting from the Mint Page should be routed through a backend API that holds the authority.

### 6.3 NFT Configuration

| Parameter | Value |
| :-------- | :---- |
| **NFT Program** | Metaplex Core |
| **Blind Box Types** | Gold Blind Box, Base Blind Box, Participation NFT |
| **Soulbound Logic** | Applied on reveal — NFT becomes non-transferable after opening |
| **Reveal Mechanism** | Admin-triggered post-session (MVP). On-chain randomness post-MVP. Reveal applies raffle probabilities per tier: Gold Box — 10% receive $3.50 / 90% receive $1.75; Base Box — 10% receive $1.75 / 90% receive $0. |
| **USDC Distribution** | On-chain SPL token transfer from pre-funded treasury wallet on claim |

### 6.4 Session Economics

| Parameter | Value |
| :-------- | :---- |
| **Fan Entry Fee** | $3.50 USDC per session |
| **Treasury Funding** | Admin pre-loads USDC into the contract treasury before each session |

**Raffle Distribution Table:**

| Tier | Raffle Split | Payout |
| :--- | :----------- | :----- |
| Gold Blind Box | 10% of Gold winners | $3.50 USDC |
| Gold Blind Box | 90% of Gold winners | $1.75 USDC |
| Base Blind Box | 10% of Base winners | $1.75 USDC |
| Base Blind Box | 90% of Base winners | $0 |
| Participation NFT | — | $0 |

**Expected Values:**
- Gold Box: (0.10 × $3.50) + (0.90 × $1.75) = $0.35 + $1.575 = **$1.925**
- Base Box: (0.10 × $1.75) + (0.90 × $0) = **$0.175**

---

## 7. Identified Gaps & Resolutions

| # | Gap | Resolution |
| :- | :-- | :--------- |
| 1 | No user authentication method defined | MVP uses email/phone capture + wallet connection via Privy. No password auth; magic link or OTP. |
| 2 | Voting criteria not specified | Fans predict which videos will be "selected" by judges. Correct = vote matches judge outcome. |
| 3 | No judging mechanism defined | 2–3 internal judges review videos and mark selected/not selected post-session via admin panel. |
| 4 | No reward tier for fans scoring below 10/28 | Participation NFT (no USDC) awarded as proof of attendance. |
| 5 | Missed deadline handling for creators | Creator excluded from session; slot left empty or filled from waitlist. |
| 6 | Blockchain and wallet specifics not defined | Solana chain. Metaplex Core for Blind Box NFTs. Privy embedded wallets + Phantom. |
| 7 | Session day/time not specified | Saturdays for live sessions. Exact time configurable by admin. Thursday 7 PM CET is the submission deadline. |
| 8 | No admin panel defined | Admin panel required for task assignment, submission review, judging, session management, and reward distribution. |
| 9 | Creator count per session not specified | ~9–10 creators per session (28 videos / 3 per creator). Configurable by admin. |
| 10 | No USDC funding/treasury model | Pre-funded reward pool per session. Admin loads fake USDC into contract before session. |
| 11 | Fan entry mechanism not defined | Fans pay $3.50 USDC on session join. Fee added to reward pool. Insufficient balance triggers a friendly notification with a link to the Mint Page. |
| 12 | Test USDC token not defined | Platform-issued fake USDC on Solana. Mint Authority: `DYbPcr6TNCbsdwdKZEJQqNUEFthyPZoigrT17MNdJieL`. Mint Address: `Gn5mJ41R8PFTP35t1nB2hJW5hqnLFX4WcocA9hBs6c96`. Keys stored in `anchor/keys/`. |
| 13 | No faucet for fans to obtain test USDC | Mint Page added: a dedicated UI where fans can mint test USDC directly to their connected wallet. |
| 14 | Pool reward distribution method not defined | Raffle-within-tier mechanic. Gold Box: 10% get $3.50 / 90% get $1.75. Base Box: 10% get $1.75 / 90% get $0. |

---

## 8. MVP Development Milestones (3-Week Cycle)

The following milestone plan assumes a team of 2–3 developers (1 frontend, 1 backend, 1 blockchain/smart contract) with a designer available for Week 1. Scope is strictly MVP — features marked "post-MVP" are deferred.

### Week 1 — Foundation & Core Infrastructure (Days 1–7)

| Track | Deliverables | Owner |
| :---- | :----------- | :---- |
| **Design** | Complete UI/UX for: role selection screen, creator onboarding form, fan session page (all 4 states), session entry/deposit screen, voting round interface, results screen, mint page. Deliver Figma file. | Designer |
| **Frontend** | Project setup (Next.js + TailwindCSS). Role selection page. Creator profile setup form with validation. Fan session page with all 4 timing states, countdown timer, and Google Calendar integration (.ics fallback). | Frontend Dev |
| **Backend** | Project setup (Node.js + Express or equivalent). Database schema design and setup (PostgreSQL / Supabase). API endpoints: user registration, role assignment, creator profile CRUD, task assignment CRUD. Admin panel scaffold: task management and creator management views. | Backend Dev |
| **Blockchain** | Initialize fake USDC SPL token using pre-generated mint authority and mint address keypairs. Deploy token on Devnet. Smart contract: Blind Box NFT (Metaplex Core) with mint, reveal, and soulbound logic. USDC integration for entry fee collection and reward claims. Deploy to Devnet. Unit tests. | Blockchain Dev |

**Week 1 Exit Criteria:** Creator can sign up, complete profile, and view assigned tasks. Fan can visit session page and see countdown. Fake USDC token deployed on Devnet. Smart contract deployed to Devnet with passing tests.

---

### Week 2 — Core Game Loop & Voting Engine (Days 8–14)

| Track | Deliverables | Owner |
| :---- | :----------- | :---- |
| **Frontend** | Creator dashboard: task list, submission form (TikTok URL input + validation), submission status tracker. Referral link display and copy-to-clipboard. **Mint Page**: displays USDC balance, mint button, transaction status. Fan game mode: session entry screen with $3.50 fee confirmation + insufficient balance notification. 30-second voting round UI, TikTok oEmbed video embed, approve/reject buttons, round progress bar. Results screen with accuracy breakdown and Blind Box tier reveal. | Frontend Dev |
| **Backend** | Video submission endpoints with URL validation. Referral code generation and tracking. USDC entry fee verification and pool tracking. Session engine: round timer management (WebSocket-based), vote recording, late-join logic. Voting results calculation engine (compare fan votes to judge outcomes). Admin panel: submission review/verification, session configuration, judging interface, treasury management view. | Backend Dev |
| **Blockchain** | Frontend wallet connection via Privy (embedded wallets for non-crypto users) and Phantom (Solana-native). Mint Page backend API for minting fake USDC (uses mint authority keypair server-side). Entry fee transfer logic ($3.50 USDC from fan wallet to session treasury). Blind Box NFT mint function integration with backend results. Reveal mechanism (admin-triggered). USDC claim flow for fans post-reveal. Deploy to Devnet (full flow). | Blockchain Dev |

**Week 2 Exit Criteria:** End-to-end flow works on staging: creator submits videos, admin judges, fan pays entry fee (with balance check), fan votes in real-time, results calculate correctly, NFT minting functional on Devnet, USDC claim works.

---

### Week 3 — Integration, Polish & Launch (Days 15–21)

| Track | Deliverables | Owner |
| :---- | :----------- | :---- |
| **Frontend** | NFT minting and reveal flow UI. Wallet connection onboarding for non-crypto users (Privy guided flow). Mint Page final polish. Final UI polish: loading states, error handling, empty states, mobile responsiveness audit. End-to-end smoke testing across all user paths. | Frontend Dev |
| **Backend** | Full integration testing (creator flow, fan flow, admin flow). Performance optimization for concurrent users during live sessions. Session replay / results persistence. Notification system (email or push for session reminders and results). Security audit: input sanitization, rate limiting, API auth. | Backend Dev |
| **Blockchain** | Smart contract audit (internal review or automated tools). Mainnet deployment (fake USDC token + Blind Box NFT contract). Gas fee estimation and optimization. Fallback mechanisms for failed transactions. Verify soulbound logic on mainnet. | Blockchain Dev |
| **QA / Launch** | User acceptance testing with 3–5 test creators and 10–15 test fans. Bug fixes and final adjustments. Staging-to-production deployment. Launch Day: Week 1 Session go-live. | All |

**Week 3 Exit Criteria:** Platform is live on production. First cohort of creators onboarded. Session 1 configured and ready for Saturday go-live. NFT minting and USDC claims work on mainnet. Mint Page functional for fans.

---

## 9. Key Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
| :--- | :----- | :--------- | :--------- |
| TikTok API rate limits or embed restrictions | High — breaks core voting UX | Medium | Fallback to thumbnail + external link. Cache embeds server-side. |
| Low crypto literacy among target users | High — blocks NFT claims and entry fee | High | Privy embedded wallets remove the need for external wallet setup. In-app wallet setup guide. Mint Page provides easy access to test USDC. |
| Insufficient creator submissions | Medium — reduces session quality | Medium | Maintain creator waitlist. Admin can adjust video count per session. |
| Gas fee spikes on Solana | Low — minimal due to Solana's low fees | Low | Platform covers gas for NFT minting. Batch where possible. |
| Concurrent user load during live session | High — platform downtime | Medium | Load testing in Week 3. Use WebSockets. CDN for static assets. |
| Fan has insufficient USDC to enter session | Medium — fan friction and drop-off | High | Clear insufficient balance notification with a direct link to the Mint Page. |
| Fake USDC mint authority key exposure | High — unlimited minting possible | Low | Mint authority keypair kept server-side only. Never exposed in frontend. Backend API proxies all minting requests. |

---

## 10. MVP Success Metrics

| Metric | Target (per session) | Measurement |
| :----- | :------------------- | :---------- |
| Creator submission rate | 80%+ of creators submit all 3 videos | Submissions / Assigned tasks |
| Fan participation | 50+ active voters per session | Unique voters per session |
| Session completion rate | 70%+ of fans vote in all rounds | Fans completing all rounds / Total fans |
| NFT mint rate | 60%+ of eligible fans mint their NFT | Minted NFTs / Eligible fans |
| USDC claim rate | 50%+ of eligible fans claim their USDC | Claims / Eligible fans |
| Week-over-week retention | 40%+ fans return for next session | Returning fans / Previous session fans |

---

## 11. Out of Scope (Post-MVP)

The following features are explicitly deferred:

- Native mobile apps (iOS / Android)
- Automated TikTok verification (scraping or API-based hashtag/link validation)
- Built-in secondary NFT marketplace
- Advanced analytics dashboard for creators
- Multi-language support
- Automated task generation (AI-based)
- Tokenomics and governance token
- Debt repayment tracking or direct payment integrations
- On-chain randomness for Blind Box reveal
- Real USDC (replacing fake/test USDC)

---

*End of Document — The Clearance PRD v1.1*
