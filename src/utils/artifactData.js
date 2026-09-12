// Central reference data for the 5 real artifact slots, their possible main
// stats, fixed max-level (5-star, Lv.20) main stat values, and the 10
// possible substats with their per-roll ranges.

// isPercent controls display formatting for every stat key used anywhere
// in the app (main stats AND substats share this table).
export const STAT_DISPLAY = {
  hpFlat: { label: 'HP', isPercent: false },
  atkFlat: { label: 'ATK', isPercent: false },
  defFlat: { label: 'DEF', isPercent: false },
  hpPercent: { label: 'HP%', isPercent: true },
  atkPercent: { label: 'ATK%', isPercent: true },
  defPercent: { label: 'DEF%', isPercent: true },
  elementalMastery: { label: 'Elemental Mastery', isPercent: false },
  energyRecharge: { label: 'Energy Recharge', isPercent: true },
  critRate: { label: 'CRIT Rate', isPercent: true },
  critDmg: { label: 'CRIT DMG', isPercent: true },
  pyroDmgBonus: { label: 'Pyro DMG Bonus', isPercent: true },
  physDmgBonus: { label: 'Physical DMG Bonus', isPercent: true },
  healingBonus: { label: 'Healing Bonus', isPercent: true },
};

// The 10 stats that are allowed to appear as SUBSTATS, with their 5-star
// per-roll min/max range. Elemental/Physical DMG% and Healing Bonus are
// intentionally absent — in the real game those can only ever be main
// stats, never substats.
export const SUBSTAT_ROLL_RANGES = {
  hpFlat: { min: 209.13, max: 298.75 },
  atkFlat: { min: 13.62, max: 19.45 },
  defFlat: { min: 16.28, max: 23.15 },
  hpPercent: { min: 0.047, max: 0.058 },
  atkPercent: { min: 0.047, max: 0.058 },
  defPercent: { min: 0.058, max: 0.073 },
  elementalMastery: { min: 16, max: 23 },
  energyRecharge: { min: 0.054, max: 0.065 },
  critRate: { min: 0.031, max: 0.039 },
  critDmg: { min: 0.062, max: 0.078 },
};

// Fixed max-level (5-star, Lv.20) values for every possible MAIN stat.
export const MAIN_STAT_VALUES = {
  hpFlat: 4780,
  atkFlat: 311,
  hpPercent: 0.466,
  atkPercent: 0.466,
  defPercent: 0.583,
  elementalMastery: 187,
  energyRecharge: 0.518,
  pyroDmgBonus: 0.466,
  physDmgBonus: 0.583,
  critRate: 0.311,
  critDmg: 0.622,
  healingBonus: 0.359,
};

// The 5 real artifact slots and the rules for what main stat each can roll.
// Flower/Feather have ONE fixed main stat. The other three pick randomly
// from a slot-specific pool — note Goblet is the only slot that can roll
// elemental (Pyro) or physical DMG%, and Circlet is the only slot that can
// roll CRIT Rate/DMG or Healing Bonus as a MAIN stat.
export const SLOT_DEFINITIONS = {
  flower: {
    name: 'Flower of Life',
    short: 'Flower',
    fixedMain: 'hpFlat',
  },
  feather: {
    name: 'Plume of Death',
    short: 'Feather',
    fixedMain: 'atkFlat',
  },
  sands: {
    name: 'Sands of Eon',
    short: 'Sands',
    mainOptions: ['hpPercent', 'atkPercent', 'defPercent', 'elementalMastery', 'energyRecharge'],
  },
  goblet: {
    name: 'Goblet of Eonothem',
    short: 'Goblet',
    mainOptions: ['hpPercent', 'atkPercent', 'defPercent', 'elementalMastery', 'pyroDmgBonus', 'physDmgBonus'],
  },
  circlet: {
    name: 'Circlet of Logos',
    short: 'Circlet',
    mainOptions: ['hpPercent', 'atkPercent', 'defPercent', 'elementalMastery', 'critRate', 'critDmg', 'healingBonus'],
  },
};

export const SLOT_ORDER = ['flower', 'feather', 'sands', 'goblet', 'circlet'];
