const RACING_SCORE_DIVISOR=100,MELT_DAMAGE_DIVISOR=500;
export function pointsFromRacingScore(score){return Math.max(0,Math.floor((Number(score)||0)/RACING_SCORE_DIVISOR));}
export function pointsFromMeltDamage(meltDamage){return Math.max(0,Math.floor((Number(meltDamage)||0)/MELT_DAMAGE_DIVISOR));}
export function computeAvailablePoints({racingScore,meltDamage,spent}){const earned=pointsFromRacingScore(racingScore)+pointsFromMeltDamage(meltDamage);return Math.max(0,earned-(Number(spent)||0));}
