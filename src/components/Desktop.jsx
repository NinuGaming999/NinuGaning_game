import Header from './Header';
import NameInput from './NameInput';
import ArtifactCard from './ArtifactCard';
import RollButton from './RollButton';
import StatsBreakdown from './StatsBreakdown';
import Leaderboard from './Leaderboard';
import ObserverFeed from './ObserverFeed';

export default function Desktop({
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
  return (
    <div className="h-screen bg-[#1A1A1A] flex flex-col overflow-hidden">
      <Header onBack={onBack} />

      <div className="flex flex-1 min-h-0">
        <div className="w-[60%] flex flex-col items-center gap-5 p-8 overflow-y-auto">
          <NameInput value={playerName} onChange={setPlayerName} disabled={rolling} />
          {nameError && <div className="text-[#FF2E2E] text-sm -mt-3">{nameError}</div>}
          <ArtifactCard roll={roll} />
          <RollButton onRoll={onRoll} rolling={rolling} />
          <StatsBreakdown roll={roll} />
        </div>

        <div className="w-[40%] border-l-2 border-[#FF2E2E] p-6 min-h-0">
          <Leaderboard
            leaderboard={leaderboard}
            currentPlayerName={playerName}
            loading={loading}
            error={error}
          />
        </div>
      </div>

      <div className="border-t-2 border-[#FF2E2E] shrink-0">
        <ObserverFeed rolls={liveRolls} />
      </div>
    </div>
  );
}
