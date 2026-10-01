// Keep the crew at its battery after contact; use only shared visible targets.
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {teamCanSee,getReachable,stanceCost} from '../game/tactical.js';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
import {batteryOrder} from './advancing-battery-driver.mjs';
export function holdBatteryOrder(b,u){
 const care=tucumanCombatOrder(b,u);if(care?.type==='useItem'||care?.slot==='medical')return care;
 const targets=b.units.filter(v=>v.side!==u.side&&v.hp>=15&&!v.departure&&!v.unconscious&&!v.surrendered&&!v.routed&&teamCanSee(b,u.side,v));
 if(b.mode==='combat'&&u.stance==='standing'&&u.ap>=stanceCost(u,'crouched'))return {type:'stance',unitId:u.id,stance:'crouched'};
 const view={...b,units:b.units.filter(v=>v.side===u.side||teamCanSee(b,u.side,v))};
 const a=chooseArtilleryAction(b,u,targets,()=>getReachable(view,u));if(a)return a;
 if(b.mode==='exploration')return batteryOrder(b,u);
 if(care&&['fire','weapon','reload','reprime','useItem'].includes(care.type))return care;
 return null;
}
