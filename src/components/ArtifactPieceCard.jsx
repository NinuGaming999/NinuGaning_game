import { STAT_DISPLAY } from '../utils/artifactData';
import { formatStatValue } from '../utils/format';

export default function ArtifactPieceCard({ piece }) {
  const mainLabel = STAT_DISPLAY[piece.mainStatKey]?.label || piece.mainStatKey;

  return (
    <div className="artifact-piece">
      <div className="artifact-piece-slot">
        {piece.slotShort}
      </div>
      <div className="artifact-piece-main">
        {mainLabel}: {formatStatValue(piece.mainStatKey, piece.mainStatValue)}
      </div>
      <div className="artifact-piece-subs">
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
