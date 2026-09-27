import { ELEMENT_INFO, RARITY_INFO } from '../data/cards';
import { ElementIcon } from './ElementIcon';

export function PlaceholderArt({ card, className = '' }) {
  const el = ELEMENT_INFO[card.element];
  const rarity = RARITY_INFO[card.rarity];
  if (card.imageUrl) return <div className={`relative w-full aspect-[3/4] overflow-hidden rounded-xl ${className}`}><img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" /></div>;
  return (
    <div className={`relative w-full aspect-[3/4] overflow-hidden rounded-xl flex items-center justify-center ${className}`} style={{ background: `radial-gradient(120% 120% at 30% 20%, ${el.color}55, transparent 60%), linear-gradient(160deg, ${el.color}33, #0a0d12 75%)` }}>
      <div className="absolute inset-0 opacity-[0.08] flex flex-wrap content-center justify-center gap-4 -rotate-12 scale-125">{Array.from({ length: 9 }).map((_, i) => <ElementIcon key={i} element={card.element} size={40} className="text-white" />)}</div>
      <div className="relative z-10 rounded-full p-5 backdrop-blur-sm" style={{ background: `${el.color}22`, boxShadow: `0 0 40px ${el.color}66, inset 0 0 20px ${el.color}44` }}><ElementIcon element={card.element} size={56} style={{ color: el.color }} /></div>
      <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] tracking-widest font-bold uppercase opacity-60" style={{ color: rarity.color }}>Art coming soon</div>
    </div>
  );
}
