# Artifact Roll Simulator — NINU Gaming

A one-page React app for YouTube viewers to roll for Arlecchino damage stats, see them ranked on a live shared leaderboard, and watch other viewers' rolls arrive in real time. The shared backend is Firebase Realtime Database.

## Leaderboard behavior

Every player name maps to one deterministic Firebase user ID. The ID is derived from the trimmed, lowercase version of the name, so the same name always maps to the same leaderboard record and capitalization does not create a second player.

A player can roll unlimited times, but the leaderboard stores only that player's **highest Melt Damage score**. A lower or equal score never replaces the saved best score. Concurrent rolls from the same player are protected with a Firebase transaction, so two tabs cannot race and accidentally overwrite a better score.

The observer feed is separate: it can still show recent rolls even when a roll does not beat the player's leaderboard record.

The leaderboard listener requests the highest 200 scores in real time, while the observer feed listens to the latest 30 rolls by timestamp.

## What's inside

- `src/utils/artifactData.js` — realistic artifact rules for all 5 slots.
- `src/utils/artifactRoller.js` — rolls a full 5-piece set and aggregates totals.
- `src/utils/damageCalculator.js` — physical + melt damage formulas.
- `src/utils/rarityBadge.js` — melt damage → rarity tier.
- `src/utils/firebaseService.js` — Firebase connection, username IDs, realtime subscriptions, and highest-score transactions.
- `src/hooks/useLeaderboard.js` — realtime leaderboard state, duplicate-name cleanup, and optimistic UI reconciliation.
- `src/hooks/useObserverFeed.js` — derives the last 60 seconds / max 10 visible live feed.
- `src/components/Desktop.jsx` / `Mobile.jsx` — responsive layouts.

## Realistic artifact rules (per slot)

| Slot | Main stat | Possible substats |
|---|---|---|
| **Flower of Life** | Always flat HP | 4 of the other 9 |
| **Plume of Death** (Feather) | Always flat ATK | 4 of the other 9 |
| **Sands of Eon** | Random: HP%, ATK%, DEF%, Elemental Mastery, or Energy Recharge | 4 of the remaining 9 |
| **Goblet of Eonothem** | Random: HP%, ATK%, DEF%, Elemental Mastery, **Pyro DMG%**, or Physical DMG% | 4 of the remaining 9 |
| **Circlet of Logos** | Random: HP%, ATK%, DEF%, Elemental Mastery, **CRIT Rate**, **CRIT DMG**, or Healing Bonus | 4 of the remaining 9 |

A stat cannot be both the main stat and a substat on the same piece. Elemental/Physical DMG% and Healing Bonus are main-stat-only.

## Firebase setup

The browser Firebase configuration is stored in `src/utils/firebaseService.js` using the Firebase project supplied for this app. No Firebase Admin SDK credential is used.

### Realtime Database rules

The repository contains `database.rules.json`. In the Firebase Console, open **Realtime Database → Rules**, replace the existing rules with the contents of `database.rules.json`, and click **Publish**.

The rules allow public reads, validate leaderboard entries, require the Firebase key/id to match the generated user ID, allow a leaderboard record to change only when the new score is higher, and index the score/timestamp queries.

## Why the leaderboard no longer duplicates users

The old implementation created a fresh random leaderboard ID for every roll. The current implementation instead uses:

`leaderboard/{deterministicUserId}`

The deterministic ID is derived from the player's name. When that same player rolls again, Firebase updates the same record only if the new Melt Damage is strictly higher.

For example, these all refer to the same user:

```text
Ninu
ninu
NINU
```

The displayed name from the winning roll is retained in the leaderboard record.

## Why Firebase replaced JSONBin

The previous implementation repeatedly downloaded and rewrote one large JSON document. Firebase Realtime Database now pushes changes to connected viewers, stores users individually, and uses transactions for the one-user/highest-score rule.

## Local setup

```bash
npm install
npm run dev
```

Then open the Vite URL printed in the terminal.

## Production build

```bash
npm run build
```

No JSONBin environment variables are required anymore. You no longer need `VITE_JSONBIN_ID`, `VITE_JSONBIN_KEY`, or `VITE_FETCH_INTERVAL`.

## Deploying to Vercel

Import `NinuGaming999/NinuGaning_game` into Vercel and deploy it as a Vite project. No Firebase secret or GitHub token needs to be added to Vercel for the current client-side Firebase configuration.

After deploying, make sure the Firebase Realtime Database rules from `database.rules.json` are published in the Firebase Console.

## Notes on game-math assumptions

The build brief's mockup numbers only make sense if artifact CRIT Rate/CRIT DMG/Pyro DMG bonuses are added on top of the character's base stats (20% / 50% / 28.8%). That is how this build treats them.

DEF and HP substats are cosmetic only, exactly as the original spec requested.
