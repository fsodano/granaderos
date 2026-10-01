'use client';
import {createContext,createElement,useContext,useEffect,useId,useRef,useState,useSyncExternalStore,type ReactNode,type PointerEvent,type MouseEvent} from 'react';
import {equipmentEndpoint} from '../../game/tactical-inventory.js';
import {createEquipmentInteraction,type EquipmentInteraction} from './equipment-interaction';
import EquipmentCursor from './EquipmentCursor';

const Context=createContext<EquipmentInteraction|null>(null);
const serverSnapshot=()=>null;
function useCancellation(store:EquipmentInteraction,enabled=true){
 useEffect(()=>{
  if(!enabled)return;
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&(store.getSnapshot().selection||store.getSnapshot().gesture)){
    store.cancel();event.preventDefault();event.stopImmediatePropagation();
   }
  };
  // Focus changes cannot discard a durable cursor. Esc is an explicit return
  // action; leaving the tab or closing a component only ends its gesture.
  window.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('keydown',key,true);};
 },[store,enabled]);
}
function EquipmentInteractionRoot({children}:{children:ReactNode}){
 const id=useId();const [store]=useState(()=>createEquipmentInteraction(id));
 useCancellation(store);
 return createElement(Context.Provider,{value:store},children,createElement(EquipmentCursor,{store}));
}
export function EquipmentInteractionProvider({children}:{children:ReactNode}){
 const shared=useContext(Context);
 return shared?children:createElement(EquipmentInteractionRoot,null,children);
}
export function useEquipmentInteraction(){
 const store=useContext(Context);
 if(!store)throw Error('El cursor necesita un ámbito de equipo.');
 const current=useSyncExternalStore(store.subscribe,store.getSnapshot,serverSnapshot);
 return {store,current};
}

// Mouse, touch, pen and keyboard share the authoritative equipment cursor.
export function useEquipmentDrag(battle:any,unit:any,disabled:boolean,onOrder:(action:any)=>any){
 const shared=useContext(Context),id=useId();const [local]=useState(()=>createEquipmentInteraction(id)),store=shared??local;
 const current=useSyncExternalStore(store.subscribe,store.getSnapshot,serverSnapshot);
 const owner=useRef(Symbol('equipment-source')),pointerId=useRef<number|null>(null),suppressClick=useRef(false),pickupShift=useRef<boolean|null>(null);
 useCancellation(store,!shared);
 useEffect(()=>()=>store.clearOwned(owner.current),[store,unit.id]);
 useEffect(()=>store.revalidate(unit,disabled,onOrder,battle),[store,unit,disabled,onOrder,battle]);
 const updateTarget=(event:PointerEvent,fresh=false)=>{
  if(pointerId.current!==event.pointerId||store.getSnapshot().gesture?.owner!==owner.current)return;
  const element=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-equipment-slot]');
  const destinationId=element?.dataset.equipmentScope===store.scope&&element.dataset.equipmentUnit===String(unit.id)?element.dataset.equipmentSlot??null:null;
  store.drag(battle,unit,owner.current,event.clientX,event.clientY,destinationId,fresh);
 };
 const handlers=(slotId:string,{onInspect,selectOnClick=true}:{onInspect?:(item:string,slotId?:string)=>void;selectOnClick?:boolean}={})=>({
  'data-equipment-slot':slotId,'data-equipment-unit':String(unit.id),'data-equipment-scope':store.scope,
  'aria-pressed':Boolean(current?.selection?.unitId===String(unit.id)&&current.selection.sourceId===slotId),
  onPointerDown:(event:PointerEvent<HTMLElement>)=>{
   if(disabled||!battle||event.button!==0||event.isPrimary===false||pointerId.current!==null)return;
   suppressClick.current=false;
   if(store.press(unit,slotId,owner.current,event.clientX,event.clientY,event.shiftKey)){pickupShift.current=event.shiftKey;pointerId.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}
  },
  onPointerMove:updateTarget,
  onPointerEnter:()=>{if(!disabled&&battle)store.hover(battle,unit,slotId);},
  onPointerLeave:()=>store.leave(),
  onFocus:()=>{if(!disabled&&battle)store.hover(battle,unit,slotId);},
  onBlur:()=>store.leave(),
  onPointerUp:(event:PointerEvent<HTMLElement>)=>{
   if(pointerId.current!==event.pointerId)return;
   updateTarget(event,true);const result=store.release(owner.current);pointerId.current=null;
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   if(!result)return;
   suppressClick.current=result.suppressClick;if(result.suppressClick)pickupShift.current=null;
   if(!disabled&&result.action)store.dispatch({...result.action,unitId:String(unit.id)},onOrder,owner.current);
  },
  onPointerCancel:(event:PointerEvent)=>{if(pointerId.current===event.pointerId){pointerId.current=null;suppressClick.current=true;pickupShift.current=null;store.clearOwned(owner.current);}},
  onLostPointerCapture:(event:PointerEvent)=>{if(pointerId.current===event.pointerId){pointerId.current=null;suppressClick.current=true;pickupShift.current=null;store.clearOwned(owner.current);}},
  onClickCapture:(event:MouseEvent)=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;pickupShift.current=null;}},
  onClick:selectOnClick?(event:MouseEvent)=>{event.stopPropagation();const all=event.detail===0?event.shiftKey:pickupShift.current??event.shiftKey;pickupShift.current=null;if(disabled)return;const action=store.click(battle,unit,slotId,owner.current,all);if(action)store.dispatch({...action,unitId:String(unit.id)},onOrder,owner.current);}:undefined,
  onContextMenu:(event:MouseEvent)=>{
   event.preventDefault();event.stopPropagation();
   if(store.getSnapshot().gesture){store.cancel();return;}
   const item=equipmentEndpoint(unit,slotId).item;if(!disabled&&item)onInspect?.(item,slotId);
  },
  onDragStart:(event:MouseEvent)=>event.preventDefault(),
 });
 const picked=current?.gesture??current?.selection,belongs=picked?.unitId===String(unit.id);
 return {handlers,selected:belongs?current?.selection?.sourceId??'':'',active:Boolean(belongs),dragging:Boolean(belongs&&current?.gesture?.dragging),target:belongs?current?.target??'':'',hint:current?.hint??'',scope:store.scope,quantity:belongs&&current?.selection?{count:current.selection.count,maxCount:current.selection.maxCount}:null,setCount:store.setCount,cancel:store.cancel};
}
