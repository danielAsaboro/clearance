  
**THE CLEARANCE**

Product Requirements Document (PRD)

MVP Stage — 3-Week Development Cycle

Version 1.0  |  February 2026

Status: Draft for Review

| Prepared by: | Daniel Asaboro |
| :---- | :---- |
| **Client:** | Chuks |

# **1\. Executive Summary**

The Clearance is a gamified, social-impact web application targeting the Nigerian market. It connects debt-burdened content creators with engaged fans through weekly interactive sessions. Creators produce TikTok content tied to platform-assigned tasks, and fans participate in live voting sessions where their accuracy earns them Blind Box NFT rewards with real USDC value.

The platform runs for a fixed 3-week campaign cycle. Each week features one live session with 28 creator videos, 30-second voting rounds, and NFT-based reward distribution.

# **2\. Product Overview**

## **2.1 Problem Statement**

Many Nigerian content creators carry personal debt from various sources (betting, medical emergencies, business failures) and lack structured paths to monetize their content for debt relief. Meanwhile, audiences who want to support creators have no engaging mechanism to do so beyond passive viewership.

## **2.2 Solution**

The Clearance bridges this gap by creating a structured, time-bound campaign where creators complete content tasks for visibility and debt relief consideration, while fans engage in gamified voting sessions that reward accuracy with tradable NFT assets.

## **2.3 Target Audience**

* Creators: Nigerian TikTok content creators aged 18–35, carrying personal debt, willing to produce content for the platform.

* Fans: Nigerian social media users aged 16–40, interested in interactive entertainment, NFTs, and supporting creators.

## **2.4 Core Value Propositions**

| For Creators | For Fans |
| :---- | :---- |
| Structured path to earn debt relief through content creation | Free-to-participate gamified voting experience |
| Amplified reach via the \#theclearanceNG hashtag campaign | Earn Blind Box NFTs with real USDC value based on voting accuracy |
| Referral tools to mobilize fan support | Tradable NFT assets (unopened blind boxes) |

# **3\. User Roles & Detailed Flows**

## **3.1 Entry Point (All Users)**

On app launch, the user is presented with a role selection screen. This is a one-time, irreversible choice for the duration of the campaign cycle. The two paths are Creator and Fan. Upon selection, the user is redirected to the corresponding onboarding experience. No account creation or login is required at this stage for MVP; identification is handled via wallet connection or a simple username/email capture.

## **3.2 Creator Flow**

### **3.2.1 Step 1 — Profile Setup**

Creators complete a mandatory onboarding form before accessing the platform. The form collects the following:

| Field | Type / Options | Notes |
| :---- | :---- | :---- |
| Source of Debt | Multi-select: Betting, Emergency, Medical, Business, None | Required. Used for creator profiling and storytelling context. "None" option for creators without debt who still want to participate. |
| Willingness Declaration | Binary: Yes / No | Required. Confirms creator is willing to complete any legal task assigned. Selecting "No" should trigger a confirmation modal explaining limited task options. |
| TikTok Username | Text input (validated format: @username) | Required. Must be a valid, publicly accessible TikTok profile. Platform should verify the handle format on submit. |
| Disclaimer / Consent | Checkbox acceptance | Required. Creator grants the platform full ownership of submitted video content and permission to use, distribute, and modify it. Must include link to full legal terms. |
| Display Name | Text input | Required. The name shown to fans during voting sessions. |
| Profile Photo | Image upload (max 2MB, JPG/PNG) | Optional for MVP. Default avatar assigned if skipped. |

### **3.2.2 Step 2 — Task Assignment**

Upon completing profile setup, each creator receives exactly 3 content tasks for the current week. Tasks are assigned by the platform admin (or auto-assigned from a task pool in future iterations).

**Task Requirements:**

* Each task must be filmed and posted as a TikTok video on the creator’s own account.

* Every video must include the hashtag \#theclearanceNG in the caption.

* The creator must submit the TikTok video URL inside the platform via a submission form.

* All 3 submissions must be completed before the weekly deadline: Thursday, 7:00 PM CET.

**Submission States:**

* Pending — Task assigned, not yet submitted.

* Submitted — Link provided, awaiting verification.

* Verified — Link confirmed as valid TikTok URL with correct hashtag.

* Rejected — Invalid link or missing hashtag; creator notified to re-submit before deadline.

**Missing Gap (Filled):** What happens if a creator misses the deadline? For MVP, creators who do not submit all 3 videos by the deadline are excluded from that week’s session. Their slot is left empty (reducing the session to fewer than 28 videos) or filled by a backup creator from a waitlist.

### **3.2.3 Step 3 — Referral System**

Each creator receives a unique referral link/code upon completing their profile. The referral system serves two purposes: driving fan engagement to their specific videos during the session, and tracking creator reach for potential future incentives.

**Referral Mechanics:**

* Format: theclearance.ng/ref/\[creator\_code\] or a short alphanumeric code.

* Fans who join via a referral link are tagged to that creator (tracked internally).

* Creator dashboard shows referral count and fan engagement metrics.

* For MVP, referrals provide visibility tracking only — no direct monetary reward is attached.

## **3.3 Fan Flow**

### **3.3.1 Step 1 — Session Awareness**

After selecting the Fan path, the user lands on the Session Page. This page adapts dynamically based on timing:

| Condition | Display | Action |
| :---- | :---- | :---- |
| Session is on a future date (more than 24 hours away) | Session date, time, and brief description of the upcoming session | "Add to Google Calendar" button (generates .ics or Google Calendar deep link) |
| Session is today but not yet started | Live countdown timer (hours, minutes, seconds) to session start | "Set Reminder" option \+ countdown display |
| Session is currently live | "Session is LIVE" banner with current round indicator | "Join Now" button (available up to 1 hour after session start) |
| Session has ended | Session results summary and next session date | "View Results" \+ "Add Next Session to Calendar" |

*No payment is required to participate as a fan. The experience is entirely free.*

### **3.3.2 Step 2 — Session Participation (Game Mode)**

When the session goes live, fans enter the Game Mode interface. This is the core engagement loop:

**Session Structure:**

* Total videos per session: 28 (from \~9–10 creators, 3 videos each, minus any no-shows).

* Round duration: 30 seconds per video.

* Total session duration: approximately 14 minutes of active voting \+ transition time between rounds.

* Voting mechanic: Each round, the fan watches a short TikTok video embed (or thumbnail \+ link) and votes either Approve (✅) or Reject (❌). \[TODO: double-tap to like, makes it easier to use….\]

* Late join window: Fans can join up to 1 hour after the session begins. Late joiners vote only on remaining rounds.

**Voting Criteria:**

For MVP, fans vote on whether they believe each video will be selected as a winning entry by the platform judges. This creates a prediction-game dynamic. The platform determines the “correct” outcome after the session based on internal judging criteria (content quality, engagement, creativity, adherence to task). \[TODO: more likes is just the deciding factor\]

### **3.3.3 Step 3 — Results & Blind Box NFT Rewards**

At the end of the session, each participating fan receives one Blind Box NFT. The tier of the Blind Box depends on voting accuracy:

| Accuracy Threshold | Reward Tier | Minimum Value |
| :---- | :---- | :---- |
| Correct votes on 10 out of 28 videos (\~36%) | Base Blind Box | **$1.75 USDC** |
| Correct votes on 21 out of 28 videos (75%) | Gold Blind Box | **$3.50 USDC** |
| Below 10 correct votes | Participation NFT (no monetary value) | $0 — Proof of participation only |

**Missing Gap (Filled) — Below-threshold fans:**

The original spec only covered 10/28 and 21/28 tiers. Fans who score below 10 correct votes receive a Participation NFT with no USDC value, serving as proof of attendance and encouraging return participation.

![][image1]

### **3.3.4 Step 4 — NFT Minting & Management**

After the session ends and results are calculated:

1. Fans are prompted to mint their Blind Box as an NFT (requires wallet connection).

2. Unopened Blind Boxes can be traded on supported NFT marketplaces.

3. Once opened ("revealed"), the NFT shows the reward amount, becomes non-tradable (soulbound), and USDC is claimable.

4. Opened NFTs remain in the user’s wallet as proof of participation.

**Missing Gap (Filled) — Wallet & Blockchain:**

For MVP, the platform supports wallet connection via Privy (embedded wallets for non-crypto-native users + Phantom for Solana-native users). NFTs are minted on Solana using Metaplex Core to minimize fees. USDC claims are processed as on-chain SPL token transfers.

# **4\. Weekly Campaign Cycle**

The Clearance operates on a fixed 3-week campaign cycle. Each week follows the same operational cadence:

| Day | Creator Activity | Fan Activity | Admin Activity |
| :---- | :---- | :---- | :---- |
| **Monday** | Receive new task assignments (3 tasks) | View upcoming session; add to calendar | Assign tasks to creators; configure session |
| **Tue–Thu** | Film, post on TikTok, submit links | Browse creator profiles; use referral links | Review submissions; verify links |
| **Thursday 7 PM** | Submission deadline | — | Lock submissions; finalize video pool |
| **Saturday** | Watch session results | Join live session; vote in rounds | Run session; judge videos; trigger results |
| **Sunday** | Review performance metrics | Mint NFTs; trade or reveal rewards | Distribute rewards; prepare next week |

After Week 3, the campaign cycle concludes. A new cycle may begin with a fresh cohort of creators.

# **5\. Technical Requirements (MVP)**

## **5.1 Platform**

* Mobile-first responsive web application (PWA recommended for MVP).

* No native app required for MVP — browser-based experience.

* Optimized for low-bandwidth environments (target: Nigeria).

## **5.2 Authentication**

* MVP: Simple email/phone capture \+ wallet connection for NFT features.

* Social login (Google) as optional enhancement.

* No password-based auth for MVP — magic link or OTP-based.

## **5.3 Key Integrations**

| Integration | Purpose | MVP Priority | Notes |
| :---- | :---- | :---- | :---- |
| TikTok oEmbed API | Embed creator videos in voting rounds | P0 — Critical | Fallback: thumbnail \+ external link |
| Privy / Solana Web3 SDK | NFT minting and USDC claims | P0 — Critical | Privy embedded wallets \+ Phantom support |
| Google Calendar API | Session reminders for fans | P1 — Important | Can use .ics file as fallback |
| Metaplex Core (Solana) | Blind Box NFT minting, reveal, soulbound logic | P0 — Critical | Deploy on Solana (low fees, fast finality) |
| SPL USDC Token | Reward distribution | P0 — Critical | Pre-funded treasury wallet per session |

## **5.4 Admin Panel (MVP)**

* Manage creator applications and task assignments.

* Configure weekly session date/time.

* Review and verify video submissions.

* Judge videos during/after sessions (mark selected/not selected).

* Trigger NFT reward distribution.

* View analytics: fan count, voting stats, referral tracking.

# **6\. Identified Gaps & Resolutions**

The following gaps were identified in the original specification and have been addressed in this document:

| \# | Gap | Resolution |
| :---- | :---- | :---- |
| 1 | No user authentication method defined | MVP uses email/phone \+ wallet connection. No password auth; magic link or OTP. |
| 2 | Voting criteria not specified (what are fans voting on?) | Fans predict which videos will be "selected" by judges. Correct \= vote matches judge outcome. |
| 3 | No judging mechanism defined | 2–3 internal judges review videos and mark selected/not selected post-session. |
| 4 | No reward tier for fans scoring below 10/28 | Participation NFT (no USDC) awarded as proof of attendance. |
| 5 | Missed deadline handling for creators | Creator excluded from session; slot left empty or filled from waitlist. |
| 6 | Blockchain and wallet specifics not defined | Solana chain. Metaplex Core for Blind Box NFTs. Privy embedded wallets \+ Phantom. |
| 7 | Session day/time not specified | Saturdays proposed as session day. Exact time TBD by client. Thursday 7 PM CET is submission deadline. |
| 8 | No admin panel defined | Admin panel required for task assignment, submission review, judging, and session management. |
| 9 | Creator count per session not specified | \~9–10 creators per session (28 videos / 3 per creator). Exact number configurable by admin. |
| 10 | No USDC funding/treasury model | Pre-funded reward pool per session. Admin loads USDC into contract before session. |

# **7\. MVP Development Milestones (3-Week Cycle)**

The following milestone plan assumes a team of 2–3 developers (1 frontend, 1 backend, 1 blockchain/smart contract) with a designer available for Week 1\. Scope is strictly MVP — features marked "post-MVP" should be deferred.

## **Week 1: Foundation & Core Infrastructure (Days 1–7)**

| Track | Deliverables | Owner |
| :---- | :---- | :---- |
| **Design** | Complete UI/UX for: role selection screen, creator onboarding form, fan session page (all 4 states), voting round interface, results screen. Deliver Figma file or equivalent. | Designer |
| **Frontend** | Project setup (Next.js / React \+ TailwindCSS). Role selection page. Creator profile setup form with validation. Fan session page with countdown timer and Google Calendar integration (.ics fallback). | Frontend Dev |
| **Backend** | Project setup (Node.js \+ Express or equivalent). Database schema design and setup (PostgreSQL / Supabase). API endpoints: user registration, role assignment, creator profile CRUD, task assignment CRUD. Admin panel scaffold: task management and creator management views. | Backend Dev |
| **Blockchain** | Smart contract development: ERC-1155 Blind Box NFT with mint, reveal, and soulbound logic. USDC integration for reward claims. Deploy to testnet. Write unit tests. | Blockchain Dev |

**Week 1 Exit Criteria:** Creator can sign up, complete profile, and view assigned tasks. Fan can visit session page and see countdown. Smart contract deployed to testnet with passing tests.

## **Week 2: Core Game Loop & Voting Engine (Days 8–14)**

| Track | Deliverables | Owner |
| :---- | :---- | :---- |
| **Frontend** | Creator dashboard: task list, submission form (TikTok URL input \+ validation), submission status tracker. Referral link display and copy-to-clipboard. Fan game mode: 30-second voting round UI, video embed (TikTok oEmbed), approve/reject buttons, round progress bar. Results screen with accuracy breakdown and Blind Box tier reveal. | Frontend Dev |
| **Backend** | Video submission endpoints with URL validation. Referral code generation and tracking. Session engine: round timer management, vote recording, late-join logic. Voting results calculation engine (compare fan votes to judge outcomes). Admin panel: submission review/verification, session configuration, judging interface. | Backend Dev |
| **Blockchain** | Frontend wallet connection (MetaMask \+ WalletConnect). Mint function integration with backend results. Reveal mechanism (on-chain randomness or admin-triggered). USDC claim flow. Deploy to mainnet (or testnet for MVP demo). | Blockchain Dev |

**Week 2 Exit Criteria:** End-to-end flow works on staging: creator submits videos, admin judges, fan votes in real-time, results calculate correctly, and NFT minting is functional on testnet.

## **Week 3: Integration, Polish & Launch (Days 15–21)**

| Track | Deliverables | Owner |
| :---- | :---- | :---- |
| **Frontend** | NFT minting and reveal flow UI. Wallet connection onboarding for non-crypto users. Final UI polish: loading states, error handling, empty states, mobile responsiveness audit. End-to-end smoke testing across all user paths. | Frontend Dev |
| **Backend** | Full integration testing (creator flow, fan flow, admin flow). Performance optimization for concurrent users during live sessions. Session replay / results persistence. Notification system (email or push for session reminders and results). Security audit: input sanitization, rate limiting, API auth. | Backend Dev |
| **Blockchain** | Smart contract audit (internal review or automated tools). Mainnet deployment. Gas fee estimation and optimization. Fallback mechanisms for failed transactions. | Blockchain Dev |
| **QA / Launch** | User acceptance testing with 3–5 test creators and 10–15 test fans. Bug fixes and final adjustments. Staging-to-production deployment. Launch Day: Week 1 Session go-live. | All |

**Week 3 Exit Criteria:** Platform is live on production. First cohort of creators has been onboarded. Session 1 is configured and ready for Saturday go-live. NFT minting works on mainnet.

# **8\. Key Risks & Mitigations**

| Risk | Impact | Likelihood | Mitigation |
| :---- | :---- | :---- | :---- |
| TikTok API rate limits or embed restrictions | High — Breaks core voting UX | Medium | Fallback to thumbnail \+ external link. Cache embeds. |
| Low crypto literacy among target users | High — Blocks NFT claims | High | Offer custodial wallet. In-app wallet setup guide. |
| Insufficient creator submissions | Medium — Reduces session quality | Medium | Maintain waitlist. Allow admin to adjust video count. |
| Gas fees spike on chosen chain | Medium — Erodes reward value | Low | Use L2 (Base/Polygon). Batch minting. Platform covers gas. |
| Concurrent user load during live session | High — Platform downtime | Medium | Load testing in Week 3\. Use WebSockets. CDN for static assets. |

# **9\. MVP Success Metrics**

| Metric | Target (per session) | Measurement |
| :---- | :---- | :---- |
| Creator submission rate | 80%+ of creators submit all 3 videos | Submissions / Assigned tasks |
| Fan participation | 50+ active voters per session | Unique voters per session |
| Session completion rate | 70%+ of fans vote in all rounds | Fans completing all rounds / Total fans |
| NFT mint rate | 60%+ of eligible fans mint their NFT | Minted NFTs / Eligible fans |
| Week-over-week retention | 40%+ fans return for next session | Returning fans / Previous session fans |

# **10\. Out of Scope (Post-MVP)**

The following features are explicitly deferred to post-MVP iterations:

* Native mobile apps (iOS / Android).

* Automated TikTok verification (scraping or API-based hashtag/link validation).

* Secondary NFT marketplace (built-in trading).

* Advanced analytics dashboard for creators.

* Multi-language support.

* Automated task generation (AI-based).

* Tokenomics and governance token.

* Debt repayment tracking or direct payment integrations.

*End of Document*

[image1]: <data:image/png;base64,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>