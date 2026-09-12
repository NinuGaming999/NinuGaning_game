import { useMemo, useState } from 'react';
import LeaderboardToggle from './LeaderboardToggle';

const RANK_STYLES = {
  1: { color: '#FFD700', suffix: '⭐' },
  2: { color: '#C0C0C0', suffix: '◆' },
  3: { color: '#CD7F32', suffix: '◆' },
};

function filterByTimeframe(entries, timeframe) {
  const now = Date.now();
  if (timeframe === 'weekly') {
    return entries.filter((e) => now - e.timestamp < 7 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === 'daily') {
    return entries.filter((e) => now - e.timestamp < 24 * 60 * 60 * 1000);
  }
  return entries;
}

export default function Leaderboard({ leaderboard, currentPlayerName, loading, error }) {
  const [timeframe, setTimeframe] = useState('all');

  const rows = useMemo(() => {
    return filterByTimeframe(leaderboard, timeframe)
      .slice()
      .sort((a, b) => b.meltDamage - a.meltDamage)
      .slice(0, 50);
  }, [leaderboard, timeframe]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <h2 className="text-white font-bold text-base md:text-lg tracking-wide mb-2">LEADERBOARD</h2>
      <LeaderboardToggle active={timeframe} onChange={setTimeframe} />
      {error && <div className="text-[#FF2E2E] text-xs mt-2">{error}</div>}

      <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-[#3D3D3D]">
        <div className="grid grid-cols-[36px_1fr_84px] bg-[#FF2E2E] text-white font-bold text-xs py-2 px-3 sticky top-0">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Score</span>
        </div>

        {loading && rows.length === 0 && (
          <div className="text-[#CCCCCC] text-sm p-3">Loading leaderboard...</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="text-[#CCCCCC] text-sm p-3">No rolls yet. Be the first!</div>
        )}

        {rows.map((row, i) => {
          const rank = i + 1;
          const isMe = currentPlayerName && row.playerName === currentPlayerName;
          const style = RANK_STYLES[rank];
          return (
            <div
              key={row.id || `${row.playerName}-${row.timestamp}`}
              className={`grid grid-cols-[36px_1fr_84px] items-center text-sm py-2 px-3 transition-colors duration-200 hover:bg-[#3D3D3D] ${
                i % 2 === 0 ? 'bg-[#2D2D2D]' : 'bg-[#1A1A1A]'
              } ${isMe ? 'bg-[#3D2D2D]' : ''}`}
            >
              <span className="font-bold" style={{ color: style?.color || '#FFD700' }}>
                {rank}
              </span>
              <span className="text-white truncate pr-2">{row.playerName}</span>
              <span className="text-right font-bold text-[#FFD700]">
                {row.meltDamage.toLocaleString()}
                {style?.suffix ? ` ${style.suffix}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
