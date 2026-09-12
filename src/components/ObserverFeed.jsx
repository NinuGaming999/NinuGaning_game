import { getRarity } from '../utils/rarityBadge';
import { timeAgo } from '../utils/format';

export default function ObserverFeed({ rolls }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 px-4 pt-3">
        <span>🔴</span>
        <h3 className="text-white font-bold text-sm tracking-wide">LIVE ROLLS</h3>
      </div>
      <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible px-4 pb-4 md:max-h-[220px] md:overflow-y-auto">
        {rolls.length === 0 && (
          <div className="text-[#CCCCCC] text-xs">No recent rolls yet — be the first!</div>
        )}
        {rolls.map((r) => {
          const rarity = getRarity(r.meltDamage);
          return (
            <div
              key={`${r.playerName}-${r.timestamp}`}
              className="min-w-[220px] md:min-w-0 bg-gradient-to-r from-[#2D2D2D] to-[#1A1A1A] border-l-4 border-[#FF2E2E] rounded-lg p-3 shrink-0"
              style={{ animation: 'slideInTop 0.3s ease-out' }}
            >
              <div className="text-white text-sm">
                {rarity.emoji} <span className="font-bold">{r.playerName}</span> just rolled!
              </div>
              <div className="text-xs mt-1" style={{ color: rarity.textColor }}>
                {r.rarity} ({r.meltDamage.toLocaleString()} melt damage)
              </div>
              <div className="text-[#CCCCCC] text-[11px] mt-1">{timeAgo(r.timestamp)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
