// The same physical pocket layout is used by every soldier. Placement hints do
// not own items: quantities and weapon metadata remain in the item records.
export const POCKETS=Object.freeze([
 ...Array.from({length:4},(_,i)=>Object.freeze({id:`large-${i+1}`,size:'large',label:`Bolsillo grande ${i+1}`})),
 ...Array.from({length:8},(_,i)=>Object.freeze({id:`small-${i+1}`,size:'small',label:`Bolsillo pequeño ${i+1}`})),
]);
const key=item=>JSON.stringify([item.item,item.index]);
const fits=(entry,slot)=>entry.slotSize<=1||slot.size==='large';
export function validatePocketOrder(order){
 if(order===undefined)return;
 if(!Array.isArray(order)||order.length>POCKETS.length)throw Error('La distribución de los bolsillos no es válida.');
 const slots=new Set(),items=new Set();
 for(const entry of order){
  if(!entry||!POCKETS.some(p=>p.id===entry.slotId)||typeof entry.item!=='string'||!entry.item.length||entry.item.length>110||/[<>\x00-\x1f]/.test(entry.item)||!Number.isSafeInteger(entry.index)||entry.index<0||entry.index>1000000||entry.count!==undefined&&(!Number.isSafeInteger(entry.count)||entry.count<1)||slots.has(entry.slotId)||items.has(key(entry)))throw Error('La distribución de los bolsillos no es válida.');
  slots.add(entry.slotId);items.add(key(entry));
 }
}
export function allocatePockets(items,order){
 validatePocketOrder(order);
 const slots=POCKETS.map(p=>({...p,entry:null})),entries=[],overflow=[];
 const limits=new Map(items.map(item=>[item.item,item.stackLimit])),partitions=new Map();
 for(const entry of order??[])if(entry.count!==undefined){
  if(limits.has(entry.item)&&entry.count>limits.get(entry.item))throw Error('La cantidad del bolsillo supera el límite de la pila.');
  partitions.set(key(entry),entry.count);
 }
 // Never expand untrusted million-item legacy stacks into a million objects.
 // Saved partitions describe desired quantities, not additional item ownership.
 for(const item of items){
  let remaining=item.count;
  for(let index=0;index<POCKETS.length&&remaining>0;index++){
   const count=Math.min(partitions.get(key({item:item.item,index}))??item.stackLimit,remaining);
   entries.push({...item,index,count});remaining-=count;
  }
 }
 const preferences=new Map((order??[]).map(entry=>[key(entry),entry.slotId]));
 for(const large of [true,false]){
  const group=entries.filter(entry=>(entry.slotSize>1)===large),placed=new Set();
  for(const entry of group){const slot=slots.find(p=>p.id===preferences.get(key(entry))&&!p.entry&&fits(entry,p));if(slot){slot.entry=entry;placed.add(key(entry));}}
  for(const entry of group.filter(entry=>!placed.has(key(entry)))){
   const slot=slots.filter(p=>!p.entry&&fits(entry,p)).sort((a,b)=>(a.size==='large')-(b.size==='large'))[0];
   if(slot)slot.entry=entry;
  }
 }
 for(const item of items){const count=slots.reduce((n,p)=>n+(p.entry?.item===item.item?p.entry.count:0),0);if(count<item.count)overflow.push({...item,count:item.count-count});}
 return {slots,overflow};
}
export function pocketOrderFromSlots(slots){
 const indices=new Map(),order=slots.flatMap(slot=>{
  if(!slot.entry)return [];
  const {item,count}=slot.entry,index=indices.get(item)??0;indices.set(item,index+1);
  return [{slotId:slot.id,item,index,count}];
 });
 validatePocketOrder(order);return order;
}
export function rearrangePockets(layout,sourceId,destinationId){
 const source=layout.slots.find(p=>p.id===sourceId),destination=layout.slots.find(p=>p.id===destinationId);
 if(!source?.entry||!destination||source===destination)throw Error('Seleccioná un objeto y otro bolsillo.');
 if(!fits(source.entry,destination)||destination.entry&&!fits(destination.entry,source))throw Error('Ese objeto necesita un bolsillo grande.');
 return pocketOrderFromSlots(layout.slots.map(slot=>({...slot,entry:slot===source?destination.entry:slot===destination?source.entry:slot.entry})));
}
