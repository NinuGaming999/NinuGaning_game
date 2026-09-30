export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_INFO = {
  common: { label: 'Common', color: '#a8b0ba', chance: 0.60 },
  rare: { label: 'Rare', color: '#4fb0ff', chance: 0.30 },
  epic: { label: 'Epic', color: '#b06bff', chance: 0.065 },
  legendary: { label: 'Legendary', color: '#ffb84f', chance: 0.0025 },
  mythic: { label: 'Mythic', color: '#ff4f8b', chance: 0.0001 },
};

export const ELEMENTS = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'];

export const ELEMENT_INFO = {
  pyro: { label: 'Pyro', icon: '🔥', color: '#ff5e3a' },
  hydro: { label: 'Hydro', icon: '💧', color: '#3ab4ff' },
  cryo: { label: 'Cryo', icon: '❄️', color: '#8fe8ff' },
  electro: { label: 'Electro', icon: '⚡', color: '#b06bff' },
  anemo: { label: 'Anemo', icon: '🌪️', color: '#5df2c0' },
  geo: { label: 'Geo', icon: '🪨', color: '#ffcb4f' },
  dendro: { label: 'Dendro', icon: '🌿', color: '#8fd94f' },
};

const CARD_NAMES = {
  pyro: ['Ember Pup', 'Cinder Fox', 'Flame Drake', 'Pyro Archon', 'THE Goat'],
  hydro: ['Bubble Finch', 'Tide Otter', 'Raincaller', 'cuti', 'THE Trylune'],
  cryo: ['Frost Cub', 'Snow Hare', 'Glacier Wolf', 'The MOST CUTE WIFE', 'Momyyyyyyy'],
  electro: ['Spark Mouse', 'Volt Mantis', 'Storm Lynx', 'Marin Wifee', 'Ronovaaaa'],
  anemo: ['Gale Finch', 'Breeze Fox', 'Sky Stalker', 'Pure white', 'Wind Sovereign'],
  geo: ['Pebble Crab', 'Stone Ram', 'Quartz Golem', 'Xu Qing', 'Geo Colossus'],
  dendro: ['Sprout Slime', 'Moss Boar', 'Vine Stalker', 'Bloom Serpent', 'Verdant Ancient'],
};

const ABILITIES = {
  common: ['Quick Strike', 'Guard', 'Tactical Move', 'Element Burst', 'Focus'],
  rare: ['Piercing Blow', 'Counter', 'Swift Current', 'Element Burst+', 'Harden'],
  epic: ['Overload', 'Reversal', 'Predator', 'Arcane Surge', 'Fortify'],
  legendary: ['World Breaker', 'Rebirth', 'Flash Step', 'Crystal Skin', 'Everseed'],
  mythic: ['Cataclysm', 'Eternal Core', 'Perfect Counter', 'Astral Rush', 'Primal Bloom'],
};

const ABILITY_TEXT = {
  'Quick Strike': 'Deals a little extra damage when you attack first.',
  Guard: 'Reduces the first incoming hit.',
  'Tactical Move': 'Builds a speed advantage for the next turn.',
  'Element Burst': 'Your elemental hit is slightly stronger.',
  Focus: 'Stable damage with no drawback.',
  'Piercing Blow': 'Ignores part of the opponent defense.',
  Counter: 'Sometimes reflects part of the damage received.',
  'Swift Current': 'Speed helps this card win ties.',
  'Element Burst+': 'Strong elemental damage.',
  Harden: 'Starts the duel with a small shield.',
  Overload: 'Heavy opening hit with a cooldown.',
  Reversal: 'Gets stronger after dropping below half HP.',
  Predator: 'Deals bonus damage to wounded targets.',
  'Arcane Surge': 'Big damage after a successful reaction.',
  Fortify: 'Temporarily increases defense.',
  'World Breaker': 'Massive burst damage once per duel.',
  Rebirth: 'Revives once with a small amount of HP.',
  'Flash Step': 'Almost always attacks first on turn one.',
  'Crystal Skin': 'Starts with a strong shield.',
  Everseed: 'Revives once with more HP than Rebirth.',
  Cataclysm: 'Huge opening attack.',
  'Eternal Core': 'Recovers a little HP each turn.',
  'Perfect Counter': 'Blocks the first hit and retaliates.',
  'Astral Rush': 'Fast card that scales with speed.',
  'Primal Bloom': 'Reaction damage is greatly amplified.',
};

const RARITY_STAT_BASE = {
  common: 12,
  rare: 17,
  epic: 23,
  legendary: 30,
  mythic: 38,
};

const ELEMENT_OFFSETS = {
  pyro: [2, 0, 1],
  hydro: [1, 1, 1],
  cryo: [0, 2, 1],
  electro: [1, 0, 2],
  anemo: [0, 1, 2],
  geo: [0, 3, 0],
  dendro: [2, 1, 0],
};

export const CARDS = ELEMENTS.flatMap((element) => (
  CARD_NAMES[element].map((name, index) => {
    const rarity = RARITIES[index];
    const base = RARITY_STAT_BASE[rarity];
    const [p, d, s] = ELEMENT_OFFSETS[element];
    const abilityName = ABILITIES[rarity][index];
    return {
      id: `${element}-${index + 1}`,
      name,
      rarity,
      element,
      category: 'creature',
      stats: {
        power: base + p + index,
        defense: base + d + (4 - index),
        speed: base + s + ((index % 2) * 2),
      },
      ability: { name: abilityName, description: ABILITY_TEXT[abilityName] },
      flavorText: `A ${ELEMENT_INFO[element].label.toLowerCase()} champion from the first Elementals set.`,
      releaseSet: 'Origins',
    };
  })
));

export const CARD_BY_ID = Object.fromEntries(CARDS.map((card) => [card.id, card]));
