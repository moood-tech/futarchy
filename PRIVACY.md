# Privacy — the anonymity invariant

This POC is built around one non-negotiable property:

> **No sentiment response is ever stored against an individual. Anywhere.**

Sentiment is **aggregate-only by design**. This is a core property of the protocol, not a
shortcut taken for the POC. The real system must preserve it.

## What this means concretely

- **The open contribution API** (`POST /api/contribute`) folds each contribution's value into a
  running per-group aggregate **the instant it arrives, and then discards it**. There is no table,
  map, log line, or field that ties a contribution to a person, a device, a session, or an IP.
  See `server/src/sentiment.ts` — the accumulators (`noneValueSum`, `noneWeightSum`,
  `verValueSum`, `verCount`) are pure aggregates.

- **The wellbeing index** (`SentimentIndex`) is a series of aggregate numbers per date. There is no
  per-user sentiment history, and there is no way to reconstruct one from the stored data.

- **The current-sentiment pulse** (`POST /api/proposals/:id/pulse`) only ever increments two
  aggregate counters — `positive` and `negative`. A single swipe moves a count; no individual
  response row is written. See the code comment at the pulse handler.

- **Anonymity ≠ uniqueness.** A contribution may carry a mock verification token to earn a higher
  *trust weight* and count toward the `verified` threshold. Verifying that a contributor is a real,
  unique person is deliberately separated from knowing *who* they are — the token is validated and
  then thrown away with the rest of the contribution. Real proof-of-personhood providers plug in at
  `verifyToken()` and must uphold the same discard rule.

## The one place per-actor data exists — and why it's fine

The **play-money market** keeps `Player`s and `Trade`s. A "player" is a `localStorage` session
handle (a nickname like `sable-144`) that exists purely to run the play-money leaderboard. It is
**not** a real identity, carries no personal data, and is entirely separate from the sentiment
system. Nothing links a player to any sentiment contribution.

## How to check

Grep the server for anything that would associate sentiment with a person — you won't find it:

```bash
# no user/person id is ever attached to a contribution or pulse
grep -rn "userId\|user_id\|personId\|deviceId\|ip" server/src
```

The only identifiers in the codebase are `playerId` (the play-money nickname) and `groupId` /
`proposalId` / `marketId` (which are not people).
