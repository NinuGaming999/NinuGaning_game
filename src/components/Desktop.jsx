import Header from './Header';
import NameInput from './NameInput';
import ArtifactCard from './ArtifactCard';
import RollButton from './RollButton';
import StatsBreakdown from './StatsBreakdown';
import Leaderboard from './Leaderboard';
import ObserverFeed from './ObserverFeed';

export default function Desktop({ playerName, setPlayerName, roll, rolling, onRoll, nameError, leaderboard, loading, error, liveRolls, onBack }) {
  return (
    <div className="artifact-page">
      <Header onBack={onBack} title="Artifact Roll Simulator" />
      <main className="artifact-desktop">
        <section className="artifact-stage">
          <div className="artifact-stage-head">
            <div><span>GAME 01 · RNG LAB</span><h1>ROLL FOR THE IMPOSSIBLE.</h1><p>Build a five-piece Arlecchino set and push the damage ceiling.</p></div>
            <div className="artifact-session"><small>PLAYER</small><strong>{playerName}</strong><span>VERIFIED SESSION</span></div>
          </div>
          <div className="artifact-workspace">
            <div className="artifact-roll-zone">
              <NameInput value={playerName} onChange={setPlayerName} disabled={rolling} />
              {nameError && <div className="artifact-error">{nameError}</div>}
              <ArtifactCard roll={roll} />
              <RollButton onRoll={onRoll} rolling={rolling} />
              <StatsBreakdown roll={roll} />
            </div>
            <aside className="artifact-side"><Leaderboard leaderboard={leaderboard} currentPlayerName={playerName} loading={loading} error={error} /></aside>
          </div>
        </section>
        <section className="artifact-live"><ObserverFeed rolls={liveRolls} /></section>
      </main>
    </div>
  );
}
