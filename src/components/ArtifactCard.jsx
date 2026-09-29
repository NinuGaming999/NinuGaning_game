import ArtifactPieceCard from './ArtifactPieceCard';
import { SLOT_ORDER } from '../utils/artifactData';

export default function ArtifactCard({ roll }) {
  if (!roll) {
    return (
      <div className="artifact-result artifact-empty">
        <p className="text-[#CCCCCC] text-sm">
          Enter your name and roll to get a full 5-piece artifact set: Flower, Feather, Sands,
          Goblet, and Circlet.
        </p>
      </div>
    );
  }

  const { pieces, rarity, physicalDamage, meltDamage } = roll;

  return (
    <div
      key={roll.rollId}
      className="artifact-result"
      style={{ animation: 'fadeIn 0.5s ease-out' }}
    >
      <span
        className="absolute top-4 right-4 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide"
        style={{ color: rarity.textColor, border: `1px solid ${rarity.textColor}`, animation: 'popIn 0.2s ease-out' }}
      >
        {rarity.emoji} {rarity.name.toUpperCase()}
      </span>

      <h2 className="artifact-result-title">
        ✨ Artifact Set Result ✨
      </h2>

      <div className="artifact-piece-grid">
        {SLOT_ORDER.map((slotKey) => (
          <ArtifactPieceCard key={slotKey} piece={pieces[slotKey]} />
        ))}
      </div>

      <hr className="border-[#3D3D3D] mb-3" />

      <div className="artifact-damage-row">
        <span>Physical Damage:</span>
        <span>{physicalDamage.toLocaleString()}</span>
      </div>
      <div className="artifact-damage-row melt">
        <span>Melt Damage:</span>
        <span>{meltDamage.toLocaleString()} ⭐</span>
      </div>
    </div>
  );
}
