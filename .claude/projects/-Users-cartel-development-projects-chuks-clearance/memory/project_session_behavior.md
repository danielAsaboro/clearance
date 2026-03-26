---
name: Session replay behavior
description: All sessions (including samples) should be treated the same — one play per user, no special-casing samples
type: project
---

Sessions are played asynchronously by different users. Sample sessions should not be treated differently from regular sessions — all the same rules apply (e.g., one-play-per-user restriction).

**Why:** The user explicitly stated "don't exclude samples from replays; it should work like every session."

**How to apply:** Never special-case `isSample` or `isReplay` when applying session participation rules. All sessions follow the same flow.
