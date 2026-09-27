import { useCallback, useState, Suspense, lazy } from 'react';
import Desktop from './components/Desktop';
import Mobile from './components/Mobile';
import GameHub from './components/GameHub';
const RacingGame = lazy(() => import('./racing/RacingGameV2'));
const CardGame = lazy(() => import('./cardgame/CardGame'));
import { useResponsive } from './hooks/useResponsive';
import { useLeaderboard } from './hooks/useLeaderboard';
import { useObserverFeed } from './hooks/useObserverFeed';
import { rollArtifactSet, aggregateArtifactSet } from './utils/artifactRoller';
import { calculateDamage } from './utils/damageCalculator';
import { getRarity } from './utils/rarityBadge';
import { formatStatValue } from './utils/format';
import { SLOT_ORDER } from './utils/artifactData';
import MusicPlayer from './components/MusicPlayer';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './hooks/useAuth';
import { signOutAccount } from './utils/authService';

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

function ArtifactGame({ isMobile, playerName, onBack }) {
  const [nameError, setNameError] = useState('');
  const [roll, setRoll] = useState(null);
  const [rolling, setRolling] = useState(false);
  const { leaderboard, liveRolls, loading, error, submitRoll } = useLeaderboard();
  const visibleLiveRolls = useObserverFeed(liveRolls);

  const handleRoll = useCallback(() => {
    const cleanName = sanitizeName(playerName);
    if (!cleanName) { setNameError('Your account display name is required.'); return; }
    setNameError('');
    setRolling(true);
    const pieces = rollArtifactSet();
    const totals = aggregateArtifactSet(pieces);
    const damage = calculateDamage(totals);
    const rarity = getRarity(damage.meltDamage);
    const newRoll = {
      rollId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pieces, totals,
      totalATK: damage.totalATK, critRate: damage.critRate, critDmg: damage.critDmg,
      pyroDmg: damage.pyroDmg, physicalBonus: damage.physicalBonus,
      physicalDamage: damage.physicalDamage, meltDamage: damage.meltDamage, rarity,
    };
    submitRoll({
      id: newRoll.rollId,
      playerName: cleanName,
      meltDamage: damage.meltDamage,
      physicalDamage: damage.physicalDamage,
      timestamp: Date.now(),
      rarity: rarity.name,
      artifacts: {
        totalATK: Math.round(damage.totalATK),
        critRate: damage.critRate, critDmg: damage.critDmg, pyroDmg: damage.pyroDmg,
        pieces: summarizePieces(pieces),
      },
    });
    window.setTimeout(() => setRoll(newRoll), REVEAL_DELAY_MS);
    window.setTimeout(() => setRolling(false), ROLL_BUTTON_LOCK_MS);
  }, [playerName, submitRoll]);

  return isMobile ? (
    <Mobile playerName={playerName} roll={roll} rolling={rolling} onRoll={handleRoll}
      nameError={nameError} leaderboard={leaderboard} loading={loading} error={error}
      liveRolls={visibleLiveRolls} onBack={onBack} />
  ) : (
    <Desktop playerName={playerName} roll={roll} rolling={rolling} onRoll={handleRoll}
      nameError={nameError} leaderboard={leaderboard} loading={loading} error={error}
      liveRolls={visibleLiveRolls} onBack={onBack} />
  );
}

export default function App() {
  const isMobile = useResponsive();
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState('hub');
  if (loading) return <div className="fixed inset-0 bg-[#080a0f] text-white flex items-center justify-center font-black">Loading account…</div>;
  if (!user) return <AuthScreen />;
  const playerName = String(user.displayName || user.email?.split('@')[0] || 'Player').trim();
  return (
    <>
      <AppScreen screen={screen} isMobile={isMobile} playerName={playerName} userEmail={user.email || ''} setScreen={setScreen} />
      <MusicPlayer />
    </>
  );
}

function AppScreen({ screen, isMobile, playerName, userEmail, setScreen }) {
  if (screen === 'artifact') {
    return <ArtifactGame isMobile={isMobile} playerName={playerName} onBack={() => setScreen('hub')} />;
  }
  if (screen === 'racing') {
    return <Suspense fallback={<div className="fixed inset-0 bg-black text-white flex items-center justify-center font-bold">Loading racer...</div>}>
      <RacingGame initialPlayerName={playerName} onBack={() => setScreen('hub')} />
    </Suspense>;
  }
  if (screen === 'cards') {
    return <Suspense fallback={<div className="fixed inset-0 bg-black text-white flex items-center justify-center font-bold">Loading cards...</div>}>
      <CardGame initialPlayerName={playerName} onBack={() => setScreen('hub')} />
    </Suspense>;
  }
  return <GameHub playerName={playerName} userEmail={userEmail}
    onOpenArtifact={() => setScreen('artifact')}
    onOpenRacing={() => setScreen('racing')}
    onOpenCards={() => setScreen('cards')}
    onSignOut={signOutAccount}
  />;
}
