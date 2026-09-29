'use client';
import {useState} from 'react';
import {Package} from 'lucide-react';
import {personalPockets} from '../../game/personal-pockets.js';
import {supplyDropPreview,supplyTransferPreview,weaponTransferPreview} from '../../game/tactical.js';

export default function PersonalPockets({unit,battle,busy,onOrder}: {unit:any;battle:any;busy:boolean;onOrder:(action:any)=>void}){
 const [selection,setSelection]=useState(''),[selectedItem,setSelectedItem]=useState(''),[moving,setMoving]=useState(''),[amount,setAmount]=useState('1'),[recipient,setRecipient]=useState('');
 const layout:any=personalPockets(unit),slot=layout.slots.find((p:any)=>p.id===selection),candidate:any=slot?.entry??layout.overflow.find((p:any)=>`overflow:${p.item}`===selection),entry=candidate?.item===selectedItem?candidate:null;
 const disabled=busy||battle.status!=='active'||unit.hp<=0||unit.unconscious||unit.routed;
 const recipients=battle.units.filter((u:any)=>u.side===unit.side&&u.id!==unit.id&&!u.militia&&!u.fled&&!u.departure),target=recipients.find((u:any)=>u.id===recipient);
 const isSupply=entry?.kind==='supply',isWeapon=Boolean(entry?.weapon),stowed=entry?.kind==='stowed',count=Number(amount);
 const drop=isSupply?supplyDropPreview(battle,unit,entry.item,count):{reason:!isWeapon?'Este objeto se conserva hasta salir del sector.':battle.mode!=='exploration'&&unit.ap<4?'Requiere 4 PA.':null};
 const transfer=isSupply?supplyTransferPreview(battle,unit,target,entry.item,count):weaponTransferPreview(battle,unit,target,stowed?undefined:entry?.key,stowed?entry.slot:undefined);
 const select=(id:string)=>{if(moving){onOrder({type:'pocket',source:moving,destination:id});setMoving('');}else{setSelection(id);setSelectedItem(layout.slots.find((p:any)=>p.id===id)?.entry?.item??layout.overflow.find((p:any)=>`overflow:${p.item}`===id)?.item??'');setAmount('1');}};
 const icon=(item:any)=>item.art?<img src={item.art} alt=""/>:<Package aria-hidden="true" size={22}/>;
 const cost=(ap:number)=>battle.mode==='exploration'?'1 s':`${ap} PA`;
 return <section className="personal-pockets" aria-label="Bolsillos del combatiente">
  <h3>Bolsillos · 4 grandes / 8 pequeños</h3>
  <p>{moving?'Elegí el bolsillo de destino.':'Seleccioná un bolsillo para usar, dejar o entregar su contenido.'}</p>
  <div className="pocket-grid">{layout.slots.map((p:any)=><button key={p.id} type="button" className={`pocket-cell ${p.size} ${selection===p.id?'selected':''}`} aria-label={`${p.label}: ${p.entry?`${p.entry.name} · ${p.entry.count}`:'vacío'}`} aria-pressed={selection===p.id} disabled={disabled} onClick={()=>select(p.id)} onContextMenu={e=>{e.preventDefault();setSelection(p.id);setSelectedItem(p.entry?.item??'');setMoving('');setAmount('1');}}>
   {p.entry?<>{icon(p.entry)}<b>{p.entry.count}</b><span>{p.entry.name}</span></>:<span>{p.size==='large'?'Grande':'Pequeño'}</span>}
  </button>)}</div>
  {layout.overflow.length>0&&<div className="pocket-overflow" role="status"><p>Este equipo excede los bolsillos. Conservamos todos los objetos de la partida. Dejá o entregá el exceso para recoger más.</p>{layout.overflow.map((item:any)=><button key={item.item} disabled={disabled} onClick={()=>select(`overflow:${item.item}`)}>{item.name} · {item.count}</button>)}</div>}
  {entry&&<div className="pocket-details" aria-label={`Detalles de ${entry.name}`}>
   <strong>{entry.name} · {entry.count}</strong>
   {entry.art&&<img className="pocket-detail-art" src={entry.art} alt=""/>}
   {entry.description&&<p>{entry.description}</p>}
   {entry.condition!==undefined&&<span>Estado: {entry.condition}%{entry.loaded?` · ${entry.loaded} carga(s)`:''}</span>}
   {isWeapon&&<button disabled={disabled||battle.mode!=='exploration'&&unit.ap<(stowed?4:6)} onClick={()=>onOrder(stowed?{type:'weapon',slot:entry.slot}:{type:'equipLoot',inventoryKey:entry.key,slot:'primary'})}>{stowed?'Usar en la mano':'Equipar principal'} · {cost(stowed?4:6)}</button>}
   {isWeapon&&!stowed&&entry.weapon>=1809&&<button disabled={disabled||battle.mode!=='exploration'&&unit.ap<6} onClick={()=>onOrder({type:'equipLoot',inventoryKey:entry.key,slot:'blade'})}>Equipar secundaria · {cost(6)}</button>}
   {isSupply&&<label>Cantidad <input aria-label="Cantidad de suministros" type="number" min="1" max={entry.count} step="1" value={amount} disabled={disabled} onChange={e=>setAmount(e.target.value)}/></label>}
   {slot?.entry&&<button disabled={disabled} aria-pressed={moving===slot.id} onClick={()=>setMoving(moving?'':slot.id)}>{moving?'Cancelar cambio de bolsillo':'Mover a otro bolsillo'}</button>}
   <button disabled={disabled||Boolean(drop.reason)} title={drop.reason??''} onClick={()=>onOrder(isSupply?{type:'dropSupply',item:entry.item,count}:{type:'drop',...(stowed?{slot:entry.slot}:{inventoryKey:entry.key})})}>Dejar {isSupply?'suministros':'una pieza'} en el suelo · {cost(4)}</button>
   {drop.reason&&<small>{drop.reason}</small>}
   <label>Entregar a <select aria-label={`Entregar ${entry.name} a`} value={recipient} disabled={disabled} onChange={e=>setRecipient(e.target.value)}><option value="">Elegí un compañero</option>{recipients.map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
   <button disabled={disabled||Boolean(transfer.reason)} title={transfer.reason??''} onClick={()=>onOrder(isSupply?{type:'transferSupply',item:entry.item,count,targetId:recipient}:{type:'transfer',...(stowed?{slot:entry.slot}:{inventoryKey:entry.key}),targetId:recipient})}>Entregar {isSupply?'suministros':'una pieza'} · {cost(4)}</button>
   {recipient&&transfer.reason&&<small>{transfer.reason}</small>}
  </div>}
 </section>;
}
