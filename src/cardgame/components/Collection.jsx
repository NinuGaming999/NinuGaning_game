import { useMemo, useState } from 'react';
import { CARDS, ELEMENTS, ELEMENT_INFO } from '../data/cards';
import { CardFace } from './CardFace';
import { ElementIcon } from './ElementIcon';
function LockedCard({ card }) { return <div className="rounded-2xl p-2.5 border border-white/10 bg-white/[0.03]"><div className="w-full aspect-[3/4] rounded-xl bg-black/40 flex items-center justify-center opacity-40"><ElementIcon element={card.element} size={32} /></div><div className="mt-2 text-[10px] font-bold text-white/30 uppercase tracking-wider text-center">Undiscovered</div></div>; }
export function Collection({ collection, onSelectCard, onOpenPack }) {
  const [filter,setFilter]=useState('all');
  const ownedCount=Object.keys(collection).length;
  const visibleCards=useMemo(()=>filter==='all'?CARDS:CARDS.filter(c=>c.element===filter),[filter]);
  return <div className="w-full max-w-5xl mx-auto px-4 pb-24">
    <div className="flex items-center justify-between flex-wrap gap-3 mb-4"><h2 className="text-lg font-black text-white">Collection <span className="text-white/40 font-normal text-sm">({ownedCount}/{CARDS.length})</span></h2><button onClick={onOpenPack} className="px-4 py-1.5 rounded-full bg-[#19d3ff] text-black text-xs font-bold">Open a pack</button></div>
    <div className="flex gap-2 mb-4 overflow-x-auto pb-1"><button onClick={()=>setFilter('all')} className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${filter==='all'?'bg-white text-black border-white':'border-white/20 text-white/60'}`}>All</button>{ELEMENTS.map(el=><button key={el} onClick={()=>setFilter(el)} className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${filter===el?'text-black':'border-white/20 text-white/60'}`} style={filter===el?{background:ELEMENT_INFO[el].color,borderColor:ELEMENT_INFO[el].color}:undefined}><ElementIcon element={el} size={12}/>{ELEMENT_INFO[el].label}</button>)}</div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{visibleCards.map(card=>{const owned=collection[card.id]; return owned?<CardFace key={card.id} card={card} count={owned.count} onClick={()=>onSelectCard(card)}/>:<LockedCard key={card.id} card={card}/>})}</div>
  </div>;
}
