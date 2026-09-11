import {carriedWeight,carryCapacity} from './tactical.js';
import {gainFatigue,needsCollapseRecovery} from './fatigue.js';
// Hourly costs adapt long journeys to the existing Granaderos geography.
export function marchFatigueRate(unit,{mode='march',mountain=false}={}){
 if(mode==='carts'||mode==='flotilla')return 1;
 const riding=mode==='posta'||unit.canMount;
 const load=riding?1:Math.max(1,carriedWeight(unit)/carryCapacity(unit));
 return Math.ceil((riding?1:2)*(mountain?1.5:1)*load);
}
export const tooTiredToMarch=unit=>needsCollapseRecovery(unit)||(unit.fatigue??0)>=80||(unit.energy??100)<=10;
export function advanceMarchFatigue(s,roster,{traveling=[],mode='march',mountain=false}={}){
 for(const id of traveling){const record=s.operativeState[id],unit=roster.find(o=>o.id===id);if(!unit||!s.recruited.includes(id)||!record?.alive||record.captured)continue;gainFatigue(record,marchFatigueRate({...unit,...record},{mode,mountain}));}
}
