# NINU Gaming Arcade

A browser-based arcade and artifact roll simulator built with React, Vite, Tailwind CSS, and Three.js. The project centers on a collection of small playable game systems and a shared player identity layer powered by Firebase.

This repository is primarily JavaScript-based, with the current composition roughly:

- JavaScript: 81%
- CSS: 18.7%
- HTML: 0.3%

The repo is best understood as a personal game prototype / learning project: it combines a fast front-end stack, live leaderboards, account management, and several game modes under one arcade hub.

## Overview

The arcade currently includes three core experiences:

1. Artifact Roll Simulator
   - Roll a five-piece artifact set
   - Calculate Melt Damage
   - Compare results on a shared leaderboard
   - Track the best score for a player profile

2. Neon Mountain Racer
   - 3D racing gameplay with AI opponents
   - Multiple graphics presets
   - Keyboard and touch controls
   - Track-based race logic and leaderboard integration
   - Firebase-powered head-to-head queue and match state

3. Elementals
   - Collect and manage cards
   - Spend Arcade Points on packs
   - Battle using elemental reactions
   - Maintain persistent progress for the user

---

## Why this project exists

This project is designed to explore a few ideas at once:

- creating a compact game hub in the browser
- keeping multiple game systems under one shared account model
- using Firebase for identity, persistence, and real-time leaderboard behavior
- building a reusable front-end architecture for different game styles
- learning how to separate utility logic, UI, and game engines cleanly

---

## Main features

### Artifact Roll Simulator

- Five-slot artifact generation
- Main-stat and sub-stat roll logic
- Damage calculation based on the generated set
- High-score tracking and leaderboard support
- Player account integration through Firebase

### Neon Mountain Racer

- 3D mountain course rendering
- AI racers and traffic elements
- Simple force-based vehicle physics
- Graphics presets for optimized or more detailed rendering
- Minimap and chase-camera style presentation
- Matchmaking-ready multiplayer logic for Firebase-backed sessions

### Elementals

- 35 collectible cards
- Five rarity tiers
- Seven elemental types
- Reaction-based combat logic
- Arcade Point economy and pack purchases
- Persisted user collection data

### Shared arcade systems

- Firebase Email/Password authentication
- Username claiming and identity binding
- Shared display name across games
- Leaderboard and score persistence
- Arcade Points derived from saved high scores
- Background music and site branding assets

---

## Tech stack

- React 18
- Vite
- JavaScript (primary language)
- Tailwind CSS
- Three.js
- Firebase Authentication
- Firebase Realtime Database
- GitHub Actions for automated builds
- Vercel-friendly deployment setup

---

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
│   ├── MusicPlayer.jsx
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
├── utils/
│   ├── artifactData.js
│   ├── artifactRoller.js
│   ├── authService.js
│   ├── damageCalculator.js
│   ├── firebaseService.js
│   └── racingService.js
└── ...
```

Key files:

- `src/utils/artifactRoller.js` — artifact generation logic
- `src/utils/damageCalculator.js` — attack calculation logic
- `src/utils/artifactData.js` — stat pools and roll metadata
- `src/racing/RacingGameV2.jsx` — current racing implementation
- `src/cardgame/CardGame.jsx` — card game interface and gameplay loop
- `database.rules.json` — Firebase Realtime Database rules

---

## Authentication and user model

The arcade uses Firebase email/password authentication.

The current account flow is:

1. Create an account
2. Verify the email
3. Claim a permanent username

Player names are reused across the arcade to support shared leaderboard and profile data.

Important notes:

- Google sign-in is not part of the current UI
- Username ownership is intended to be stable and unique
- Several gameplay records are generated in the browser and should not be treated as secure anti-cheat data

---

## Firebase data layout

```text
usernames/{nameKey}                  -> owning Firebase UID
users/{uid}/username                 -> permanent display name
users/{uid}/usernameKey              -> deterministic username key

leaderboard/{userId}                 -> best Artifact Roll score
liveRolls/{rollId}                   -> recent artifact rolls

racingLeaderboard/{userId}            -> best racing score
racingQueue/{userId}                 -> 1v1 matchmaking queue
racingMatches/{matchId}               -> multiplayer match state

cardCollection/{userId}/{cardId}      -> card ownership
cardCurrency/{userId}/spent           -> Arcade Points spent
```

The database rules are stored in `database.rules.json` and are intended for use with Firebase Realtime Database.

---

## Security and architecture notes

The database rules are designed around account ownership and user-specific data isolation.

This project is currently best suited for:

- casual personal arcade use
- experimentation and learning
- local play testing
- front-end prototype development

It is not a hardened competitive or anti-cheat system. Any data that is calculated client-side should be treated as mutable or inspectable by the user.

---

## Gameplay and progression

The game loop in this repo is intentionally simple and accessible:

- create or sign in to a user account
- pick a game from the arcade hub
- play and accumulate score or progress
- compare results against live leaderboard data
- spend Arcade Points on collection-based gameplay

This keeps the experience focused on quick sessions and experimentation rather than large backend complexity.

---

## Background music and public assets

The site includes a background music player. The current file is:

```text
public/music/background.mp3
```

The player:

- stays mounted while switching screens
- loops the audio track
- saves playback preference in `localStorage`
- retries after user interaction if browser autoplay protections block playback

Favicon assets are kept in:

```text
public/favicon.ico
public/favicon.png
```

---

## Local development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## CI and deployment

This repository includes a build workflow that validates the app and runs the production build on pushes and pull requests.

The app is structured as a Vite project and is straightforward to deploy to Vercel or other static hosting platforms.

---

## Contributing

If you plan to extend the project, keep these practices in mind:

1. Separate gameplay logic from presentation where possible.
2. Keep game systems modular instead of embedding them directly into component render functions.
3. Clean up timers, listeners, animation loops, and Three.js resources on unmount.
4. Keep the README updated when adding or changing game features.

---

## Current status

This is an actively evolving arcade project focused on learning, experimentation, and building multiple playable systems in one lightweight front-end app.

It is a strong example of a personal game prototype that blends:

- browser-based interface design
- game systems and simulation logic
- shared identity and persistent data
- realtime leaderboard patterns
- modular gameplay architecture

---

## Summary

NINU Gaming Arcade is a compact browser game hub centered around an artifact roll simulator, a racing game, and a card battler. It is built with React and Vite, uses Firebase for identity and persistence, and demonstrates how multiple small game systems can share a unified arcade experience.

If you want to explore or extend the project, start with the `src/` directory and the shared logic under the utility and game-specific folders.
