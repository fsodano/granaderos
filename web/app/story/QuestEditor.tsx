'use client';
import {useState} from 'react';
export default function QuestEditor({draft,onChange}:{draft:any;onChange:(draft:any)=>void}){
 const quests=draft.quests??[],[selected,setSelected]=useState(''),[query,setQuery]=useState(''),[person,setPerson]=useState('');
 const quest=quests.find((q:any)=>q.id===selected)??quests[0];
 const survivors=quest?.requiredAlive??[],available=draft.characters.filter((c:any)=>!survivors.includes(c.id)),candidate=available.find((c:any)=>c.id===person)??available[0];
 const update=(patch:any)=>onChange({...draft,quests:quests.map((q:any)=>q.id===quest.id?{...q,...patch}:q)});
 const add=(copy=false)=>{let n=1;while(quests.some((q:any)=>q.id===`quest-${n}`))n++;const id=`quest-${n}`;onChange({...draft,quests:[...quests,copy?{...quest,id,title:`${quest.title.slice(0,94)} copia`}:{id,title:`Encargo ${n}`,description:'Escribí el objetivo que verá el jugador.'}]});setSelected(id);};
 const users=quest?draft.characters.filter((c:any)=>c.encounter?.dialogue?.nodes.some((n:any)=>n.choices.some((choice:any)=>[...(choice.conditions??[]),...(choice.effects??[])].some(e=>e.type==='quest'&&e.quest===quest.id)))):[];
 return <section aria-label="Encargos editables"><p>Creá un encargo y usalo en las condiciones y efectos de las conversaciones. Empieza sin iniciar. Puede pasar a «En curso» y luego a «Completado» o «Fallido». Los estados finales no se reinician.</p>
  <button type="button" disabled={quests.length>=100} onClick={()=>add()}>Crear encargo</button>
  <label>Buscar encargos<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="editor-columns"><aside className="entry-list">{quests.filter((q:any)=>`${q.title} ${q.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((q:any)=><button type="button" key={q.id} aria-current={q.id===quest?.id?'true':undefined} onClick={()=>setSelected(q.id)}>{q.title}<small>{q.id}</small></button>)}</aside>
   {quest&&<fieldset><legend>{quest.title}</legend>
    <label>Título del encargo<input value={quest.title} maxLength={100} onChange={e=>update({title:e.target.value})}/></label>
    <label>Objetivo del encargo<textarea rows={4} value={quest.description} maxLength={1000} onChange={e=>update({description:e.target.value})}/></label>
    <label>Plazo desde la aceptación (horas, opcional)<input type="number" min={1} max={720} value={quest.deadlineHours??''} onChange={e=>update({deadlineHours:e.target.value===''?null:e.target.valueAsNumber})}/></label>
    <p>Con un plazo, el encargo falla al cumplirse esas horas desde su aceptación. Dejalo vacío para no limitar el tiempo. Se cuentan los viajes, la espera y el tiempo dentro del sector.</p>
    <fieldset aria-label="Personajes necesarios para el encargo"><legend>Personajes necesarios para el encargo</legend>
     <p>El encargo falla si muere cualquiera de estas personas mientras está en curso. Si ya murió, no se puede iniciar. Heridas, inconsciencia y retiro del servicio no cuentan como muerte. Hasta seis personas.</p>
     <label>Personaje que debe sobrevivir<select value={candidate?.id??''} onChange={e=>setPerson(e.target.value)}>{available.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     <button type="button" disabled={!candidate||survivors.length>=6} onClick={()=>update({requiredAlive:[...survivors,candidate.id]})}>Agregar personaje necesario</button>
     {survivors.map((id:string)=><div key={id}><span>{draft.characters.find((c:any)=>c.id===id)?.name??id}</span><button type="button" onClick={()=>update({requiredAlive:survivors.filter((v:string)=>v!==id)})}>Quitar requisito de {draft.characters.find((c:any)=>c.id===id)?.name??id}</button></div>)}
    </fieldset>
    <button type="button" disabled={quests.length>=100} onClick={()=>add(true)}>Duplicar encargo</button>
    <button type="button" disabled={users.length>0} onClick={()=>{onChange({...draft,quests:quests.filter((q:any)=>q.id!==quest.id)});setSelected('');}}>Eliminar encargo</button>
    {users.length>0&&<p>Usado por: {users.map((c:any)=>c.name).join(', ')}. Quitá esas referencias antes de eliminarlo.</p>}
    <p>Las opciones de diálogo pueden iniciar, completar o fallar este encargo. Agregá sus requisitos como condiciones de la misma opción. El jugador lo verá en la carta de campaña desde que lo inicia.</p>
   </fieldset>}
  </div>
 </section>;
}
