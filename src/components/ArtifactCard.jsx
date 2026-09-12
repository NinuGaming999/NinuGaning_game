import ArtifactPieceCard from './ArtifactPieceCard';
import { SLOT_ORDER } from '../utils/artifactData';

export default function ArtifactCard({ roll }) {
  if (!roll) {
    return (
      <div className="w-full max-w-[440px] min-h-[380px] md:min-h-[450px] bg-gradient-to-b from-[#2D2D2D] to-[#1A1A1A] border-2 border-[#FF2E2E] rounded-xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-center text-center">
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
      className="w-full max-w-[440px] bg-gradient-to-b from-[#2D2D2D] to-[#1A1A1A] border-2 border-[#FF2E2E] rounded-xl p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative"
      style={{ animation: 'fadeIn 0.5s ease-out' }}
    >
      <span
        className="absolute top-4 right-4 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide"
        style={{ color: rarity.textColor, border: `1px solid ${rarity.textColor}`, animation: 'popIn 0.2s ease-out' }}
      >
        {rarity.emoji} {rarity.name.toUpperCase()}
      </span>

      <h2 className="text-white text-lg md:text-xl font-bold text-center mb-4">
        ✨ Artifact Set Result ✨
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {SLOT_ORDER.map((slotKey) => (
          <ArtifactPieceCard key={slotKey} piece={pieces[slotKey]} />
        ))}
      </div>

      <hr className="border-[#3D3D3D] mb-3" />

      <div className="flex justify-between text-[#FFD700] text-sm">
        <span>Physical Damage:</span>
        <span>{physicalDamage.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-[#FFD700] text-lg font-bold mt-1">
        <span>Melt Damage:</span>
        <span>{meltDamage.toLocaleString()} ⭐</span>
      </div>
    </div>
  );
}
