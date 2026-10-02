# NINU Gaming Arcade

A browser-based gaming hub built with React, Firebase Realtime Database, and Three.js.

The arcade currently contains three games that share one verified player account:

1. **Artifact Roll Simulator** — roll a five-piece Arlecchino artifact set, calculate damage, and compete on a live Melt Damage leaderboard.
2. **Neon Mountain Racer** — a 3D mountain racing game with AI opponents, vehicle physics, graphics presets, mobile controls, and a Firebase-powered 1v1 mode.
3. **Elementals** — collect 35 elemental cards, spend Arcade Points on packs, and fight reaction-based duels.

## Tech stack

- React 18
- Vite
- Tailwind CSS
- Three.js
- Firebase Authentication
- Firebase Realtime Database
- GitHub Actions
- Vercel

## Project structure

```text
src/
├── App.jsx
├── cardgame/
│   ├── CardGame.jsx
│   ├── cardService.js
│   └── cards.js
├── components/
│   ├── AccountCenter.jsx
│   ├── AuthScreen.jsx
│   ├── GameHub.jsx
│   └── ...
├── hooks/
│   ├── useAuth.js
│   ├── useLeaderboard.js
│   └── ...
├── racing/
│   ├── RacingGameV2.jsx
│   └── engine/
│       ├── AI.js
│       ├── Camera.js
│       ├── Car.js
│       ├── Graphics.js
│       ├── Input.js
│       ├── Track.js
│       └── World.js
└── utils/
    ├── artifactData.js
    ├── artifactRoller.js
    ├── authService.js
    ├── damageCalculator.js
    ├── firebaseService.js
    └── racingService.js
```

The active racing implementation is `src/racing/RacingGameV2.jsx`. Game-specific engine code lives under `src/racing/engine/`.

## Accounts

The arcade uses Firebase Email/Password authentication.

New accounts go through three steps:

1. Create an account with an email and password.
2. Verify the email address.
3. Claim a permanent 3–16 character player name.

The player name is shared across the arcade and is used for leaderboard and game data records.

Google sign-in is intentionally not part of the current UI.

## Firebase data layout

```text
usernames/{nameKey}                  -> owning Firebase UID
users/{uid}/username                 -> permanent display name
users/{uid}/usernameKey              -> deterministic username key

leaderboard/{userId}                -> best Artifact Roll score
liveRolls/{rollId}                  -> recent artifact rolls

racingLeaderboard/{userId}           -> best racing score
racingQueue/{userId}                 -> 1v1 matchmaking queue
racingMatches/{matchId}              -> multiplayer match state

cardCollection/{userId}/{cardId}     -> card ownership
cardCurrency/{userId}/spent          -> Arcade Points spent
```

The database rules are stored in `database.rules.json` and are intended to be published to Firebase Realtime Database.

## Security model

The database rules are designed primarily around **account ownership**:

- a verified account can claim a username only once;
- username records are bound to their Firebase UID;
- player records are stored under deterministic username keys;
- leaderboard writes are restricted to the account that owns the username;
- account-only data such as card collections is restricted to its owner.

There is an important limitation: several game results are calculated in the browser. That means this project is suitable for a casual arcade, but it is **not a secure anti-cheat system**. A determined attacker can modify client-side game code and attempt to submit manipulated game results.

The racing multiplayer state is also client-authoritative. Do not treat the current leaderboard, currency, collection, or match data as suitable for a competitive economy without moving important validation to trusted server-side code.

## Artifact Roll Simulator

The artifact simulator models the five real slots:

- Flower
- Feather
- Sands
- Goblet
- Circlet

Main-stat pools and five-star stat ranges are kept in `src/utils/artifactData.js`.

The roller is in `src/utils/artifactRoller.js`, while damage calculations are isolated in `src/utils/damageCalculator.js`.

The artifact leaderboard stores each player's highest Melt Damage rather than every score.

## Neon Mountain Racer

The current racer includes:

- 3D mountain circuit
- Three laps
- Simplified force-based vehicle physics
- Tire grip and lateral slip
- Collision impulses
- AI drivers using the same physics model
- Procedural traffic and scenery
- Minimap
- Chase camera
- Smoke, sparks, glow, and lighting effects
- High FPS / Balanced / Better Quality graphics presets
- Desktop keyboard controls
- Touch controls
- Racing leaderboard
- Firebase matchmaking and live opponent state

The racing engine is separated into small systems so physics, AI, graphics, input, camera, track generation, and world building can evolve independently.

## Elementals card game

Elementals currently has:

- 35 collectible cards
- 5 rarities
- 7 elements
- Five-card packs
- Arcade Point spending
- Persistent card collections
- Elemental reaction-based battles
- Random-opponent duel simulation

Card definitions live in `src/cardgame/cards.js`, persistence helpers live in `src/cardgame/cardService.js`, and the main UI/gameplay is in `src/cardgame/CardGame.jsx`.

## Arcade Points

Arcade Points are currently derived from the player's saved best scores:

- racing score contributes points based on score;
- artifact Melt Damage contributes points based on damage;
- points spent on card packs are tracked separately.

This is a client-side economy for the current arcade and should not be treated as tamper-proof.

## Background music

Site-wide music is handled by `src/components/MusicPlayer.jsx`.

The current file path is:

```text
public/music/background.mp3
```

The player:

- stays mounted while switching between arcade screens;
- loops the track;
- remembers the on/off preference in `localStorage`;
- retries playback after the first user interaction when browser autoplay rules block audible autoplay.

Browsers can still require user interaction before allowing audible playback.

## Favicon

The current favicon files live in:

```text
public/favicon.ico
public/favicon.png
```

They are referenced from `index.html`.

## Development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Continuous integration

GitHub Actions runs the production build on pushes and pull requests targeting `main`.

The workflow uses Node 20, installs from `package-lock.json`, and runs `npm run build`.

## Vercel

This is a Vite application and can be deployed directly from the GitHub repository to Vercel.

The repository already contains:

- Vite configuration
- production build script
- GitHub Actions build verification
- public static assets used by the games

No JSONBin backend is required by the current application.

## Notes for contributors

Keep game logic separated from presentation where practical.

Before adding a large new feature:

1. Check whether the logic belongs in an existing utility, hook, service, or racing engine module.
2. Avoid putting long-lived game loops directly into ordinary React render logic.
3. Clean up event listeners, timers, animation frames, and Three.js resources when a game is unmounted.
4. Update this README when the architecture or game list changes.

## Current status

This is an actively evolving personal arcade project. The emphasis is on learning, experimentation, and adding complete playable systems while keeping the code understandable enough to continue improving over time.
