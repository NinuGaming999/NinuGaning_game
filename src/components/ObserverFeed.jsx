import { getRarity } from '../utils/rarityBadge';
import { timeAgo } from '../utils/format';

export default function ObserverFeed({ rolls }) {
  return (
    <div className="live-feed">
      <div className="live-feed-head">
        <span>🔴</span>
        <h3 className="live-feed-title">LIVE ROLLS</h3>
      </div>
      <div className="live-feed-list">
        {rolls.length === 0 && (
          <div className="live-empty">No recent rolls yet — be the first!</div>
        )}
        {rolls.map((r) => {
          const rarity = getRarity(r.meltDamage);
          return (
            <div
              key={`${r.playerName}-${r.timestamp}`}
              className="live-item"
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
