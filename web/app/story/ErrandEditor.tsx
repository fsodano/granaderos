'use client';
import {useState} from 'react';
import {cityForSector} from '../../../game/cities.js';
import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from '../../../game/data.js';
import {errandContacts,defaultErrands,QUEST_RESOURCES} from '../../../game/quest-definitions.js';
import {SUPPLY_ITEMS} from '../../../game/tactical-inventory.js';
import {OUTFITS} from '../../../game/outfits.js';
import {sectorExits} from '../../../game/tactical-exits.js';

const namedExits=(id:string)=>sectorExits(id).filter(exit=>CAMPAIGN_SECTORS.some(s=>s.id===exit.destination));
export default function ErrandEditor({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
  const [selected,select]=useState(''),[search,setSearch]=useState('');
  const contacts=errandContacts(draft),quests=draft.errands??defaultErrands().filter(q=>contacts.some(c=>c.id===q.npcId));
  const quest=quests.find((q:any)=>q.id===selected)??quests[0];
  const change=(next:any[])=>onChange({...draft,errands:next});
  const update=(patch:any)=>change(quests.map((q:any)=>q===quest?{...q,...patch}:q));
  const id=()=>{let n=1;while(quests.some((q:any)=>q.id===`encargo-${n}`))n++;return `encargo-${n}`;};
  const freeContact=contacts.find(c=>!quests.some((q:any)=>q.npcId===c.id));
  const edges:Record<string,string>={N:'norte',E:'este',S:'sur',W:'oeste'};
  const kind=quest?.escort?'escort':quest?.carried?'carried':'resources';
  const contact=contacts.find(c=>c.id===quest?.npcId),physicalAllowed=Boolean(contact?.fixedSector)&&!contact?.canRecruit;
  const reward=quest?.reward??{treasury:0,loyalty:true};
  const setKind=(value:string)=>{
    const {carried,escort,...base}=quest;
    const exit=namedExits(quest.sector)[0];
    const next={...base,cost:{},...(value==='carried'?{carried:{item:'medkits',count:1,label:'Vendas',instruction:'Entregá las vendas desde el inventario al contacto.'}}:value==='escort'&&exit?{escort:{destination:exit.destination,edge:exit.edge}}:{})};
    change(quests.map((q:any)=>q===quest?next:q));
  };
  const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return <section aria-label="Encargos locales editables"><p>Configurá entregas de objetos, escoltas y recompensas. Cada contacto admite un encargo local. Los encargos del diálogo se conservan en la sección Encargos.</p><div className="editor-columns">
    <aside><h2>Encargos locales <small>{quests.length}</small></h2>
      <label>Buscar encargo<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <button disabled={!freeContact||quests.length>=200} onClick={()=>{
        if(!freeContact)return;const added={id:id(),npcId:freeContact.id,sector:freeContact.sector??'retiro',title:'Nuevo encargo',offer:'Necesito tu ayuda.',delivery:'Gracias por tu ayuda.',cost:{},requiredSectors:[],requires:[],reward:{treasury:0,loyalty:Boolean(cityForSector(freeContact.sector))}};
        change([...quests,added]);select(added.id);setSearch('');
      }}>Crear encargo</button>
      {quests.filter((q:any)=>norm(`${q.title} ${q.id} ${contacts.find(c=>c.id===q.npcId)?.name??''}`).includes(norm(search))).map((q:any)=><button key={q.id} aria-current={quest===q?'true':undefined} onClick={()=>select(q.id)}>{q.title}</button>)}
      {!freeContact&&<p>Cada contacto admite un encargo. Agregá otro personaje con una aparición para crear más.</p>}
    </aside>
    <section className="editor-detail">
      {!quest?<p>No hay encargos. Creá uno para comenzar.</p>:<>
        <h2>{quest.title}</h2>
        <p>Las entregas del inventario conservan cada objeto. Una recompensa se entrega una sola vez. Si muere el contacto, su encargo pendiente falla.</p>
        <div className="toolbar"><button disabled={quests.some((q:any)=>q.requires?.includes(quest.id))} onClick={()=>{change(quests.filter((q:any)=>q!==quest));select('');}}>Quitar encargo</button></div>
        {quests.some((q:any)=>q.requires?.includes(quest.id))&&<p>Otros encargos dependen de este. Quitá esas condiciones antes de borrarlo.</p>}
        <div className="fields">
          <label>Título<input value={quest.title} maxLength={120} onChange={e=>update({title:e.target.value})}/></label>
          <label>Contacto<select value={quest.npcId} onChange={e=>{const contact=contacts.find(c=>c.id===e.target.value),sector=contact?.sector??quest.sector,exit=namedExits(sector)[0];update({npcId:e.target.value,sector,...(!cityForSector(sector)?{reward:{...reward,loyalty:false}}:{}),...(quest.escort&&exit?{escort:{destination:exit.destination,edge:exit.edge}}:{})});}}>{contacts.map(c=><option key={c.id} value={c.id} disabled={quests.some((q:any)=>q!==quest&&q.npcId===c.id)||kind!=='resources'&&(!c.fixedSector||c.canRecruit)}>{c.name}</option>)}</select></label>
          <label>Localidad del encargo<select value={quest.sector} onChange={e=>{const destination=namedExits(e.target.value)[0];update({sector:e.target.value,...(!cityForSector(e.target.value)?{reward:{...reward,loyalty:false}}:{}),...(quest.escort&&destination?{escort:{destination:destination.destination,edge:destination.edge}}:{})});}}>{CAMPAIGN_SECTORS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><small>Recibe la lealtad obtenida. La escolta usa las salidas de esta localidad.</small></label>
          <label>Objetivo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="resources">Conversar y entregar pesos</option><option value="carried" disabled={!physicalAllowed}>Entregar objetos del inventario</option><option value="escort" disabled={!physicalAllowed}>Escoltar hasta una salida</option></select></label>
        </div>
        <label>Texto al ofrecer el encargo<textarea value={quest.offer} maxLength={800} onChange={e=>update({offer:e.target.value})}/></label>
        <label>Texto al completarlo<textarea value={quest.delivery} maxLength={800} onChange={e=>update({delivery:e.target.value})}/></label>
        {!physicalAllowed&&<p>Para recibir objetos o conducir una escolta, elegí un contacto fijo en una localidad que no pueda incorporarse a la escuadra. Configurá esos datos en la ficha del habitante nuevo.</p>}
        {kind==='resources'&&<fieldset><legend>Pesos que se entregan al conversar</legend><p>Si todas las cantidades son cero, basta con conversar y cumplir las condiciones.</p><div className="fields">{QUEST_RESOURCES.map(key=><label key={key}>{(RESOURCE_NAMES as any)[key]}<input type="number" min={0} max={10000} value={quest.cost[key]??0} onChange={e=>{const cost={...quest.cost};if(e.target.valueAsNumber===0)delete cost[key];else cost[key]=e.target.valueAsNumber;update({cost});}}/></label>)}</div></fieldset>}
        {quest.carried&&<fieldset><legend>Entrega física</legend><div className="fields">
          <label>Objeto<select value={quest.carried.item??quest.carried.outfit} onChange={e=>{const value=e.target.value,{item,outfit,...carried}=quest.carried;update({carried:{...carried,...(Object.hasOwn(OUTFITS,value)?{outfit:value,label:(OUTFITS as any)[value].name}:{item:value,label:(SUPPLY_ITEMS as any)[value].label})}});}}>{Object.values(SUPPLY_ITEMS).filter(s=>s.item!=='ammo').map(s=><option key={s.item} value={s.item}>{s.label}</option>)}{Object.entries(OUTFITS).map(([id,s])=><option key={id} value={id}>{s.name}</option>)}</select></label>
          <label>Cantidad<input type="number" min={1} max={100} value={quest.carried.count} onChange={e=>update({carried:{...quest.carried,count:e.target.valueAsNumber}})}/></label>
          <label>Nombre de los objetos<input value={quest.carried.label} maxLength={80} onChange={e=>update({carried:{...quest.carried,label:e.target.value}})}/></label>
        </div><label>Instrucciones de entrega<textarea value={quest.carried.instruction} maxLength={800} onChange={e=>update({carried:{...quest.carried,instruction:e.target.value}})}/></label></fieldset>}
        {quest.escort&&<label>Salida de la escolta<select value={quest.escort.destination} onChange={e=>{const exit=namedExits(quest.sector).find(exit=>exit.destination===e.target.value)!;update({escort:{destination:exit.destination,edge:exit.edge}});}}>{namedExits(quest.sector).map(exit=><option key={exit.id} value={exit.destination}>{edges[exit.edge]} hacia {CAMPAIGN_SECTORS.find(s=>s.id===exit.destination)?.name}</option>)}</select></label>}
        <fieldset><legend>Condiciones para completar</legend>
          <p>Localidades que deben estar bajo control:</p><div className="fields">{CAMPAIGN_SECTORS.map(s=><label key={s.id}><input type="checkbox" checked={quest.requiredSectors.includes(s.id)} onChange={()=>update({requiredSectors:quest.requiredSectors.includes(s.id)?quest.requiredSectors.filter((id:string)=>id!==s.id):[...quest.requiredSectors,s.id]})}/>{s.name}</label>)}</div>
          <p>Encargos que deben estar completos:</p><div className="fields">{quests.filter((q:any)=>q!==quest).map((q:any)=><label key={q.id}><input type="checkbox" checked={quest.requires?.includes(q.id)??false} onChange={()=>update({requires:quest.requires?.includes(q.id)?quest.requires.filter((id:string)=>id!==q.id):[...(quest.requires??[]),q.id]})}/>{q.title}</label>)}</div>
        </fieldset>
        <fieldset><legend>Recompensa</legend><div className="fields"><label>Pesos de plata<input type="number" min={0} max={10000} value={reward.treasury} onChange={e=>update({reward:{...reward,treasury:e.target.valueAsNumber}})}/></label><label><input type="checkbox" disabled={!cityForSector(quest.sector)} checked={reward.loyalty} onChange={e=>update({reward:{...reward,loyalty:e.target.checked}})}/>Mejorar lealtad de la localidad (+8){!cityForSector(quest.sector)&&<small>Esta localidad rural no registra lealtad.</small>}</label></div></fieldset>
      </>}
    </section>
  </div></section>;
}
