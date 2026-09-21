// Tactical test orders: move a purchased battery toward the known sector centre,
// then use visible targets, finite ammunition, actual crew AP and personal weapons.
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {actBattle,teamCanSee,getReachable} from '../game/tactical.js';
import {tucumanCombatOrder} from './tucuman-driver.mjs';
export function batteryOrder(b,u){
 const visible=b.units.filter(t=>t.side==='enemy'&&t.hp>=15&&!t.routed&&!t.surrendered&&!t.unconscious&&!t.departure&&teamCanSee(b,u.side,t));
 const view={...b,units:b.units.filter(t=>t.side===u.side||teamCanSee(b,u.side,t))};
 const gun=b.artillery.find(g=>g.side===u.side);
 const action=chooseArtilleryAction(b,u,visible,()=>getReachable(view,u));if(action)return action;
 if(!gun)return tucumanCombatOrder(b,u);
 if(visible.length)return tucumanCombatOrder(b,u);
 if(u.id!=='57')return null;
 const destination={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
 const distance=p=>Math.hypot(destination.x-p.x,destination.y-p.y);
 const options=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:gun.x+dx,y:gun.y+dy})).filter(p=>distance(p)<distance(gun)).sort((a,c)=>distance(a)-distance(c));
 for(const p of options){const a={type:'artilleryMove',unitId:u.id,artilleryId:gun.id,...p};if(!actBattle(b,a).lastError)return a;}
 return null;
}
