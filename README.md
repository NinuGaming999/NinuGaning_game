# NINU Gaming Arcade

This repository contains three browser games that share the same site and Firebase project:

1. **Artifact Roll Simulator** — Arlecchino artifact RNG with its own leaderboard.
2. **Infinite Rush** — arcade infinite-road racing with single-player records and 2-player browser multiplayer.
3. **Elementals** — a 5-card elemental gacha/collection game with persistent collection data and a local duel simulator.

## Leaderboards are separate

Artifact scores live under `leaderboard/{userId}`.

Racing scores live under `racingLeaderboard/{userId}`.

They never compete with or overwrite each other. Elementals only reads the existing best scores to calculate Arcade Points. New game records use the authenticated Firebase UID.

For artifacts, one name stores only the highest Melt Damage. For racing, one name stores only the highest racing score.

For Elementals, `cardCurrency/{userId}/spent` stores points already spent and `cardCollection/{userId}/{cardId}` stores owned-card counts.

## Elementals

- 35 cards: 5 rarities across 7 elements.
- A pack costs 10 Arcade Points and contains 5 cards.
- Arcade Points = floor(best racing score / 100) + floor(best artifact Melt Damage / 500) - points already spent.
- Collection and spent points persist in Firebase; the existing artifact/racing records are never written by Elementals.
- Elemental reactions and named card abilities are resolved by the local duel engine.
- Card art is intentionally replaceable: add `imageUrl` to a card record later; the UI currently generates element/rarity placeholder art.

## Infinite Rush

Infinite Rush is designed to work on desktop and phone browsers.

### Single player

- Endless procedural highway
- Three-lane arcade steering
- Progressive traffic difficulty
- NPC cars with different speeds and vehicle types
- NPC lane-switching with visible `SWITCH` indicators
- Near misses and overtakes
- Combo scoring
- Boost meter
- Collision damage / vehicle health
- Personal high score saved to the separate racing leaderboard
- 20 km challenge cap for a long record run while retaining the endless-road presentation

### Multiplayer

- 2-player matchmaking queue
- Both players join the same deterministic match room
- Both clients receive the same road seed, so the generated highway/traffic pattern is reproducible
- Automatic countdown once two racers are queued
- Live opponent position/distance synchronization through Firebase Realtime Database
- Car-to-car pushing when racers occupy nearby lanes
- Winner determined by the first racer to finish the challenge or by race-ending crash state
- Disconnect/error states are surfaced in the race UI

### Controls

Desktop:

- `A` / `Left Arrow` — steer left
- `D` / `Right Arrow` — steer right
- `Space` — brake
- `Shift` — boost

Phone:

- Large touch left/right buttons
- Brake button
- Boost button

The racing game intentionally keeps the gameplay canvas fullscreen and puts the HUD around the edges so it remains readable on stream.

## Shared Firebase structure

```text
leaderboard/{userId}             # Artifact best only
liveRolls/{rollId}               # Artifact observer feed

racingLeaderboard/{userId}       # Racing best only
racingQueue/{userId}             # Multiplayer queue
racingMatches/{matchId}          # 2-player match state

cardCurrency/{userId}/spent      # Elementals spent points
cardCollection/{userId}/{cardId} # Elementals owned cards
```

The browser uses Firebase Authentication, Realtime Database, and the callable Functions client SDK loaded by `index.html`. No Firebase Admin credential is stored in the repository.

## Accounts and database security

The arcade now uses Firebase Authentication with email/password accounts. Registration creates a Firebase Auth user, stores only a small profile record, sends an email verification message, and signs the user out until verification is complete. Login, password reset, and persistent sessions are handled by Firebase Auth; passwords are never stored in Realtime Database.

The old deterministic username IDs are no longer used for new data. All game-owned records use the Firebase Auth UID. The existing Artifact and Racing record shapes remain the same, so their gameplay/leaderboard code still reads the same fields.

Elementals pack opening is server-authoritative through \`functions/index.js\`: the verified UID is supplied by Firebase Auth, the function calculates available Arcade Points from the existing best scores, reserves the 10-point pack cost transactionally, generates the five cards server-side, updates the collection transactionally, and returns the pack.

\`database.rules.json\` is the complete replacement rules file. It requires authenticated, email-verified users for game data, limits each user to their own profile/leaderboard/queue/state records, and makes Elementals currency/collection records server-write-only.

### Firebase setup

Enable **Authentication → Sign-in method → Email/Password** in the Firebase console before launching the new account UI.

Install the Firebase CLI, then deploy the database rules and Functions:

\`\`\`bash
firebase login
firebase use arlecchino-artifact-simulator
cd functions
npm install
cd ..
firebase deploy --only database,functions
\`\`\`

### Fresh database reset

The new system is designed for a clean database. The repository includes a guarded reset utility:

\`\`\`bash
cd functions
npm install
node tools/reset-firebase.cjs --confirm-reset-ninu-arcade
\`\`\`

Run it only with a local Google/Firebase service-account credential available through Application Default Credentials or \`GOOGLE_APPLICATION_CREDENTIALS\`. The credential file is ignored by \`.gitignore\` and must never be committed.

The reset clears Realtime Database only. Firebase Authentication users are separate and are not deleted by this command.

### Admin management

Grant an admin custom claim from a trusted machine:

\`\`\`bash
cd functions
node tools/set-admin.cjs your-email@example.com
\`\`\`

The script uses the Firebase Admin SDK and never stores the credential in the repository.

## Realtime Database rules

\`database.rules.json\` is the full replacement file for this system. After the fresh reset, deploy it with the Firebase CLI command above.


## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Vercel

The repository is already structured as a Vite app. When the GitHub repository is connected to a Vercel project with the normal Git integration enabled, pushes to the configured production branch can trigger a new deployment automatically. You can also redeploy manually from Vercel when needed.

No JSONBin environment variables are required anymore.

## Artifact Simulator notes

- Flower main stat: flat HP.
- Feather main stat: flat ATK.
- Sands: HP%, ATK%, DEF%, EM, or ER.
- Goblet: HP%, ATK%, DEF%, EM, Pyro DMG%, or Physical DMG%.
- Circlet: HP%, ATK%, DEF%, EM, CRIT Rate, CRIT DMG, or Healing Bonus.
- A main stat cannot also be one of that piece's substats.

DEF/HP/EM/ER are displayed for realism but the current artifact damage model only uses the stats specified by the original simulator design.


## Background music

The app now has one site-wide music controller that stays mounted while switching between the arcade hub, Artifact Roll Simulator, and Neon Mountain Racer. Music can be played or stopped from the floating **MUSIC ON / MUSIC OFF** control, and the preference is remembered in the browser.

To add your music later:

1. Create/open the folder `public/music/`.
2. Put your music file there as `background.mp3`.
3. Run/build the project normally.

The exact path is:

```
public/music/background.mp3
```

You can use a different filename or supported browser audio format by changing `MUSIC_SRC` at the top of `src/components/MusicPlayer.jsx`.

Because browsers commonly block autoplay until the visitor interacts with the page, the first click/tap/keypress will unlock playback when music is enabled. The player is global, so entering or leaving either game does not restart the music.
