# NINU Gaming Arcade

This repository contains two browser games that share the same site and Firebase project:

1. **Artifact Roll Simulator** — Arlecchino artifact RNG with its own leaderboard.
2. **Infinite Rush** — arcade infinite-road racing with single-player records and 2-player browser multiplayer.

## Leaderboards are separate

Artifact scores live under `leaderboard/{userId}`.

Racing scores live under `racingLeaderboard/{userId}`.

They never compete with or overwrite each other. Both use the same deterministic username ID system: trimmed, lowercase names map to one Firebase-safe ID, so the same name always maps to the same record.

For artifacts, one name stores only the highest Melt Damage. For racing, one name stores only the highest racing score.

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
```

The browser uses the Firebase web SDK already loaded by `index.html`; no Firebase Admin credential is stored in the repository.

## Realtime Database rules

`database.rules.json` now contains rules for both games. After pulling/deploying this version, publish the latest rules in **Firebase Console → Realtime Database → Rules**.

The racing leaderboard uses the same one-user/highest-score pattern as the artifact leaderboard. Match/queue paths are intentionally public for this account-free prototype; they are not intended to be a cryptographically secure anti-cheat system.

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
