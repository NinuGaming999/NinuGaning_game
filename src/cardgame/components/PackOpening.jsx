import { useState } from 'react';
import { CardFace } from './CardFace';
import { RARITY_INFO } from '../data/cards';
function FlipCard({ card, revealed, onReveal }) {
  const rarity = RARITY_INFO[card.rarity];
  const isRare = ['epic','legendary','mythic'].includes(card.rarity);
  return <div className="[perspective:1000px] w-full"><div onClick={!revealed ? onReveal : undefined} className={`relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${!revealed ? 'cursor-pointer' : ''}`} style={{ transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
    <div className="w-full aspect-[3/4] rounded-2xl flex items-center justify-center [backface-visibility:hidden] border border-white/15" style={{ background: 'linear-gradient(160deg, #141a24, #05070a)' }}><div className="text-4xl opacity-70">✦</div></div>
    <div className="absolute inset-0 [backface-visibility:hidden] rounded-2xl" style={{ transform: 'rotateY(180deg)' }}><div className={isRare && revealed ? 'animate-pulse' : ''} style={isRare ? { filter: `drop-shadow(0 0 18px ${rarity.color}aa)` } : undefined}><CardFace card={card} count={1} /></div></div>
  </div></div>;
}
export function PackOpening({ cards, onDone }) {
  const [revealed, setRevealed] = useState(() => cards.map(() => false));
  const allRevealed = revealed.every(Boolean);
  const revealOne = (i) => setRevealed((r) => { const next = [...r]; next[i] = true; return next; });
  return <div className="flex flex-col items-center gap-6 w-full max-w-3xl mx-auto px-4"><h2 className="text-xl font-black tracking-wide text-white">Your pull</h2><div className="grid grid-cols-3 sm:grid-cols-5 gap-3 w-full">{cards.map((card,i)=><FlipCard key={i} card={card} revealed={revealed[i]} onReveal={()=>revealOne(i)} />)}</div><div className="flex gap-3">{!allRevealed && <button onClick={()=>setRevealed(cards.map(()=>true))} className="px-5 py-2 rounded-lg border border-white/30 text-white text-sm font-bold">Reveal all</button>}<button onClick={onDone} disabled={!allRevealed} className={`px-6 py-2 rounded-lg text-sm font-bold ${allRevealed ? 'bg-[#19d3ff] text-black' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>Continue</button></div></div>;
}
