import { getUserIdFromName } from '../../utils/firebaseService.js';
import { computeAvailablePoints } from '../engine/points.js';
const db=window.firebase.database();
export function subscribeToArcadePoints(playerName,onData){
 const userId=getUserIdFromName(playerName);if(!userId){onData(0);return()=>{};}
 const racingRef=db.ref(`racingLeaderboard/${userId}/score`),meltRef=db.ref(`leaderboard/${userId}/meltDamage`),spentRef=db.ref(`cardCurrency/${userId}/spent`);
 const state={racingScore:0,meltDamage:0,spent:0};const recompute=()=>onData(computeAvailablePoints(state));
 const h1=s=>{state.racingScore=s.val()||0;recompute()},h2=s=>{state.meltDamage=s.val()||0;recompute()},h3=s=>{state.spent=s.val()||0;recompute()};
 racingRef.on('value',h1);meltRef.on('value',h2);spentRef.on('value',h3);
 return()=>{racingRef.off('value',h1);meltRef.off('value',h2);spentRef.off('value',h3)};
}
export async function getArcadePoints(playerName){
 const userId=getUserIdFromName(playerName);if(!userId)return 0;
 const [r,m,s]=await Promise.all([db.ref(`racingLeaderboard/${userId}/score`).once('value'),db.ref(`leaderboard/${userId}/meltDamage`).once('value'),db.ref(`cardCurrency/${userId}/spent`).once('value')]);
 return computeAvailablePoints({racingScore:r.val()||0,meltDamage:m.val()||0,spent:s.val()||0});
}
export async function spendArcadePoints(playerName,cost){
 const userId=getUserIdFromName(playerName);if(!userId||cost<=0)return false;
 const available=await getArcadePoints(playerName);if(available<cost)return false;
 const spentRef=db.ref(`cardCurrency/${userId}/spent`),snap=await spentRef.once('value'),observed=Number(snap.val())||0,earned=available+observed;
 const result=await spentRef.transaction(current=>{const now=Number(current)||0;if(now+cost>earned)return undefined;return now+cost});
 return result.committed;
}
export function subscribeToCollection(playerName,onData){
 const userId=getUserIdFromName(playerName);if(!userId){onData({});return()=>{};}
 const ref=db.ref(`cardCollection/${userId}`),handler=s=>onData(s.val()||{});ref.on('value',handler);return()=>ref.off('value',handler);
}
export async function addCardsToCollection(playerName,cards){
 const userId=getUserIdFromName(playerName);if(!userId)return;
 const now=Date.now();
 for(const card of cards){const ref=db.ref(`cardCollection/${userId}/${card.id}`);await ref.transaction(current=>({count:((current&&current.count)||0)+1,firstObtainedAt:(current&&current.firstObtainedAt)||now}));}
}
