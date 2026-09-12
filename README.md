# Artifact Roll Simulator — NINU Gaming

A one-page React app for YouTube viewers to roll for Arlecchino damage stats,
see them ranked on a live, shared leaderboard, and watch other viewers'
rolls come in in real time. No accounts, no backend to run — just a static
site + a free JSONBin.io bin as the shared data store.

## What's inside

- `src/utils/artifactData.js` — the realistic artifact rules: which main
  stats each of the 5 slots can roll, the fixed max-level main stat values,
  and the 10-stat substat pool with per-roll ranges.
- `src/utils/artifactRoller.js` — rolls a full 5-piece set (Flower, Feather,
  Sands, Goblet, Circlet) following those slot-specific rules, then
  aggregates all 5 pieces into one totals object.
- `src/utils/damageCalculator.js` — the damage formulas (physical hit +
  melt damage), fed by the aggregated artifact totals. Total ATK, CRIT
  Rate/DMG, and Pyro DMG bonus all now genuinely depend on what rolled.
- `src/utils/rarityBadge.js` — melt damage → rarity tier + color/emoji.
  Thresholds were recalibrated against a 200k-roll simulation of the real
  system (see comments in the file).

## Realistic artifact rules (per slot)

This isn't "4 random stats slapped on a generic artifact" — it follows the
actual rules for how the 5 artifact pieces work:

| Slot | Main stat | Possible substats |
|---|---|---|
| **Flower of Life** | Always flat HP (fixed) | 4 of the other 9 |
| **Plume of Death** (Feather) | Always flat ATK (fixed) | 4 of the other 9 |
| **Sands of Eon** | Random: HP%, ATK%, DEF%, Elemental Mastery, or Energy Recharge | 4 of the remaining 9 |
| **Goblet of Eonothem** | Random: HP%, ATK%, DEF%, Elemental Mastery, **Pyro DMG%**, or Physical DMG% | 4 of the remaining 9 |
| **Circlet of Logos** | Random: HP%, ATK%, DEF%, Elemental Mastery, **CRIT Rate**, **CRIT DMG**, or Healing Bonus | 4 of the remaining 9 |

Two important rules this follows:
- **A stat can never be both the main stat and a substat on the same
  piece.** A Circlet that rolls CRIT Rate as its main can't also roll CRIT
  Rate as a substat on that same piece.
- **Elemental/Physical DMG% and Healing Bonus are main-stat-only.** They
  can never appear as substats on any piece — only Goblet/Circlet mains.

This means outcomes now have real strategic variance: your Goblet might
roll Pyro DMG% (great for Melt damage) or might roll DEF% instead (does
nothing for damage). Same for whether Sands/Goblet/Circlet happen to roll
ATK% — total ATK is no longer fixed, it's `1189 × (1 + total ATK%) + total
flat ATK`. A 200k-roll simulation of this system gives a melt damage range
of roughly 4,200 (very unlucky) to 33,000+ (everything aligns), median
around 10,250 — which is what the rarity tiers in `rarityBadge.js` are
calibrated against.

Elemental Mastery, Energy Recharge, DEF, and HP are tracked and displayed
per-piece but — matching the original brief — don't feed into the damage
formulas; they're flavor/realism stats only.
- `src/utils/jsonbinService.js` — reads/writes the shared leaderboard bin.
- `src/hooks/useLeaderboard.js` — polls the bin every `VITE_FETCH_INTERVAL`
  ms and exposes `submitRoll()`.
- `src/hooks/useObserverFeed.js` — derives the "last 60 seconds, max 10"
  live roll feed shown on both layouts.
- `src/components/Desktop.jsx` / `Mobile.jsx` — the two responsive layouts
  described in the spec (60/40 split desktop, stacked + modal on mobile).

## One important correction from the original spec

The original build brief referenced `jsonbin.io/v3/...` as the API host.
The real JSONBin REST API lives at **`https://api.jsonbin.io/v3/...`** —
that's what `jsonbinService.js` actually calls. Using the bare `jsonbin.io`
host will not work.

## Setup

1. **Create a JSONBin.io bin** (free, no credit card):
   - Sign up at https://jsonbin.io
   - Create a new bin with this exact starting content:
     ```json
     { "leaderboard": [], "liveRolls": [] }
     ```
   - Copy the **Bin ID** from the bin's URL.
   - Go to Account → API Keys and copy your **X-Master-Key**.

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   ```
   VITE_JSONBIN_ID=your_bin_id_here
   VITE_JSONBIN_KEY=your_master_key_here
   VITE_FETCH_INTERVAL=2000
   VITE_OBSERVER_TIMEOUT=60000
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run locally**:
   ```bash
   npm run dev
   ```
   Open the printed local URL. Resize your browser below 768px width to
   preview the mobile layout, or open it on your phone.

5. **Build for production**:
   ```bash
   npm run build
   ```
   This has already been verified to build cleanly (`npm run build`
   succeeds with no errors).

## Deploying to Vercel

1. Push this project to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
2. Go to https://vercel.com → **Add New Project** → import that repo.
3. In **Settings → Environment Variables**, add:
   - `VITE_JSONBIN_ID`
   - `VITE_JSONBIN_KEY`
   - `VITE_FETCH_INTERVAL` (optional, defaults to 2000)
   - `VITE_OBSERVER_TIMEOUT` (optional, defaults to 60000)
4. Click **Deploy**. Vercel auto-detects the Vite build and serves it as a
   static site.
5. Share the generated `*.vercel.app` URL with your viewers.

## Notes on game-math assumptions

The build brief's own UI mockup numbers (Total CRIT Rate 39.2%, Total CRIT
DMG 127.6%) only make sense if the artifact roll's CRIT Rate/CRIT DMG/Pyro
DMG bonuses are **added on top of** the character's base stats (20% / 50% /
28.8%) rather than replacing them. That's how this build treats them — the
math was verified against the spec's own example numbers before shipping.

DEF and HP substats are cosmetic only, exactly as the spec requested — they
display in the artifact card but never factor into the damage formulas.

## What's intentionally NOT here (per the spec)

- No accounts/login — session-only name entry, no localStorage.
- No server you have to run — JSONBin.io is the entire backend.
- No roll deletion, no PvP, no sound effects, no probability display.
