import { CARDS,RARITIES,RARITY_INFO } from '../data/cards.js';
const CARDS_BY_RARITY=Object.fromEntries(RARITIES.map(r=>[r,CARDS.filter(c=>c.rarity===r)]));
const PULL_COST=10,PACK_SIZE=5;
export function pullCost(count=1){return PULL_COST*count;}
function rollRarity(pityStreak){const bump=Math.min(.25,pityStreak*.015);const weights=RARITIES.map(r=>{const base=RARITY_INFO[r].pullChance;return r==='common'?Math.max(.05,base-bump):base+bump/(RARITIES.length-1)});const total=weights.reduce((a,b)=>a+b,0);let roll=Math.random()*total;for(let i=0;i<RARITIES.length;i++){roll-=weights[i];if(roll<=0)return RARITIES[i]}return 'common';}
function pullOne(streak){const rarity=rollRarity(streak),pool=CARDS_BY_RARITY[rarity];return pool[Math.floor(Math.random()*pool.length)];}
export function openPack(pityStreak=0){const cards=[];let streak=pityStreak;for(let i=0;i<PACK_SIZE;i++){const card=pullOne(streak);cards.push(card);streak=card.rarity==='common'?streak+1:0;}return {cards,endingPityStreak:streak};}
export {PACK_SIZE};
