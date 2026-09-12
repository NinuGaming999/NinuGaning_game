import { SLOT_DEFINITIONS, SLOT_ORDER, MAIN_STAT_VALUES, SUBSTAT_ROLL_RANGES } from './artifactData';

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randomRollCount() {
  // Each substat is upgraded 3-6 times over the artifact's lifetime.
  return Math.floor(Math.random() * 4) + 3;
}

function pickMainStat(slotKey) {
  const def = SLOT_DEFINITIONS[slotKey];
  if (def.fixedMain) return def.fixedMain;
  const options = def.mainOptions;
  return options[Math.floor(Math.random() * options.length)];
}

// A substat can never be the same stat as that piece's main stat (e.g. a
// Circlet with CRIT Rate as its main can't also roll CRIT Rate as a
// substat). Everything else in the 10-stat pool is fair game.
function pickSubstatKeys(mainStatKey) {
  const pool = Object.keys(SUBSTAT_ROLL_RANGES).filter((key) => key !== mainStatKey);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

/** Rolls a single artifact piece for the given slot ('flower', 'feather', 'sands', 'goblet', 'circlet'). */
export function rollArtifactPiece(slotKey) {
  const def = SLOT_DEFINITIONS[slotKey];
  const mainStatKey = pickMainStat(slotKey);
  const mainStatValue = MAIN_STAT_VALUES[mainStatKey];

  const chosenKeys = pickSubstatKeys(mainStatKey);
  const substats = {};
  const rollCounts = {};

  chosenKeys.forEach((key) => {
    const { min, max } = SUBSTAT_ROLL_RANGES[key];
    const rollCount = randomRollCount();
    let total = 0;
    for (let i = 0; i < rollCount; i += 1) {
      total += randomInRange(min, max);
    }
    substats[key] = total;
    rollCounts[key] = rollCount;
  });

  return {
    slotKey,
    slotName: def.name,
    slotShort: def.short,
    mainStatKey,
    mainStatValue,
    chosenKeys,
    substats,
    rollCounts,
  };
}

/** Rolls all 5 pieces at once: Flower, Feather, Sands, Goblet, Circlet. */
export function rollArtifactSet() {
  const pieces = {};
  SLOT_ORDER.forEach((slotKey) => {
    pieces[slotKey] = rollArtifactPiece(slotKey);
  });
  return pieces;
}

/**
 * Sums every piece's main stat + substats into one totals object, keyed by
 * stat type. This is what feeds the damage calculator and the stat cards.
 */
export function aggregateArtifactSet(pieces) {
  const totals = {
    hpFlat: 0,
    hpPercent: 0,
    atkFlat: 0,
    atkPercent: 0,
    defFlat: 0,
    defPercent: 0,
    elementalMastery: 0,
    energyRecharge: 0,
    critRate: 0,
    critDmg: 0,
    pyroDmgBonus: 0,
    physDmgBonus: 0,
    healingBonus: 0,
  };

  Object.values(pieces).forEach((piece) => {
    totals[piece.mainStatKey] = (totals[piece.mainStatKey] || 0) + piece.mainStatValue;
    Object.entries(piece.substats).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + value;
    });
  });

  return totals;
}
