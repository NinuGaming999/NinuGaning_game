/**
 * Determines the rarity tier + display colors/emoji for a given melt damage
 * score. Melt damage is always the leaderboard-ranking score.
 *
 * Thresholds were recalibrated (via a 200k-roll Monte Carlo simulation of
 * the realistic 5-piece artifact system) to roughly:
 *   Legendary ~ top 5%, Epic ~ next 10%, Rare ~ next 35%,
 *   Uncommon ~ next 30%, Common ~ bottom 20%.
 * Real distribution: min ~4,200 / median ~10,250 / max ~33,000+.
 */
export function getRarity(meltDamage) {
  if (meltDamage > 16000) {
    return { name: 'Legendary', textColor: '#B24BF3', emoji: '🟣' };
  }
  if (meltDamage > 13000) {
    return { name: 'Epic', textColor: '#FFA500', emoji: '🟡' };
  }
  if (meltDamage > 10000) {
    return { name: 'Rare', textColor: '#22D3EE', emoji: '🔵' };
  }
  if (meltDamage > 8000) {
    return { name: 'Uncommon', textColor: '#22C55E', emoji: '🟢' };
  }
  return { name: 'Common', textColor: '#9CA3AF', emoji: '⚪' };
}
