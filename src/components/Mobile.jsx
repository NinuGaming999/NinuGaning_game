import { useState } from 'react';
import Header from './Header';
import NameInput from './NameInput';
import ArtifactCard from './ArtifactCard';
import RollButton from './RollButton';
import StatsBreakdown from './StatsBreakdown';
import LeaderboardModal from './LeaderboardModal';
import ObserverFeed from './ObserverFeed';

export default function Mobile({
  playerName,
  setPlayerName,
  roll,
  rolling,
  onRoll,
  nameError,
  leaderboard,
  loading,
  error,
  liveRolls,
  onBack,
}) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col pb-[66px]">
      <Header onBack={onBack} />
      <div className="flex flex-col items-center gap-4 p-4">
        <NameInput value={playerName} onChange={setPlayerName} disabled={rolling} />
        {nameError && <div className="text-[#FF2E2E] text-sm">{nameError}</div>}
        <ArtifactCard roll={roll} />
        <StatsBreakdown roll={roll} />
        <button
          type="button"
          onClick={() => setShowLeaderboard(true)}
          className="w-full border-2 border-[#FF2E2E] text-white font-bold py-3 rounded-lg hover:bg-[#FF2E2E] transition duration-200"
        >
          VIEW ARTIFACT LEADERBOARD
        </button>
      </div>
      <ObserverFeed rolls={liveRolls} />
      <RollButton onRoll={onRoll} rolling={rolling} fixed />
      <LeaderboardModal
        open={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        leaderboard={leaderboard}
        currentPlayerName={playerName}
        loading={loading}
        error={error}
      />
    </div>
  );
}
