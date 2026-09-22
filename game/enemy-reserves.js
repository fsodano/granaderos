// Granaderos campaign-scale reserves, not historical troop counts or JA2 values.
// Once issued, troops stay with their group. Casualties never refill this pool.
export const ENEMY_RESERVE_LIMITS=Object.freeze({north:120,coast:80,interior:40});
export function migrateEnemyReserves(s){
 if(s.enemyReserves===undefined){
  s.enemyReserves={version:1,remaining:Object.fromEntries(Object.entries(ENEMY_RESERVE_LIMITS).map(([theater,limit])=>[theater,Math.max(0,limit-(s.enemyGroups??[]).filter(g=>g.theater===theater).reduce((n,g)=>n+g.initialStrength,0))]))};
 }
 return s.enemyReserves;
}
export function validateEnemyReserves(s){
 const reserve=migrateEnemyReserves(s),remaining=reserve?.remaining;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(reserve)||reserve.version!==1||!object(remaining)||Object.keys(remaining).length!==3||Object.entries(ENEMY_RESERVE_LIMITS).some(([theater,limit])=>!Number.isInteger(remaining[theater])||remaining[theater]<0||remaining[theater]>limit))throw Error('Las reservas realistas guardadas son inválidas.');
}
