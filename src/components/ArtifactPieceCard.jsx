import { STAT_DISPLAY } from '../utils/artifactData';
import { formatStatValue } from '../utils/format';

export default function ArtifactPieceCard({ piece }) {
  const mainLabel = STAT_DISPLAY[piece.mainStatKey]?.label || piece.mainStatKey;

  return (
    <div className="bg-[#1A1A1A] border border-[#3D3D3D] rounded-lg p-3 flex flex-col">
      <div className="text-white text-[11px] font-bold tracking-wide uppercase mb-1">
        {piece.slotShort}
      </div>
      <div className="text-[#FFD700] text-sm font-bold mb-1.5 truncate">
        {mainLabel}: {formatStatValue(piece.mainStatKey, piece.mainStatValue)}
      </div>
      <div className="space-y-0.5 mt-auto">
        {piece.chosenKeys.map((key) => (
          <div key={key} className="flex justify-between text-[11px] text-[#CCCCCC]">
            <span className="truncate pr-1">{STAT_DISPLAY[key]?.label}</span>
            <span className="shrink-0">+{formatStatValue(key, piece.substats[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
