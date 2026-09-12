# Artifact Roll Simulator — NINU Gaming

A one-page React app for YouTube viewers to roll for Arlecchino damage stats, see them ranked on a live, shared leaderboard, and watch other viewers' rolls come in in real time. The shared backend is Firebase Realtime Database.

## What's inside

- `src/utils/artifactData.js` — realistic artifact rules for all 5 slots.
- `src/utils/artifactRoller.js` — rolls a full 5-piece set and aggregates totals.
- `src/utils/damageCalculator.js` — physical + melt damage formulas.
- `src/utils/rarityBadge.js` — melt damage → rarity tier.
- `src/utils/firebaseService.js` — Firebase Realtime Database connection, realtime subscriptions, and atomic writes.
- `src/hooks/useLeaderboard.js` — listens for Firebase push updates instead of polling.
- `src/hooks/useObserverFeed.js` — derives the last 60 seconds / max 10 live feed.
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

The app is already configured for the Firebase project used by this repository. The browser Firebase configuration is stored in `src/utils/firebaseService.js`; these web configuration values identify the Firebase project and are not Firebase Admin credentials.

### Realtime Database rules

The repository contains `database.rules.json`. In the Firebase Console, open **Realtime Database → Rules**, replace the existing rules with the contents of `database.rules.json`, and click **Publish**.

The rules allow public reads and new roll creation while rejecting overwrites and enforcing basic data shape/range checks. This is intentionally a simple public leaderboard; the client-side damage calculation is not treated as a cryptographic anti-cheat system.

## Why Firebase replaced JSONBin

The previous implementation repeatedly downloaded the entire JSONBin document and then performed read-modify-write updates. With many viewers, that created unnecessary request traffic and concurrent writes could overwrite one another.

Firebase Realtime Database now:

- pushes changes to connected viewers instead of polling every few seconds;
- stores leaderboard entries individually instead of rewriting one giant document;
- uses an atomic multi-location write for each roll, so simultaneous users do not overwrite each other's rolls;
- keeps the observer feed and leaderboard as separate realtime collections.

The old `src/utils/jsonbinService.js` is no longer used by the application.

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

No JSONBin environment variables are required anymore. In particular, you no longer need `VITE_JSONBIN_ID`, `VITE_JSONBIN_KEY`, or `VITE_FETCH_INTERVAL`.

## Deploying to Vercel

Import `NinuGaming999/NinuGaning_game` into Vercel and deploy it as a Vite project. No Firebase secret or GitHub token needs to be added to Vercel for the current client-side Firebase configuration.

After deploying, make sure the Firebase Realtime Database rules from `database.rules.json` have been published in the Firebase Console.

## Notes on game-math assumptions

The build brief's mockup numbers only make sense if artifact CRIT Rate/CRIT DMG/Pyro DMG bonuses are added on top of the character's base stats (20% / 50% / 28.8%). That is how this build treats them.

DEF and HP substats are cosmetic only, exactly as the original spec requested.
