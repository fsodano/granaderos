// Explicit strategic rest. Automatic sleep and the global fatigue/energy-capacity
// model are separate integrations; the existing daily recovery is unchanged.
export const REST_HEALING_HOURS=6;
export function restRecovery(op,record){
 const fraction=record.hp/op.maxHp,wounds=fraction<.25?4:fraction<.5?2:fraction<.75?1:0;
 const hours=Math.max(4,Math.min(12,8+wounds-(op.traits?.includes('night_vision')?1:0)));
 return {hours,energy:Math.floor(96/hours),fatigue:Math.floor(64/hours)};
}
export function recoverAtRest(record,op,{heal=false}={}){
 const rate=restRecovery(op,record);
 record.energy=Math.min(100,(record.energy??100)+rate.energy);
 record.fatigue=Math.max(0,(record.fatigue??0)-rate.fatigue);
 if(heal&&!record.bleeding&&record.hp>=15&&record.hp<op.maxHp){
  record.recoveryHours=(record.recoveryHours??0)+1;
  if(record.recoveryHours>=REST_HEALING_HOURS){record.hp++;record.recoveryHours=0;if(record.bandaged!==undefined)record.bandaged=Math.min(record.bandaged,op.maxHp-record.hp);}
 }else if(record.recoveryHours!==undefined||heal)record.recoveryHours=0;
}
