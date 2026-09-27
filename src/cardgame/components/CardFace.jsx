import { ELEMENT_INFO, RARITY_INFO } from '../data/cards';
import { PlaceholderArt } from './PlaceholderArt';
import { ElementIcon } from './ElementIcon';

export function CardFace({ card, count, onClick, selected = false, size = 'md' }) {
  const rarity = RARITY_INFO[card.rarity];
  const el = ELEMENT_INFO[card.element];
  const padding = size === 'sm' ? 'p-1.5' : 'p-2.5';
  const nameSize = size === 'sm' ? 'text-[10px]' : 'text-sm';

  return (
    <button type="button" onClick={onClick} className={`group relative w-full rounded-2xl ${padding} text-left transition-transform duration-200 ease-out ${onClick ? 'hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] cursor-pointer' : 'cursor-default'} ${selected ? 'ring-2 ring-offset-2 ring-offset-black' : ''}`} style={{ background: `linear-gradient(160deg, ${rarity.color}26, #05070a)`, boxShadow: selected ? `0 0 0 2px ${rarity.color}, 0 8px 24px ${rarity.color}55` : '0 4px 16px rgba(0,0,0,.4)', border: `1px solid ${rarity.color}55`, ...(selected ? { '--tw-ring-color': rarity.color } : {}) }}>
      <PlaceholderArt card={card} className="transition-transform duration-300 group-hover:scale-[1.03]" />
      {count > 1 && <div className="absolute top-3 right-3 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-[11px] font-bold text-white border border-white/20">x{count}</div>}
      <div className="absolute top-3 left-3 rounded-full p-1.5 backdrop-blur" style={{ background: `${el.color}33`, color: el.color }} title={el.label}><ElementIcon element={card.element} size={size === 'sm' ? 12 : 16} /></div>
      <div className="mt-2 space-y-0.5">
        <div className={`font-bold text-white leading-tight truncate ${nameSize}`}>{card.name}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: rarity.color }}>{rarity.label}</div>
        {size !== 'sm' && <div className="flex gap-2 pt-1 text-[10px] text-white/70"><span>⚔ {card.stats.power}</span><span>🛡 {card.stats.defense}</span><span>⚡ {card.stats.speed}</span></div>}
      </div>
    </button>
  );
}
