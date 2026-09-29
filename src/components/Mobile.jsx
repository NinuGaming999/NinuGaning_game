import { useState } from 'react';
import Header from './Header';
import NameInput from './NameInput';
import ArtifactCard from './ArtifactCard';
import RollButton from './RollButton';
import StatsBreakdown from './StatsBreakdown';
import LeaderboardModal from './LeaderboardModal';
import ObserverFeed from './ObserverFeed';

export default function Mobile({ playerName, setPlayerName, roll, rolling, onRoll, nameError, leaderboard, loading, error, liveRolls, onBack }) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  return (
    <div className="artifact-page artifact-mobile">
      <Header onBack={onBack} title="Artifact Roll Simulator" />
      <main className="artifact-mobile-main">
        <div className="artifact-stage-head"><div><span>GAME 01 · RNG LAB</span><h1>ROLL FOR THE IMPOSSIBLE.</h1><p>Build your five-piece Arlecchino set.</p></div><div className="artifact-session"><small>PLAYER</small><strong>{playerName}</strong></div></div>
        <section className="artifact-roll-zone">
          <NameInput value={playerName} onChange={setPlayerName} disabled={rolling} />
          {nameError && <div className="artifact-error">{nameError}</div>}
          <ArtifactCard roll={roll} />
          <RollButton onRoll={onRoll} rolling={rolling} />
          <StatsBreakdown roll={roll} />
          <button type="button" className="artifact-secondary" onClick={() => setShowLeaderboard(true)}>VIEW LEADERBOARD ↗</button>
        </section>
        <section className="artifact-live"><ObserverFeed rolls={liveRolls} /></section>
      </main>
      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} leaderboard={leaderboard} currentPlayerName={playerName} loading={loading} error={error} />
    </div>
  );
}
