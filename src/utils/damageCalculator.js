// Fixed character stats for Arlecchino (Lv.90, Ouranos Standard) — do not change.
export const BASE_ATK = 1189; // character + weapon base ATK, before artifacts
export const BASE_CRIT_RATE = 0.2; // 20%
export const BASE_CRIT_DMG = 0.5; // 50%
export const BASE_PYRO_DMG = 0.288; // 28.8%
export const PHYSICAL_BONUS = 0.384; // 38.4%

/**
 * Calculates Physical First Hit damage and Melt (Pyro) damage from an
 * aggregated artifact-set totals object (see artifactRoller.aggregateArtifactSet).
 *
 * Total ATK follows the standard stat-calc order: base ATK is scaled by
 * total ATK% first, then flat ATK bonuses (Feather's main stat + any ATK
 * substats) are added on top.
 *
 * Physical/Pyro DMG bonus and CRIT stats are the character's fixed base
 * values plus whatever the artifacts contributed — a Goblet that rolled
 * Pyro DMG% as its main stat, a Circlet that rolled CRIT Rate/DMG, etc.
 * If the Goblet rolled something else entirely (say, DEF%), that piece
 * contributes nothing to the Pyro DMG bonus — same as it would in-game.
 */
export function calculateDamage(totals) {
  const totalATK = BASE_ATK * (1 + (totals.atkPercent || 0)) + (totals.atkFlat || 0);
  const critRate = BASE_CRIT_RATE + (totals.critRate || 0);
  const critDmg = BASE_CRIT_DMG + (totals.critDmg || 0);
  const physicalBonus = PHYSICAL_BONUS + (totals.physDmgBonus || 0);
  const pyroDmg = BASE_PYRO_DMG + (totals.pyroDmgBonus || 0);

  const physicalDamage = Math.round(
    totalATK * 1.3 * (1 + critRate * critDmg) * (1 + physicalBonus)
  );

  const meltDamage = Math.round(
    totalATK * 0.95 * (1 + critRate * critDmg) * (1 + pyroDmg) * 2.0
  );

  return { totalATK, physicalDamage, meltDamage, critRate, critDmg, pyroDmg, physicalBonus };
}
