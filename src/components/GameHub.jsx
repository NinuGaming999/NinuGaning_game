import { useEffect, useState } from 'react';
import { getDatabase, getUserIdFromName } from '../utils/firebaseService';

function GameCard({ title, description, accent, badge, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group text-left rounded-2xl border border-[#3D3D3D] bg-[#202020] p-5 hover:border-[#FF2E2E] hover:-translate-y-1 transition duration-200 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-black tracking-widest ${accent}`}>{badge}</span>
        <span className="text-[#777] group-hover:text-white transition">PLAY →</span>
      </div>
      <h2 className="text-white text-2xl md:text-3xl font-black tracking-tight">{title}</h2>
      <p className="text-[#BDBDBD] text-sm mt-2 leading-6">{description}</p>
    </button>
  );
}

export default function GameHub({ playerName, onSignOut, onOpenArtifact, onOpenRacing, onOpenCards }) {
  const [artifactBest, setArtifactBest] = useState(null);
  const [racingBest, setRacingBest] = useState(null);

  useEffect(() => {
    const id = getUserIdFromName(playerName);
    if (!id) {
      setArtifactBest(null);
      setRacingBest(null);
      return undefined;
    }

    let active = true;
    const db = getDatabase();
    Promise.all([
      db.ref(`leaderboard/${id}`).once('value'),
      db.ref(`racingLeaderboard/${id}`).once('value'),
    ]).then(([artifactSnap, racingSnap]) => {
      if (!active) return;
      setArtifactBest(artifactSnap.val());
      setRacingBest(racingSnap.val());
    }).catch(() => {
      if (!active) return;
      setArtifactBest(null);
      setRacingBest(null);
    });

    return () => { active = false; };
  }, [playerName]);

  const hasName = playerName.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <header className="border-b-2 border-[#FF2E2E] px-5 md:px-8 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs md:text-sm text-[#FF2E2E] font-black tracking-[0.28em]">NINU GAMING ARCADE</div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight">Choose Your Game</h1>
        </div>
        <div className="hidden md:block text-right text-xs text-[#777]">ONE NAME • TWO GAMES</div>
      </header>

      <main className="max-w-6xl mx-auto p-5 md:p-8">
        <div className="rounded-2xl border border-[#333] bg-[#191919] p-5 mb-6">
          <label className="block text-xs font-bold tracking-widest text-[#999] mb-2">SIGNED IN AS</label>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-black truncate">{playerName}</div>
            <button
              type="button"
              onClick={onSignOut}
              className="shrink-0 text-sm text-white border border-[#555] rounded-lg px-3 py-1.5 hover:border-[#FF2E2E] transition"
            >
              Sign out
            </button>
          </div>
          <p className="text-xs text-[#777] mt-2">Your account name is used across all games. Each game keeps its own leaderboard.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <GameCard
            title="Artifact Roll Simulator"
            description="Roll a full Arlecchino artifact set, chase insane Melt Damage and climb the artifact-only leaderboard."
            badge="GAME 01 • RNG"
            accent="text-[#FF2E2E]"
            onClick={onOpenArtifact}
          />
          <GameCard
            title="Elementals"
            description="Open 5-card elemental packs with points earned in the other games, collect 35 cards, and duel random opponents."
            badge="GAME 03 • CARDS"
            accent="text-[#19D3FF]"
            onClick={onOpenCards}
          />
          <GameCard
            title="Neon Mountain Racer"
            description="Race a 7km neon mountain circuit in full 3D - 3 laps against AI or live 1v1, with drifting, boost and a proper leaderboard."
            badge="GAME 02 • RACING"
            accent="text-[#43D17A]"
            onClick={onOpenRacing}
          />
        </div>

        <section className="mt-6 grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#333] bg-[#191919] p-4">
            <div className="text-xs text-[#777] font-bold tracking-widest">ARTIFACT BEST</div>
            <div className="text-2xl font-black mt-1">{artifactBest ? Number(artifactBest.meltDamage || 0).toLocaleString() : '—'}</div>
          </div>
          <div className="rounded-xl border border-[#333] bg-[#191919] p-4">
            <div className="text-xs text-[#777] font-bold tracking-widest">RACING BEST</div>
            <div className="text-2xl font-black mt-1">{racingBest ? Number(racingBest.score || 0).toLocaleString() : '—'}</div>
          </div>
          <div className="rounded-xl border border-[#333] bg-[#191919] p-4">
            <div className="text-xs text-[#777] font-bold tracking-widest">PLAYER</div>
            <div className={`text-2xl font-black mt-1 truncate ${hasName ? 'text-white' : 'text-[#555]'}`}>{hasName ? playerName.trim() : 'Not set'}</div>
          </div>
        </section>
      </main>
    </div>
  );
}
