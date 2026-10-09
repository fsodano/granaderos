import assert from 'node:assert/strict';
import {actBattle,endTurn,getReachable,canSee} from '../game/tactical.js';

// Reach a retained body through ordinary movement before checking its custody.
// The declared source fixture supplies its location, not visibility or free loot.
export function approachTestRemains(battle,unitId,targetId){
 for(let step=0;step<160;step++){
  const unit=battle.units.find(u=>u.id===String(unitId)),body=battle.units.find(u=>u.id===String(targetId));
  assert.ok(unit&&body,'the living carrier and retained body must exist');
  if(Math.hypot(unit.x-body.x,unit.y-body.y)<=1.5){
   if(canSee(battle,unit,body))return battle;
   battle=actBattle(battle,{type:'look',unitId:unit.id,x:body.x,y:body.y});
  }else if(unit.energy<10&&battle.mode==='exploration')battle=endTurn(battle);
  else{
   const destination=getReachable(battle,unit).filter(p=>Math.hypot(p.x-body.x,p.y-body.y)<=1.5&&p.cost>0).sort((a,b)=>a.cost-b.cost)[0];
   assert.ok(destination?.path.length,'the carrier must have a legal path to the body');
   battle=actBattle(battle,{type:'move',unitId:unit.id,...destination.path[0]});
  }
  assert.equal(battle.lastError,null,battle.lastError);
 }
 assert.fail('the carrier did not reach the retained body within 160 paid steps');
}
