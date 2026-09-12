import {equipmentEndpoint,equipmentFingerprint,itemDescriptor} from '../../game/tactical-inventory.js';
import {equipmentPlacementPreview} from '../../game/tactical.js';

export type EquipmentSource={owner:symbol;unitId:string;sourceId:string;expectedSource:string;label:string;weapon?:number};
export type EquipmentGesture=EquipmentSource&{x:number;y:number;dragging:boolean;action:any};
type State={selection:EquipmentSource|null;gesture:EquipmentGesture|null;target:string;hint:string};
const empty=():State=>({selection:null,gesture:null,target:'',hint:''});

// Selection is a reservation of the displayed source, never another item owner.
// The authoritative reducer receives one fingerprinted order only on placement.
export function createEquipmentInteraction(scope:string){
 let state=empty();const listeners=new Set<()=>void>(),cancelledPresses=new Set<symbol>();
 const publish=(next:State)=>{state=next;for(const update of listeners)update();};
 const reset=(hint='')=>{const active=Boolean(state.selection||state.gesture);if(state.gesture)cancelledPresses.add(state.gesture.owner);publish({...empty(),hint});return active;};
 const cancel=()=>reset();
 const source=(unit:any,sourceId:string,owner:symbol):EquipmentSource|null=>{
  const endpoint=equipmentEndpoint(unit,sourceId);
  if(!endpoint.item)return null;
  const descriptor=itemDescriptor(unit,endpoint.item);
  return {owner,unitId:String(unit.id),sourceId,expectedSource:equipmentFingerprint(unit,sourceId),label:descriptor.label,...('weapon' in descriptor&&typeof descriptor.weapon==='number'?{weapon:descriptor.weapon}:{})};
 };
 const preview=(battle:any,unit:any,picked:EquipmentSource,destinationId:string)=>{
  if(picked.unitId!==String(unit.id))return {valid:false,reason:'Seleccioná el objeto de este combatiente.',pa:0,action:null};
  try{
   const action={type:'moveEquipment',sourceId:picked.sourceId,destinationId,expectedSource:picked.expectedSource,expectedDestination:equipmentFingerprint(unit,destinationId)};
   return {...equipmentPlacementPreview(battle,unit,action),action};
  }catch(error){return {valid:false,reason:(error as Error).message,pa:0,action:null};}
 };
 const selectedHint=(picked:EquipmentSource)=>`${picked.label} · Elegí el destino. Esc o botón derecho: cancelar.`;
 const targetHint=(battle:any,result:ReturnType<typeof preview>)=>result.reason??(battle.equipmentContext==='campaign'?'Colocar objeto':battle.mode==='exploration'?(result.pa?'Colocar objeto · consume tiempo':'Ordenar bolsillos'):`Colocar objeto · ${result.pa} PA`);
 return {
  scope,
  getSnapshot:()=>state,
  subscribe:(update:()=>void)=>{listeners.add(update);return()=>{listeners.delete(update);};},
  cancel,
  clearOwned(owner:symbol){if(state.selection?.owner===owner||state.gesture?.owner===owner)cancel();},
  revalidate(unit:any,disabled:boolean){
   const picked=state.gesture??state.selection;if(!picked)return;
   if(disabled||picked.unitId!==String(unit.id)){cancel();return;}
   let matches=false;try{matches=picked.expectedSource===equipmentFingerprint(unit,picked.sourceId);}catch{}
   if(!matches)reset('Cambió el equipo. Volvé a seleccionar el objeto.');
  },
  click(battle:any,unit:any,slotId:string,owner:symbol){
   if(!battle)return null;
   const picked=state.selection;
   if(!picked){const next=source(unit,slotId,owner);if(next)publish({selection:next,gesture:null,target:'',hint:selectedHint(next)});return null;}
   if(picked.unitId===String(unit.id)&&picked.sourceId===slotId){cancel();return null;}
   const result=preview(battle,unit,picked,slotId);
   if(!result.valid){publish({...state,target:'',hint:result.reason??'No se puede colocar aquí.'});return null;}
   cancel();return result.action;
  },
  hover(battle:any,unit:any,slotId:string){
   const picked=state.selection;if(!picked||state.gesture)return;
   if(picked.sourceId===slotId){publish({...state,target:'',hint:selectedHint(picked)});return;}
   const result=preview(battle,unit,picked,slotId);publish({...state,target:result.valid?slotId:'',hint:targetHint(battle,result)});
  },
  leave(){if(state.selection&&!state.gesture)publish({...state,target:'',hint:selectedHint(state.selection)});},
  press(unit:any,slotId:string,owner:symbol,x:number,y:number){
   if(state.gesture)return false;
   cancelledPresses.delete(owner);
   if(state.selection&&state.selection.sourceId!==slotId)return false;
   const picked=source(unit,slotId,owner);if(!picked)return false;
   publish({...state,gesture:{...picked,x,y,dragging:false,action:null}});return true;
  },
  drag(battle:any,unit:any,owner:symbol,x:number,y:number,destinationId:string|null){
   const current=state.gesture;if(!current||current.owner!==owner)return;
   if(!current.dragging&&Math.hypot(x-current.x,y-current.y)<=5)return;
   const result=destinationId?preview(battle,unit,current,destinationId):null;
   publish({...state,gesture:{...current,dragging:true,action:result?.valid?result.action:null},target:result?.valid?destinationId!:'',hint:result?targetHint(battle,result):''});
  },
  release(owner:symbol){
   if(cancelledPresses.delete(owner))return {dragging:false,action:null,suppressClick:true};
   const current=state.gesture;if(!current||current.owner!==owner)return null;
   if(current.dragging)publish(empty());else publish({...state,gesture:null});
   return {dragging:current.dragging,action:current.action,suppressClick:current.dragging};
  },
 };
}
export type EquipmentInteraction=ReturnType<typeof createEquipmentInteraction>;
