import { useCallback, useEffect, useMemo, useState } from 'react';
import { CARDS, CARD_BY_ID, ELEMENT_INFO, RARITIES, RARITY_INFO } from './cards';
import {
  addCardsToCollection,
  spendArcadePoints,
  subscribeToArcadePoints,
  subscribeToCollection,
} from './cardService';

const PACK_SIZE = 5;
const PACK_COST = 10;

const REACTIONS = {
  'pyro+hydro': ['Vaporize', 1.5],
  'hydro+pyro': ['Vaporize', 1.5],
  'pyro+cryo': ['Melt', 1.5],
  'cryo+pyro': ['Melt', 1.5],
  'pyro+electro': ['Overloaded', 1.35],
  'electro+pyro': ['Overloaded', 1.35],
  'hydro+cryo': ['Frozen', 1.25],
  'cryo+hydro': ['Frozen', 1.25],
  'hydro+electro': ['Electro-Charged', 1.3],
  'electro+hydro': ['Electro-Charged', 1.3],
  'cryo+electro': ['Superconduct', 1.2],
  'electro+cryo': ['Superconduct', 1.2],
  'pyro+dendro': ['Burning', 1.3],
  'dendro+pyro': ['Burning', 1.3],
  'hydro+dendro': ['Bloom', 1.3],
  'dendro+hydro': ['Bloom', 1.3],
  'electro+dendro': ['Quicken', 1.3],
  'dendro+electro': ['Quicken', 1.3],
  'geo+pyro': ['Crystallize', 1.12],
  'pyro+geo': ['Crystallize', 1.12],
  'geo+hydro': ['Crystallize', 1.12],
  'hydro+geo': ['Crystallize', 1.12],
  'geo+cryo': ['Crystallize', 1.12],
  'cryo+geo': ['Crystallize', 1.12],
  'geo+electro': ['Crystallize', 1.12],
  'electro+geo': ['Crystallize', 1.12],
  'geo+dendro': ['Crystallize', 1.12],
  'dendro+geo': ['Crystallize', 1.12],
};

function pickRarity() {
  const roll = Math.random();
  let cursor = 0;
  for (const rarity of RARITIES) {
    cursor += RARITY_INFO[rarity].chance;
    if (roll <= cursor) return rarity;
  }
  return 'common';
}

function openPack() {
  const cards = [];
  for (let i = 0; i < PACK_SIZE; i += 1) {
    const rarity = pickRarity();
    const pool = CARDS.filter((card) => card.rarity === rarity);
    cards.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return cards;
}

function reactionFor(attackerElement, defenderElement) {
  return REACTIONS[`${attackerElement}+${defenderElement}`] || null;
}

function simulateBattle(player, enemy) {
  let pHp = 20 + player.stats.defense * 6;
  let eHp = 20 + enemy.stats.defense * 6;
  let pShield = player.ability.name === 'Crystal Skin' ? 10 : 0;
  let eShield = enemy.ability.name === 'Crystal Skin' ? 10 : 0;
  let pRevived = false;
  let eRevived = false;
  let pElement = null;
  let eElement = null;
  const log = [];

  for (let turn = 1; turn <= 12 && pHp > 0 && eHp > 0; turn += 1) {
    const playerFirst = turn === 1
      ? (player.ability.name === 'Flash Step' || player.stats.speed >= enemy.stats.speed)
      : (player.stats.speed + Math.random() * 5 >= enemy.stats.speed + Math.random() * 5);

    const attack = (attacker, defender, hp, shield, appliedElement, label) => {
      const otherElement = appliedElement;
      const reaction = reactionFor(attacker.element, otherElement);
      const bonus = reaction ? reaction[1] : 1;
      let damage = Math.max(2, Math.round(6 + attacker.stats.power * 1.6 - defender.stats.defense * 0.5));
      if (attacker.ability.name === 'World Breaker' && turn === 1) damage += 12;
      if (attacker.ability.name === 'Cataclysm' && turn === 1) damage += 14;
      if (attacker.ability.name === 'Predator' && hp < (20 + defender.stats.defense * 6) / 2) damage += 7;
      if (attacker.ability.name === 'Element Burst' || attacker.ability.name === 'Element Burst+') damage = Math.round(damage * 1.12);
      if (attacker.ability.name === 'Primal Bloom' && reaction) damage = Math.round(damage * 1.2);
      if (reaction) damage = Math.round(damage * bonus);

      let nextShield = shield;
      let dealt = damage;
      if (nextShield > 0) {
        const blocked = Math.min(nextShield, dealt);
        nextShield -= blocked;
        dealt -= blocked;
      }
      if (defender.ability.name === 'Guard' && turn === 1 && dealt > 0) dealt = Math.max(1, dealt - 8);
      if (defender.ability.name === 'Bulwark' && turn === 1 && dealt > 0) dealt = 0;

      const nextHp = hp - dealt;
      log.push(`Turn ${turn}: ${label} deals ${dealt} damage${reaction ? ` — ${reaction[0]}!` : '.'}`);
      return { hp: nextHp, shield: nextShield };
    };

    if (playerFirst) {
      const result = attack(player, enemy, eHp, eShield, pElement, player.name);
      eHp = result.hp; eShield = result.shield; eElement = player.element;
      if (eHp <= 0 && enemy.ability.name === 'Rebirth' && !eRevived) {
        eRevived = true; eHp = Math.max(1, Math.round((20 + enemy.stats.defense * 6) * 0.15));
        log.push(`${enemy.name} revives with ${eHp} HP.`);
      }
      if (eHp > 0) {
        const back = attack(enemy, player, pHp, pShield, eElement, enemy.name);
        pHp = back.hp; pShield = back.shield; pElement = enemy.element;
      }
    } else {
      const back = attack(enemy, player, pHp, pShield, eElement, enemy.name);
      pHp = back.hp; pShield = back.shield; pElement = enemy.element;
      if (pHp > 0) {
        const result = attack(player, enemy, eHp, eShield, pElement, player.name);
        eHp = result.hp; eShield = result.shield; eElement = player.element;
      }
    }

    if (pHp <= 0 && player.ability.name === 'Everseed' && !pRevived) {
      pRevived = true; pHp = Math.max(1, Math.round((20 + player.stats.defense * 6) * 0.30));
      log.push(`${player.name} revives with ${pHp} HP.`);
    }
    if (eHp <= 0 && enemy.ability.name === 'Everseed' && !eRevived) {
      eRevived = true; eHp = Math.max(1, Math.round((20 + enemy.stats.defense * 6) * 0.30));
      log.push(`${enemy.name} revives with ${eHp} HP.`);
    }
  }

  return {
    playerWon: pHp > 0 && eHp <= 0,
    playerHp: Math.max(0, pHp),
    enemyHp: Math.max(0, eHp),
    log,
  };
}

function CardTile({ card, count = 0, onClick, compact = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const rarity = RARITY_INFO[card.rarity];
  const el = ELEMENT_INFO[card.element];
  const artSrc = `/cardgame/cards/${card.id}.png`;
  const artSize = compact ? 'h-28' : 'h-40';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border bg-[#0c1017] overflow-hidden transition hover:-translate-y-1 hover:border-white/30 ${compact ? 'p-2' : 'p-3'}`}
      style={{ borderColor: `${rarity.color}66` }}
    >
      <div
        className={`relative rounded-xl flex items-center justify-center overflow-hidden ${artSize}`}
        style={{ background: `radial-gradient(circle at 30% 20%, ${el.color}66, transparent 45%), linear-gradient(145deg, #121822, ${rarity.color}22)` }}
      >
        {!imageFailed ? (
          <img
            src={artSrc}
            alt=""
            className="w-full h-full object-contain p-2"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="text-5xl" aria-hidden="true">{el.icon}</div>
        )}
        <div className="absolute left-2 top-2 text-[9px] font-black uppercase tracking-widest" style={{ color: rarity.color }}>{rarity.label}</div>
        {count > 0 && <div className="absolute right-2 bottom-2 text-[10px] font-black bg-black/60 rounded-full px-2 py-1">x{count}</div>}
      </div>
      <div className="mt-2">
        <div className="font-black text-sm truncate">{card.name}</div>
        <div className="text-[10px] mt-1" style={{ color: el.color }}>{el.label} • {card.stats.power}/{card.stats.defense}/{card.stats.speed}</div>
      </div>
    </button>
  );
}

export default function CardGame({ initialPlayerName, onBack }) {
  const name = (initialPlayerName || 'Player').trim() || 'Player';
  const [points, setPoints] = useState(0);
  const [collection, setCollection] = useState({});
  const [screen, setScreen] = useState('menu');
  const [pack, setPack] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [duelCardId, setDuelCardId] = useState(null);
  const [battle, setBattle] = useState(null);

  useEffect(() => subscribeToArcadePoints(name, setPoints), [name]);
  useEffect(() => subscribeToCollection(name, setCollection), [name]);

  const ownedCards = useMemo(
    () => CARDS.filter((card) => Number(collection[card.id]?.count) > 0),
    [collection],
  );

  const visibleCards = useMemo(
    () => CARDS.filter((card) => filter === 'all' || card.element === filter),
    [filter],
  );

  const doPack = useCallback(async () => {
    if (busy) return;
    if (points < PACK_COST) {
      setStatus(`You need ${PACK_COST} points. Earn points in Artifact Roll Simulator or Neon Mountain Racer.`);
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const spent = await spendArcadePoints(name, PACK_COST);
      if (!spent) {
        setStatus('The points balance changed. Please try the pack again.');
        return;
      }
      const cards = openPack();
      await addCardsToCollection(name, cards);
      setPack(cards);
      setScreen('opening');
    } catch (error) {
      console.error(error);
      setStatus('Could not open the pack. Check your Firebase Database rules.');
    } finally {
      setBusy(false);
    }
  }, [busy, name, points]);

  const startDuel = () => {
    if (!duelCardId) {
      setStatus('Choose one card first.');
      return;
    }
    const player = CARD_BY_ID[duelCardId];
    const enemyPool = CARDS.filter((card) => card.id !== duelCardId);
    const enemy = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    setBattle({ player, enemy, result: simulateBattle(player, enemy) });
  };

  const uniqueOwned = ownedCards.length;

  return (
    <div className="card-game-page fixed inset-0 overflow-y-auto bg-[#05070a] text-white">
      <header className="card-game-header sticky top-0 z-40 border-b border-white/10 bg-[#05070a]/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <button type="button" onClick={screen === 'menu' ? onBack : () => setScreen('menu')} className="text-white/60 text-sm font-bold">
          ← {screen === 'menu' ? 'NINU GAMING' : 'Elementals Menu'}
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[#ffb84f]/30 bg-[#ffb84f]/10 px-3 py-1.5">
          <span className="text-[#ffb84f]">✦</span>
          <span className="font-black">{points}</span>
          <span className="text-[10px] text-white/40">POINTS</span>
        </div>
      </header>

      <main className="card-game-main max-w-6xl mx-auto p-4 md:p-8">
        {screen === 'menu' && (
          <section className="card-menu-section max-w-3xl mx-auto text-center">
            <div className="text-[10px] uppercase tracking-[0.35em] text-[#19d3ff] font-black">GAME 03</div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mt-2">ELEMENTALS</h1>
            <p className="text-white/50 mt-3 text-sm md:text-base">Build a 35-card elemental collection, open packs with Arcade Points, then test your cards in reaction-based duels.</p>

            <div className="grid md:grid-cols-3 gap-3 mt-8">
              <button type="button" onClick={doPack} disabled={busy} className="rounded-2xl p-5 bg-gradient-to-br from-[#19d3ff] to-[#ff2e9c] text-black font-black md:col-span-2 disabled:opacity-50">
                {busy ? 'OPENING…' : `OPEN 5-CARD PACK · ${PACK_COST} POINTS`}
              </button>
              <button type="button" onClick={() => setScreen('collection')} className="rounded-2xl p-5 border border-white/15 bg-white/5 font-black">
                COLLECTION {uniqueOwned}/{CARDS.length}
              </button>
            </div>

            <button type="button" onClick={() => setScreen('duel')} className="w-full mt-3 rounded-2xl p-4 border border-[#b06bff]/30 bg-[#b06bff]/10 font-black">
              ENTER DUEL ARENA
            </button>

            {status && <div className="mt-4 rounded-xl border border-[#ff914d]/30 bg-[#ff914d]/10 text-[#ffb070] p-3 text-xs">{status}</div>}

            <div className="mt-8 grid sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="text-[10px] text-white/40">PACK</div><div className="font-black mt-1">5 cards</div><div className="text-xs text-white/40 mt-1">10 Arcade Points</div></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="text-[10px] text-white/40">CARDS</div><div className="font-black mt-1">{CARDS.length} total</div><div className="text-xs text-white/40 mt-1">7 elements × 5 rarities</div></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="text-[10px] text-white/40">POINTS</div><div className="font-black mt-1">Live balance</div><div className="text-xs text-white/40 mt-1">Racer score + artifact melt</div></div>
            </div>
          </section>
        )}

        {screen === 'opening' && (
          <section className="card-game-section max-w-5xl mx-auto">
            <div className="text-center"><div className="text-[#19d3ff] text-xs font-black tracking-widest">PACK OPENED</div><h2 className="text-3xl font-black mt-1">YOUR 5 CARDS</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-7">
              {pack.map((card, index) => (
                <div key={`${card.id}-${index}`} className="animate-[fadeIn_.35s_ease-out]" style={{ animationDelay: `${index * 90}ms`, animationFillMode: 'both' }}>
                  <CardTile card={card} count={collection[card.id]?.count || 0} onClick={() => setSelected(card)} />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setScreen('collection')} className="block mx-auto mt-7 rounded-xl bg-white text-black px-6 py-3 font-black">VIEW COLLECTION</button>
          </section>
        )}

        {screen === 'collection' && (
          <section>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div><div className="text-[#19d3ff] text-xs font-black tracking-widest">COLLECTION</div><h2 className="text-3xl font-black mt-1">{uniqueOwned}/{CARDS.length} DISCOVERED</h2></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setFilter('all')} className={`px-3 py-2 rounded-lg text-xs font-black border ${filter === 'all' ? 'bg-white text-black border-white' : 'border-white/15 text-white/60'}`}>ALL</button>
                {Object.entries(ELEMENT_INFO).map(([id, el]) => (
                  <button type="button" key={id} onClick={() => setFilter(id)} className={`px-3 py-2 rounded-lg text-xs font-black border ${filter === id ? 'text-black' : 'border-white/15 text-white/60'}`} style={filter === id ? { background: el.color, borderColor: el.color } : {}}>{el.icon} {el.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-6">
              {visibleCards.map((card) => (
                <CardTile key={card.id} card={card} count={collection[card.id]?.count || 0} onClick={() => setSelected(card)} />
              ))}
            </div>
          </section>
        )}

        {screen === 'duel' && (
          <section className="max-w-5xl mx-auto">
            <div className="text-center"><div className="text-[#b06bff] text-xs font-black tracking-widest">DUEL ARENA</div><h2 className="text-3xl font-black mt-1">CHOOSE YOUR FIGHTER</h2></div>
            {ownedCards.length === 0 ? (
              <div className="max-w-md mx-auto mt-8 text-center rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-white/50 text-sm">You don't own any cards yet.</div>
                <button type="button" onClick={() => setScreen('menu')} className="mt-4 rounded-xl bg-white text-black px-5 py-3 font-black">OPEN A PACK</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
                  {ownedCards.map((card) => (
                    <CardTile key={card.id} card={card} count={collection[card.id]?.count || 0} compact onClick={() => setDuelCardId(card.id)} />
                  ))}
                </div>
                <button type="button" onClick={startDuel} className="block mx-auto mt-6 rounded-xl bg-gradient-to-r from-[#19d3ff] to-[#b06bff] text-black px-7 py-3 font-black">FIGHT RANDOM OPPONENT</button>
              </>
            )}

            {battle && (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#19d3ff]/30 bg-[#19d3ff]/5 p-4">
                    <div className="text-xs text-[#19d3ff]">YOU</div>
                    <div className="text-xl font-black mt-1">{battle.player.name}</div>
                    <div className="text-xs text-white/50 mt-1">{ELEMENT_INFO[battle.player.element].icon} {ELEMENT_INFO[battle.player.element].label} • {battle.result.playerHp} HP left</div>
                  </div>
                  <div className="rounded-xl border border-[#ff4f8b]/30 bg-[#ff4f8b]/5 p-4">
                    <div className="text-xs text-[#ff4f8b]">OPPONENT</div>
                    <div className="text-xl font-black mt-1">{battle.enemy.name}</div>
                    <div className="text-xs text-white/50 mt-1">{ELEMENT_INFO[battle.enemy.element].icon} {ELEMENT_INFO[battle.enemy.element].label} • {battle.result.enemyHp} HP left</div>
                  </div>
                </div>
                <div className={`text-center text-2xl font-black mt-5 ${battle.result.playerWon ? 'text-[#5df2c0]' : 'text-[#ff7b8a]'}`}>
                  {battle.result.playerWon ? 'VICTORY' : 'DEFEAT'}
                </div>
                <div className="mt-4 space-y-1 max-h-60 overflow-y-auto rounded-xl bg-black/20 p-4 text-xs text-white/60">
                  {battle.result.log.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b0e14] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="text-5xl text-center">{ELEMENT_INFO[selected.element].icon}</div>
            <div className="text-xs text-center mt-3 uppercase tracking-widest" style={{ color: RARITY_INFO[selected.rarity].color }}>{RARITY_INFO[selected.rarity].label}</div>
            <h3 className="text-2xl text-center font-black mt-1">{selected.name}</h3>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="rounded-lg bg-white/5 p-3 text-center"><div className="text-[9px] text-white/40">POWER</div><div className="font-black mt-1">{selected.stats.power}</div></div>
              <div className="rounded-lg bg-white/5 p-3 text-center"><div className="text-[9px] text-white/40">DEF</div><div className="font-black mt-1">{selected.stats.defense}</div></div>
              <div className="rounded-lg bg-white/5 p-3 text-center"><div className="text-[9px] text-white/40">SPEED</div><div className="font-black mt-1">{selected.stats.speed}</div></div>
            </div>
            <div className="mt-4 rounded-xl bg-white/5 p-4"><div className="font-black text-sm text-[#19d3ff]">{selected.ability.name}</div><div className="text-xs text-white/50 mt-1">{selected.ability.description}</div></div>
            <button type="button" onClick={() => setSelected(null)} className="w-full mt-4 rounded-xl border border-white/15 py-3 font-black">CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}
