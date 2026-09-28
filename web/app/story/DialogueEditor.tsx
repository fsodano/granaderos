'use client';
import {useState} from 'react';
const nextId=(prefix:string,items:any[])=>{let n=1;while(items.some(i=>i.id===`${prefix}-${n}`))n++;return `${prefix}-${n}`;};
export default function DialogueEditor({value,greeting,onChange}:{value:any;greeting:string;onChange:(value:any)=>void}){
 const [selected,setSelected]=useState(value?.entry??'start');
 const node=value?.nodes.find((n:any)=>n.id===selected)??value?.nodes[0];
 const changeNode=(patch:any)=>onChange({...value,nodes:value.nodes.map((n:any)=>n.id===node.id?{...n,...patch}:n)});
 const addNode=()=>{const id=nextId('node',value.nodes);onChange({...value,nodes:[...value.nodes,{id,title:`Pasaje ${value.nodes.length+1}`,text:'Escribí aquí la respuesta del personaje.',choices:[]}]});setSelected(id);};
 const referenced=value?.entry===node?.id||value?.nodes.some((n:any)=>n.choices.some((c:any)=>c.next===node?.id));
 return <fieldset aria-label="Diálogo con opciones"><legend>Diálogo con opciones</legend>
  <label><input type="checkbox" checked={Boolean(value)} onChange={e=>{onChange(e.target.checked?{entry:'start',nodes:[{id:'start',title:'Inicio',text:greeting||'Buen día.',choices:[]}]}:undefined);setSelected('start');}}/>Escribir una conversación con opciones</label>
  {value&&node&&<>
   <p>Cada pasaje contiene una respuesta del personaje. Las opciones del jugador conducen a otro pasaje. Un pasaje sin opciones termina ese tramo. Conectá desde el comienzo los pasajes que quieras incluir en la conversación.</p>
   <label>Comienzo de la conversación<select value={value.entry} onChange={e=>onChange({...value,entry:e.target.value})}>{value.nodes.map((n:any)=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
   <label>Pasaje que estás editando<select value={node.id} onChange={e=>setSelected(e.target.value)}>{value.nodes.map((n:any)=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
   <div className="fields"><button type="button" disabled={value.nodes.length>=30} onClick={addNode}>Agregar pasaje</button><button type="button" disabled={referenced} onClick={()=>{onChange({...value,nodes:value.nodes.filter((n:any)=>n.id!==node.id)});setSelected(value.entry);}}>Eliminar pasaje</button></div>
   {!referenced&&<small>Este pasaje todavía no tiene ninguna entrada. Podés conservarlo mientras escribís.</small>}
   {referenced&&<small>Para eliminar este pasaje, elegí otro comienzo y quitá las opciones que conducen a él.</small>}
   <label>Título del pasaje<input maxLength={80} value={node.title} onChange={e=>changeNode({title:e.target.value})}/></label>
   <small>El título sirve para organizar el diálogo. El jugador ve el texto y sus opciones.</small>
   <label>Respuesta del personaje<textarea rows={4} maxLength={1000} value={node.text} onChange={e=>changeNode({text:e.target.value})}/></label>
   {node.choices.map((choice:any,i:number)=><fieldset key={choice.id} aria-label={`Opción ${i+1}`}><legend>Opción {i+1}</legend>
    <label>Texto de la opción<input maxLength={160} value={choice.label} onChange={e=>changeNode({choices:node.choices.map((c:any)=>c.id===choice.id?{...c,label:e.target.value}:c)})}/></label>
    <label>Respuesta siguiente<select value={choice.next} onChange={e=>changeNode({choices:node.choices.map((c:any)=>c.id===choice.id?{...c,next:e.target.value}:c)})}>{value.nodes.map((n:any)=><option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
    <button type="button" onClick={()=>changeNode({choices:node.choices.filter((c:any)=>c.id!==choice.id)})}>Quitar opción {i+1}</button>
   </fieldset>)}
   <button type="button" disabled={node.choices.length>=12} onClick={()=>changeNode({choices:[...node.choices,{id:nextId('choice',node.choices),label:'Continuar',next:value.nodes.find((n:any)=>n.id!==node.id)?.id??node.id}]})}>Agregar opción</button>
   <small>Hasta 30 pasajes y 12 opciones por pasaje. Estas opciones cambian la conversación; todavía no conceden objetos ni activan encargos.</small>
  </>}
 </fieldset>;
}
