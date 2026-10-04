import {sameCell} from '../../game/tactical-space.js';

// Only the current paid step is committed. Goals and the unexecuted route can
// change while its animation runs, without rolling back the battle or clock.
export function createMovementController({execute,commit,canMove}){
 let enabled=true,battle=null,positions={},intent=null,waiting=null,prepared=null,pending=false,revision=0;
 let snapshot=null;const listeners=new Set();
 const notify=()=>{
  snapshot=intent?{unitId:intent.action.unitId,movingUnitId:intent.movingUnitId??intent.action.unitId,action:intent.action,finishing:intent.finishing}:null;
  for(const listener of listeners)listener();
 };
 const stop=()=>{revision++;intent=null;waiting=null;prepared=null;notify();};
 const visualReady=unitId=>{
  const unit=battle?.units.find(unit=>unit.id===unitId),position=positions[unitId];
  return Boolean(unit&&position?.settled&&sameCell(unit,position));
 };
 function pump(){
  if(!enabled||!intent||!battle)return;
  if(waiting){
   // The committed snapshot must reach React before its visual endpoint can
   // release the next step. An unrelated replacement cancels the old order.
   if(battle!==waiting.battle){if(battle!==waiting.source)stop();return;}
   if(visualReady(waiting.unitId))waiting=null;
  }
  if(intent.finishing){if(!waiting)stop();return;}
  if(pending)return;
  if(prepared){
   if(prepared.source!==battle||prepared.epoch!==revision){stop();return;}
   if(waiting)return;
   const {source,request,result}=prepared;prepared=null;
   const next=result.state,unitId=result.unitId??request.action.unitId,unit=next?.units.find(unit=>unit.id===unitId);
   if(!unit){stop();return;}
   const previous=source.units.find(unit=>unit.id===unitId),moved=previous&&!sameCell(previous,unit);
   // A commit can synchronously notify an embedding host. Keep the controller
   // locked until the accepted state and its visual boundary are registered.
   pending=true;
   let accepted;try{accepted=commit(next,request.action,source,result);}catch{pending=false;stop();return;}
   if(accepted===null){pending=false;stop();return;}
   if(next.lastError||!moved){pending=false;stop();return;}
   intent={...request,movingUnitId:unit.id,continuation:result.continuation,finishing:result.status!=='moving'};
   waiting={source,battle:accepted??next,unitId:unit.id};
   pending=false;notify();pump();return;
  }
  if(!canMove(battle,intent.action.unitId,intent.action)){stop();return;}
  const source=battle,request=intent,epoch=revision;
  // Prepare just one pure step while the current paid tile animates. It has
  // no clock, energy, contact or campaign effect until the visual endpoint.
  pending=true;
  Promise.resolve().then(()=>execute(request.action,request.continuation)).then(result=>{
   if(!enabled){pending=false;return;}
   // A new destination arrived before this worker result was committed. The
   // pure result is safe to discard; plan again from the unchanged paid cell.
   if(epoch!==revision){pending=false;pump();return;}
   if(!result||battle!==source){pending=false;stop();return;}
   prepared={source,request,result,epoch};pending=false;pump();
  },()=>{pending=false;if(epoch===revision)stop();else pump();});
 }
 return {
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  getSnapshot:()=>snapshot,
  observe(next,visual){battle=next;positions=visual;pump();},
  request(action){
   if(!enabled||!battle||!canMove(battle,action.unitId,action))return false;
   const same=intent&&intent.action.type===action.type&&intent.action.unitId===action.unitId&&JSON.stringify(intent.action.unitIds)===JSON.stringify(action.unitIds)&&sameCell(intent.action,action)&&intent.action.movement===action.movement&&intent.action.movementIntent===action.movementIntent;
   if(same)return true;
   revision++;prepared=null;intent={action:{...action},movingUnitId:waiting?.unitId??action.unitId,continuation:null,finishing:false};notify();pump();return true;
  },
  cancel:stop,
  setEnabled(value){enabled=value;if(!value)stop();else pump();},
 };
}
