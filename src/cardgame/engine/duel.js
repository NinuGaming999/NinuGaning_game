import { resolveReaction } from './reactions.js';
const HOOKS={
 'Flash Step':'first','Tailwind':'first','Bulwark':'block','Rebirth':'revive','Everseed':'revive','Surge':'heal',
 'Crystal Skin':'shield','Steady Ground':'flat','Vacuum Wall':'half','Bedrock Throne':'tank','Eye of the Storm':'immune',
 'Numbing Claw':'skip','Static Nip':'double','Slip Current':'dodge','Undertow':'slow','Chill Step':'slow',
 'Bramble Guard':'reflect','Bloomburst':'bloom','First Spring':'reaction','Ashfall Crown':'reaction','Crown of Frost':'frost',
 'Eclipse':'disable','Wide Swirl':'swirl','Mountain’s Verdict':'crystal','Drowning Grasp':'frozen'
};
const hp=c=>20+c.stats.defense*6;
function fighter(card){return {card,hp:hp(card),max:hp(card),shield:0,element:null,skip:0,defDown:0,used:false,abilityDisabled:false};}
function hook(f){return f.abilityDisabled?null:HOOKS[f.card.ability.name];}
function speed(f){return Math.max(0,f.card.stats.speed-(hook(f)==='slow'?2:0));}
function damage(att,def,reaction){
 let n=Math.max(2,Math.round(6+att.card.stats.power*1.6-(def.card.stats.defense-def.defDown)*.5));
 if(reaction)n=Math.round(n*reaction.multiplier);
 const h=hook(att),dh=hook(def);
 if(h==='reaction')n=Math.round(n*(att.card.ability.name==='Ashfall Crown'?1.25:1.2));
 if(h==='frost'&&['Melt','Superconduct'].includes(reaction?.name))n=Math.round(n*.75);
 if(h==='reaction'&&att.card.ability.name==='First Spring'&&reaction)n=Math.round(n*(1+(reaction.multiplier-1)));
 if(dh==='tank')n=Math.round(n*.8);
 if(h==='double'&&Math.random()<.2)n=Math.round(n*1.65);
 if(h==='flat'&&!def.used){n=Math.max(0,n-5);def.used=true;}
 if(hook(def)==='half'&&!def.used){n=Math.round(n*.5);def.used=true;}
 if(hook(def)==='dodge'&&!def.used&&Math.random()<.25){def.used=true;return 0;}
 if(def.shield){const a=Math.min(def.shield,n);def.shield-=a;n-=a;}
 if(hook(def)==='block'&&!def.used){def.used=true;return 0;}
 return Math.max(0,n);
}
export function simulateDuel(cardA,cardB){
 const a=fighter(cardA),b=fighter(cardB),log=[`${cardA.name} (${a.hp} HP) vs ${cardB.name} (${b.hp} HP)`];
 if(hook(a)==='disable')b.abilityDisabled=true;if(hook(b)==='disable')a.abilityDisabled=true;
 if(hook(a)==='shield')a.shield=10;if(hook(b)==='shield')b.shield=10;
 let first=speed(a)>=speed(b);if(hook(a)==='first')first=true;if(hook(b)==='first')first=false;
 for(let t=0;t<40;t++){
  for(const [x,y] of (t===0?(first?[[a,b],[b,a]]:[[b,a],[a,b]]):speed(a)>=speed(b)?[[a,b],[b,a]]:[[b,a],[a,b]])){
   if(x.hp<=0||y.hp<=0)continue;
   if(x.skip&&!['immune'].includes(hook(x))){x.skip--;log.push(`${x.card.name} is unable to move.`);continue;}
   const reaction=resolveReaction(x.card.element,y.element);if(reaction)log.push(`${reaction.name}!`);
   let n=damage(x,y,reaction);if(reaction?.name==='Overloaded'&&hook(x)==='reaction')n*=2;
   y.hp-=n;if(n)log.push(`${x.card.name} deals ${n} damage to ${y.card.name}.`);
   if(hook(y)==='reflect'&&n){const r=Math.max(1,Math.round(n*.2));x.hp-=r;log.push(`Bramble Guard reflects ${r}.`);}
   if(y.hp<=0&&hook(y)==='revive'&&!y.used){y.used=true;y.hp=Math.max(1,Math.round(y.max*.25));log.push(`${y.card.name} revives!`);}
   if(y.hp<=0)continue;
   if(reaction?.effect==='skip'&&hook(y)!=='immune')y.skip=hook(x)==='frozen'?2:1;
   if(reaction?.effect==='weaken'&&hook(x)!=='immune')y.defDown+=2;
   if(reaction?.effect==='shield'){x.shield+=(hook(x)==='crystal'?16:8);}
   if(reaction?.effect==='dot'){y.hp-=3;log.push(`${y.card.name} takes 3 reaction damage.`);}
   if(reaction?.name==='Bloom'&&hook(x)==='bloom')x.hp=Math.min(x.max,x.hp+6);
   if(hook(x)==='heal'&&y.hp<=0)x.hp=Math.min(x.max,x.hp+6);
   if(hook(x)==='skip'&&Math.random()<.2)y.skip=1;
   y.element=x.card.element;
   if(y.hp<=0||x.hp<=0)break;
  }
  if(a.hp<=0||b.hp<=0)break;
 }
 let winner=null,loser=null,draw=false;if(a.hp<=0&&b.hp<=0)draw=true;else if(a.hp>b.hp)winner=a.card,loser=b.card;else if(b.hp>a.hp)winner=b.card,loser=a.card;else draw=true;
 if(winner)log.push(`${loser.name} is defeated. ${winner.name} wins!`);else log.push('Time runs out - draw.');
 return {winner,loser,draw,log,finalHp:{a:Math.max(0,a.hp),b:Math.max(0,b.hp)}};
}
