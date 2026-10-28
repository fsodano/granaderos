'use client';
import {sitePath} from './site-path.js';
import {useEffect,useRef,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Package} from 'lucide-react';
import type {EquipmentInteraction} from './equipment-interaction';
const serverSnapshot=()=>null;
const transform=(point:{x:number;y:number})=>`translate(${Math.max(0,Math.min(window.innerWidth-224,point.x+14))}px,${Math.max(0,Math.min(window.innerHeight-48,point.y+14))}px)`;
/** The visual follows the pointer; the exact item is owned by the saved cursor. */
export default function EquipmentCursor({store}:{store:EquipmentInteraction}){
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot,serverSnapshot),picked=state?.selection;
 const node=useRef<HTMLDivElement>(null),point=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{
  let frame=0;
  const move=(event:PointerEvent)=>{
   if(event.pointerType==='touch'){point.current=null;if(node.current)node.current.style.display='none';return;}
   point.current={x:event.clientX,y:event.clientY};
   if(!frame)frame=requestAnimationFrame(()=>{frame=0;const p=point.current;if(node.current&&p){node.current.style.display='flex';node.current.style.transform=transform(p);}});
  };
  window.addEventListener('pointermove',move);
  return()=>{window.removeEventListener('pointermove',move);if(frame)cancelAnimationFrame(frame);};
 },[]);
 if(!picked||!state||state.gesture?.dragging)return null;
 return createPortal(<div ref={node} data-equipment-cursor="true" aria-hidden="true" style={{position:'fixed',left:0,top:0,transform:point.current?transform(point.current):undefined,zIndex:1000,pointerEvents:'none',display:point.current?'flex':'none',alignItems:'center',gap:6,maxWidth:210,padding:'5px 7px',border:'1px solid #d8c780',background:'#18251eee',color:'#eee5c5',font:'11px system-ui',boxShadow:'0 2px 5px #0007'}}>
  {picked.weapon?<img src={sitePath(`/art/weapon-${picked.weapon}.png`)} alt="" width="44" height="24" style={{objectFit:'contain'}}/>:<Package size={20}/>}<span>{picked.label} · {picked.count}</span>
 </div>,document.body);
}
