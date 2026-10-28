import {scenarioFor} from './campaign-scenario.js';
// Granaderos campaign-scale reserves, not historical troop counts or JA2 values.
// Once issued, troops stay with their group. Casualties never refill this pool.
export {enemyReserveLimits as ENEMY_RESERVE_LIMITS} from '../../content/campaigns/granaderos/scenario.js';
export const enemyReserveLimitsFor=s=>{const limits=scenarioFor(s).enemyReserveLimits;return typeof limits==='function'?limits(s):limits;};
export function migrateEnemyReserves(s){
 if(s.enemyReserves===undefined){
  s.enemyReserves={version:1,remaining:Object.fromEntries(Object.entries(enemyReserveLimitsFor(s)).map(([theater,limit])=>[theater,Math.max(0,limit-(s.enemyGroups??[]).filter(g=>g.theater===theater).reduce((n,g)=>n+g.initialStrength,0))]))};
 }
 return s.enemyReserves;
}
export function validateEnemyReserves(s){
 const reserve=migrateEnemyReserves(s),remaining=reserve?.remaining;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const limits=enemyReserveLimitsFor(s);
 if(!object(reserve)||reserve.version!==1||!object(remaining)||Object.keys(remaining).length!==Object.keys(limits).length||Object.entries(limits).some(([theater,limit])=>!Number.isInteger(remaining[theater])||remaining[theater]<0||remaining[theater]>limit))throw Error(scenarioFor(s).enemyReserveError);
}
