import { useCallback, useState } from 'react';
import Desktop from './components/Desktop';
import Mobile from './components/Mobile';
import GameHub from './components/GameHub';
import RacingGame from './racing/RacingGame';
import { useResponsive } from './hooks/useResponsive';
import { useLeaderboard } from './hooks/useLeaderboard';
import { useObserverFeed } from './hooks/useObserverFeed';
import { rollArtifactSet, aggregateArtifactSet } from './utils/artifactRoller';
import { calculateDamage } from './utils/damageCalculator';
import { getRarity } from './utils/rarityBadge';
import { formatStatValue } from './utils/format';
import { SLOT_ORDER } from './utils/artifactData';

const ROLL_BUTTON_LOCK_MS = 2000;
const REVEAL_DELAY_MS = 300;

function sanitizeName(raw) {
  return raw.replace(/[\n\r"']/g, '').trim().slice(0, 32);
}

function summarizePieces(pieces) {
  const summary = {};
  SLOT_ORDER.forEach((slotKey) => {
    const piece = pieces[slotKey];
    summary[slotKey] = {
      mainStat: piece.mainStatKey,
      mainStatValue: formatStatValue(piece.mainStatKey, piece.mainStatValue),
      substats: piece.chosenKeys.reduce((acc, key) => {
        acc[key] = formatStatValue(key, piece.substats[key]);
        return acc;
      }, {}),
    };
  });
  return summary;
}

function ArtifactGame({ isMobile, playerName, setPlayerName, onBack }) {
  const [nameError, setNameError] = useState('');
  const [roll, setRoll] = useState(null);
  const [rolling, setRolling] = useState(false);

  const { leaderboard, liveRolls, loading, error, submitRoll } = useLeaderboard();
  const visibleLiveRolls = useObserverFeed(liveRolls);

  const handleRoll = useCallback(() => {
    const cleanName = sanitizeName(playerName);
    if (!cleanName) {
      setNameError('Please enter a name to roll!');
      return;
    }

    setNameError('');
    setRolling(true);

    const pieces = rollArtifactSet();
    const totals = aggregateArtifactSet(pieces);
    const damage = calculateDamage(totals);
    const rarity = getRarity(damage.meltDamage);

    const newRoll = {
      rollId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pieces,
      totals,
      totalATK: damage.totalATK,
      critRate: damage.critRate,
      critDmg: damage.critDmg,
      pyroDmg: damage.pyroDmg,
      physicalBonus: damage.physicalBonus,
      physicalDamage: damage.physicalDamage,
      meltDamage: damage.meltDamage,
      rarity,
    };

    const entry = {
      id: newRoll.rollId,
      playerName: cleanName,
      meltDamage: damage.meltDamage,
      physicalDamage: damage.physicalDamage,
      timestamp: Date.now(),
      rarity: rarity.name,
      artifacts: {
        totalATK: Math.round(damage.totalATK),
        critRate: damage.critRate,
        critDmg: damage.critDmg,
        pyroDmg: damage.pyroDmg,
        pieces: summarizePieces(pieces),
      },
    };

    window.setTimeout(() => setRoll(newRoll), REVEAL_DELAY_MS);
    submitRoll(entry);
    window.setTimeout(() => setRolling(false), ROLL_BUTTON_LOCK_MS);
  }, [playerName, submitRoll]);

  const sharedProps = {
    playerName,
    setPlayerName,
    roll,
    rolling,
    onRoll: handleRoll,
    nameError,
    leaderboard,
    loading,
    error,
    liveRolls: visibleLiveRolls,
    onBack,
  };

  return isMobile ? <Mobile {...sharedProps} /> : <Desktop {...sharedProps} />;
}

export default function App() {
  const isMobile = useResponsive();
  const [screen, setScreen] = useState('hub');
  const [playerName, setPlayerName] = useState('');

  if (screen === 'artifact') {
    return (
      <ArtifactGame
        isMobile={isMobile}
        playerName={playerName}
        setPlayerName={setPlayerName}
        onBack={() => setScreen('hub')}
      />
    );
  }

  if (screen === 'racing') {
    return (
      <RacingGame
        initialPlayerName={playerName}
        onBack={() => setScreen('hub')}
      />
    );
  }

  return (
    <GameHub
      playerName={playerName}
      setPlayerName={setPlayerName}
      onOpenArtifact={() => setScreen('artifact')}
      onOpenRacing={() => setScreen('racing')}
    />
  );
}
