const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp();
const db = getDatabase();

const PULL_COST = 10;
const PACK_SIZE = 5;
const RARITIES = ["common", "rare", "epic", "legendary", "mythic"];
const RARITY_INFO = {
  common: { pullChance: 0.50 },
  rare: { pullChance: 0.30 },
  epic: { pullChance: 0.13 },
  legendary: { pullChance: 0.05 },
  mythic: { pullChance: 0.02 },
};

const cards = {
  pyro: [
    ["ember-pup","Ember Pup","Scorch",[4,3,3]],["cinder-fox","Cinder Fox","Flash Step",[6,4,5]],
    ["magma-brute","Magma Brute","Eruption",[9,8,2]],["aurora-phoenix","Aurora Phoenix","Rebirth",[9,5,9]],
    ["infernal-sovereign","Infernal Sovereign","Ashfall Crown",[11,9,8]]
  ],
  hydro: [
    ["tide-minnow","Tide Minnow","Slip Current",[3,4,4]],["tidecaller","Tidecaller","Surge",[5,6,4]],
    ["abyssal-serpent","Abyssal Serpent","Undertow",[8,9,3]],["monsoon-empress","Monsoon Empress","Tidal Wrath",[8,8,7]],
    ["leviathan-of-depths","Leviathan of Depths","Drowning Grasp",[10,11,6]]
  ],
  cryo: [
    ["frost-hare","Frost Hare","Chill Step",[3,3,5]],["glacier-lynx","Glacier Lynx","Numbing Claw",[6,5,4]],
    ["permafrost-warden","Permafrost Warden","Bulwark",[7,10,2]],["winters-herald","Winter's Herald","Absolute Zero",[8,7,8]],
    ["eternal-glacier-queen","Eternal Glacier Queen","Crown of Frost",[9,12,6]]
  ],
  electro: [
    ["spark-mouse","Spark Mouse","Static Nip",[4,2,5]],["stormtail-fox","Stormtail Fox","Chain Spark",[6,4,6]],
    ["voltaic-golem","Voltaic Golem","Overcharge",[9,8,3]],["thunder-sovereign","Thunder Sovereign","Judgment Arc",[9,6,9]],
    ["voidmaw","Voidmaw","Eclipse",[12,8,8]]
  ],
  anemo: [
    ["gust-sprite","Gust Sprite","Tailwind",[3,3,6]],["windrunner-owl","Windrunner Owl","Wide Swirl",[5,4,7]],
    ["gale-djinn","Gale Djinn","Vacuum Wall",[7,6,8]],["skybound-sovereign","Skybound Sovereign","Eye of the Storm",[8,6,10]],
    ["tempest-incarnate","Tempest Incarnate","Maelstrom Crown",[9,7,12]]
  ],
  geo: [
    ["pebble-golem","Pebble Golem","Steady Ground",[4,5,1]],["shardback-tortoise","Shardback Tortoise","Crystal Skin",[5,8,2]],
    ["stoneheart-golem","Stoneheart Golem","Bulwark",[8,9,1]],["titan-of-the-range","Titan of the Range","Mountain's Verdict",[10,10,2]],
    ["sovereign-of-strata","Sovereign of Strata","Bedrock Throne",[10,14,2]]
  ],
  dendro: [
    ["sprout-imp","Sprout Imp","Bud",[3,3,4]],["thornback-boar","Thornback Boar","Bramble Guard",[6,5,4]],
    ["verdant-treant","Verdant Treant","Bloomburst",[7,9,2]],["worldroot-avatar","Worldroot Avatar","Everseed",[8,8,6]],
    ["genesis-bloom","Genesis Bloom","First Spring",[10,10,8]]
  ]
};

const CARDS = Object.entries(cards).flatMap(([element, list]) =>
  list.map((item, i) => ({
    id: item[0], name: item[1], abilityName: item[2], rarity: RARITIES[i], element,
    stats: { power: item[3][0], defense: item[3][1], speed: item[3][2] },
  }))
);

const pools = Object.fromEntries(RARITIES.map((rarity) => [rarity, CARDS.filter((card) => card.rarity === rarity)]));

function pickRarity(pity) {
  const bump = Math.min(0.25, Math.max(0, Number(pity) || 0) * 0.015);
  const weights = RARITIES.map((rarity) =>
    rarity === "common"
      ? Math.max(0.05, RARITY_INFO[rarity].pullChance - bump)
      : RARITY_INFO[rarity].pullChance + bump / (RARITIES.length - 1)
  );
  const total = weights.reduce((a,b) => a+b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < RARITIES.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return RARITIES[i];
  }
  return "common";
}

function pickCard(pity) {
  const rarity = pickRarity(pity);
  const pool = pools[rarity];
  return pool[Math.floor(Math.random() * pool.length)];
}

function earnedPoints(userId, racingScore, meltDamage) {
  return Math.max(0,
    Math.floor((Number(racingScore) || 0) / 100) +
    Math.floor((Number(meltDamage) || 0) / 500)
  );
}

exports.openElementalsPack = onCall(
  { region: "asia-southeast1", enforceAppCheck: false },
  async (request) => {
    if (!request.auth?.uid || request.auth.token.email_verified !== true) {
      throw new HttpsError("unauthenticated", "A verified account is required.");
    }

    const uid = request.auth.uid;
    const [profileSnap, racingSnap, artifactSnap, currencySnap] = await Promise.all([
      db.ref(`profiles/${uid}`).once("value"),
      db.ref(`racingLeaderboard/${uid}`).once("value"),
      db.ref(`leaderboard/${uid}`).once("value"),
      db.ref(`cardCurrency/${uid}`).once("value"),
    ]);

    const profile = profileSnap.val() || {};
    const racing = racingSnap.val() || {};
    const artifact = artifactSnap.val() || {};
    const currency = currencySnap.val() || {};
    const earned = earnedPoints(uid, racing.score, artifact.meltDamage);
    const spentBefore = Math.max(0, Number(currency.spent) || 0);
    const available = Math.max(0, earned - spentBefore);

    if (available < PULL_COST) {
      throw new HttpsError("failed-precondition", "Not enough Arcade Points.");
    }

    const reserveRef = db.ref(`cardCurrency/${uid}`);
    const reserved = await reserveRef.transaction((current) => {
      const state = current || {};
      const spent = Math.max(0, Number(state.spent) || 0);
      const pity = Math.max(0, Number(state.pityStreak) || 0);
      const liveEarned = earnedPoints(uid, racing.score, artifact.meltDamage);
      if (liveEarned - spent < PULL_COST) return;
      return {
        spent: spent + PULL_COST,
        pityStreak: pity,
        lastPackAt: Date.now(),
      };
    });

    if (!reserved.committed) {
      throw new HttpsError("aborted", "Your Arcade Points changed. Try again.");
    }

    const state = reserved.snapshot.val() || {};
    let pity = Math.max(0, Number(state.pityStreak) || 0);
    const pulled = [];

    for (let i = 0; i < PACK_SIZE; i += 1) {
      const card = pickCard(pity);
      pulled.push(card);
      pity = card.rarity === "common" ? pity + 1 : 0;
    }

    await reserveRef.child("pityStreak").set(pity);

    const now = Date.now();
    const updates = {};
    for (const card of pulled) {
      const ref = db.ref(`cardCollection/${uid}/${card.id}`);
      const snap = await ref.once("value");
      const current = snap.val() || {};
      updates[`cardCollection/${uid}/${card.id}`] = {
        count: (Number(current.count) || 0) + 1,
        firstObtainedAt: Number(current.firstObtainedAt) || now,
      };
    }
    await db.ref().update(updates);

    return {
      cards: pulled.map((card) => ({
        id: card.id, name: card.name, rarity: card.rarity, element: card.element,
        stats: card.stats, ability: { name: card.abilityName, description: "Uses its elemental ability in duels." },
        category: "creature", flavorText: "A unique elemental card in the Genesis set.", imageUrl: null,
      })),
      remainingPoints: Math.max(0, earned - (Number(state.spent) || 0)),
      playerName: String(profile.displayName || request.auth.token.name || "Player"),
    };
  }
);
