'use client';
import {useEffect,useRef,useSyncExternalStore,type PointerEvent,type MouseEvent} from 'react';
import {equipmentEndpoint,equipmentFingerprint} from '../../game/tactical-inventory.js';
import {equipmentPlacementPreview} from '../../game/tactical.js';
type Gesture={unitId:string;sourceId:string;expectedSource:string;x:number;y:number;dragging:boolean;target:string;hint:string;action:any};
let gesture:Gesture|null=null;
const listeners=new Set<()=>void>();
const publish=(next:Gesture|null)=>{gesture=next;for(const update of listeners)update();};
const subscribe=(update:()=>void)=>{listeners.add(update);return()=>{listeners.delete(update);};};
const snapshot=()=>gesture;
const serverSnapshot=()=>null;
// Pointer capture supports mouse, pen and touch without a browser-native drag
// swallowing the final drop. Only the accepted reducer order changes ownership.
export function useEquipmentDrag(battle:any,unit:any,disabled:boolean,onOrder:(action:any)=>void){
 const current=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 const ownsGesture=useRef(false),suppressClick=useRef(false);
 useEffect(()=>()=>{if(ownsGesture.current){ownsGesture.current=false;publish(null);}},[unit.id]);
 const finish=()=>{ownsGesture.current=false;publish(null);};
 const updateTarget=(event:PointerEvent)=>{
  if(!gesture||!ownsGesture.current)return;
  const dragging=gesture.dragging||Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>5;
  if(!dragging)return;
  const element=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-equipment-slot]');
  const destinationId=element?.dataset.equipmentUnit===String(unit.id)?element.dataset.equipmentSlot:null;
  if(!destinationId){publish({...gesture,dragging,target:'',hint:'',action:null});return;}
  const action={type:'moveEquipment',sourceId:gesture.sourceId,destinationId,expectedSource:gesture.expectedSource,expectedDestination:equipmentFingerprint(unit,destinationId)};
  const preview=equipmentPlacementPreview(battle,unit,action);
  publish({...gesture,dragging,target:preview.valid?destinationId:'',hint:preview.reason??`Mover equipo · ${battle.mode==='exploration'?0:preview.pa} PA`,action:preview.valid?action:null});
 };
 const handlers=(slotId:string)=>({
  'data-equipment-slot':slotId,'data-equipment-unit':String(unit.id),
  onPointerDown:(event:PointerEvent<HTMLElement>)=>{
   suppressClick.current=false;
   if(disabled||!battle||event.button!==0||!equipmentEndpoint(unit,slotId).item)return;
   ownsGesture.current=true;
   publish({unitId:String(unit.id),sourceId:slotId,expectedSource:equipmentFingerprint(unit,slotId),x:event.clientX,y:event.clientY,dragging:false,target:'',hint:'',action:null});
   event.currentTarget.setPointerCapture(event.pointerId);
  },
  onPointerMove:updateTarget,
  onPointerUp:(event:PointerEvent<HTMLElement>)=>{
   if(!ownsGesture.current)return;
   // Recheck the actual release position; the source fingerprint remains the
   // one captured at pickup, so changed contents reject atomically.
   updateTarget(event);const action=gesture?.action;suppressClick.current=Boolean(gesture?.dragging);
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   finish();if(!disabled&&action)onOrder(action);
  },
  onPointerCancel:()=>{suppressClick.current=true;finish();},
  onLostPointerCapture:()=>{if(ownsGesture.current)finish();},
  onClickCapture:(event:MouseEvent)=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}},
  onDragStart:(event:MouseEvent)=>event.preventDefault(),
 });
 return {handlers,dragging:Boolean(current?.unitId===String(unit.id)&&current.dragging),target:current?.unitId===String(unit.id)?current.target:'',hint:current?.unitId===String(unit.id)?current.hint:''};
}
