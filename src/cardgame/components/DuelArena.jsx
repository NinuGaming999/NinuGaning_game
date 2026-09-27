import { useMemo, useState } from 'react';
import { CARDS } from '../data/cards';
import { CardFace } from './CardFace';
import { simulateDuel } from '../engine/duel';
function pickOpponent(id){const pool=CARDS.filter(c=>c.id!==id);return pool[Math.floor(Math.random()*pool.length)];}
export function DuelArena({collection,onExit}){
 const [phase,setPhase]=useState('select'),[myCard,setMyCard]=useState(null),[opponent,setOpponent]=useState(null),[result,setResult]=useState(null);
 const owned=useMemo(()=>CARDS.filter(c=>collection[c.id]),[collection]);
 const start=c=>{setMyCard(c);setOpponent(pickOpponent(c.id));setPhase('vs');};
 if(phase==='select') return <div className="w-full max-w-4xl mx-auto px-4 pb-24"><div className="flex justify-between mb-4"><h2 className="text-lg font-black text-white">Choose your card</h2><button onClick={onExit} className="text-white/50 text-sm">← Back</button></div>{!owned.length?<div className="text-white/50 text-sm py-12 text-center">Pull a few cards first, then duel.</div>:<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{owned.map(c=><CardFace key={c.id} card={c} count={collection[c.id].count} onClick={()=>start(c)}/>)}</div>}</div>;
 if(phase==='vs') return <div className="w-full max-w-2xl mx-auto px-4 flex flex-col items-center gap-6"><h2 className="text-lg font-black text-white">Gauntlet opponent found</h2><div className="grid grid-cols-2 gap-4 w-full"><CardFace card={myCard} count={1}/><CardFace card={opponent} count={1}/></div><div className="flex gap-3"><button onClick={()=>setPhase('select')} className="px-5 py-2 rounded-lg border border-white/30 text-white text-sm font-bold">Pick again</button><button onClick={()=>{setResult(simulateDuel(myCard,opponent));setPhase('result')}} className="px-6 py-2 rounded-lg bg-[#ff2e9c] text-white text-sm font-bold">Fight!</button></div></div>;
 const won=result?.winner?.id===myCard?.id;
 return <div className="w-full max-w-2xl mx-auto px-4 flex flex-col items-center gap-4 text-center"><h2 className="text-2xl font-black" style={{color:result?.draw?'#fff':won?'#5df2c0':'#ff5e3a'}}>{result?.draw?'Draw':won?'Victory!':'Defeated'}</h2><div className="grid grid-cols-2 gap-4 w-full"><CardFace card={myCard} count={1}/><CardFace card={opponent} count={1}/></div><div className="bg-black/40 border border-white/10 rounded-xl p-4 w-full max-h-64 overflow-y-auto text-sm text-white/70 text-left space-y-1">{result?.log.map((line,i)=><div key={i}>{line}</div>)}</div><div className="flex gap-3"><button onClick={()=>setPhase('select')} className="px-5 py-2 rounded-lg border border-white/30 text-white text-sm font-bold">Fight again</button><button onClick={onExit} className="px-5 py-2 rounded-lg bg-[#19d3ff] text-black text-sm font-bold">Done</button></div></div>;
}
