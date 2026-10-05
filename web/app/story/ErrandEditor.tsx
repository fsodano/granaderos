'use client';
import {useState} from 'react';
import {cityForSector} from '../../../game/cities.js';
import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from '../../../game/data.js';
import {errandContacts,defaultErrands,QUEST_RESOURCES} from '../../../game/quest-definitions.js';
import {SUPPLY_ITEMS} from '../../../game/tactical-inventory.js';
import {OUTFITS} from '../../../game/outfits.js';
import {sectorExits} from '../../../game/tactical-exits.js';

const namedExits=(id:string)=>sectorExits(id).filter(exit=>CAMPAIGN_SECTORS.some(s=>s.id===exit.destination));
const contactIds=(quest:any):string[]=>[...new Set<string>([quest.npcId,...(quest.beneficiaries??[]).map((recipient:any)=>recipient.npcId)])];
export default function ErrandEditor({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
  const [selected,select]=useState(''),[search,setSearch]=useState('');
  const contacts=errandContacts(draft),quests=draft.errands??defaultErrands().filter(q=>contacts.some(c=>c.id===q.npcId));
  const quest=quests.find((q:any)=>q.id===selected)??quests[0];
  const change=(next:any[])=>onChange({...draft,errands:next});
  const update=(patch:any,remove:string[]=[])=>change(quests.map((q:any)=>{if(q!==quest)return q;const next={...q,...patch};for(const key of remove)delete next[key];return next;}));
  const id=()=>{let n=1;while(quests.some((q:any)=>q.id===`encargo-${n}`))n++;return `encargo-${n}`;};
  const reserved=(id:string)=>quests.some((q:any)=>q!==quest&&contactIds(q).includes(id));
  const freeContact=contacts.find(c=>!quests.some((q:any)=>contactIds(q).includes(c.id)));
  const edges:Record<string,string>={N:'norte',E:'este',S:'sur',W:'oeste'};
  const kind=quest?.escort?'escort':quest?.carried?'carried':'resources';
  const contact=contacts.find(c=>c.id===quest?.npcId),physicalAllowed=Boolean(contact?.fixedSector)&&!contact?.canRecruit;
  const reward=quest?.reward??{treasury:0,loyalty:true};
  const recipientContacts=contacts.filter(c=>c.fixedSector&&!c.canRecruit&&!reserved(c.id));
  const alternateContact=recipientContacts.find(c=>c.id==='local-ensenada'&&c.id!==quest?.npcId)??recipientContacts.find(c=>c.id!==quest?.npcId);
  const beneficiariesAllowed=kind==='carried'&&physicalAllowed&&Boolean(alternateContact);
  const withdrawalAllowed=kind==='carried'&&physicalAllowed&&quest?.carried?.count>=2&&(quest?.beneficiaries?quest.beneficiaries.every((b:any)=>Boolean(cityForSector(b.sector))):Boolean(cityForSector(quest?.sector)));
  const rewardChoiceAllowed=kind==='carried'&&physicalAllowed&&Boolean(cityForSector(quest?.sector))&&!quest?.beneficiaries;
  const recipient=(contact:typeof contacts[number],id:string)=>({id,npcId:contact.id,sector:contact.sector,delivery:quest.delivery,reward:{treasury:0,loyalty:Boolean(cityForSector(contact.sector))}});
  const updateRecipient=(index:number,patch:any)=>update({beneficiaries:quest.beneficiaries.map((choice:any,i:number)=>i===index?{...choice,...patch}:choice)});
  const setKind=(value:string)=>{
    const {carried,escort,rewardChoice,beneficiaries,withdrawal,...base}=quest;
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
        <p>Las entregas del inventario conservan cada objeto. Una recompensa se entrega una sola vez. La muerte del destinatario elegido termina el encargo pendiente.</p>
        <div className="toolbar"><button disabled={quests.some((q:any)=>q.requires?.includes(quest.id))} onClick={()=>{change(quests.filter((q:any)=>q!==quest));select('');}}>Quitar encargo</button></div>
        {quests.some((q:any)=>q.requires?.includes(quest.id))&&<p>Otros encargos dependen de este. Quitá esas condiciones antes de borrarlo.</p>}
        <div className="fields">
          <label>Título<input value={quest.title} maxLength={120} onChange={e=>update({title:e.target.value})}/></label>
          <label>Contacto<select value={quest.npcId} onChange={e=>{const nextContact=contacts.find(c=>c.id===e.target.value),sector=nextContact?.sector??quest.sector,exit=namedExits(sector)[0];update({npcId:e.target.value,sector,...(!cityForSector(sector)?{reward:{...reward,loyalty:false}}:{}),...(quest.escort&&exit?{escort:{destination:exit.destination,edge:exit.edge}}:{}),...(quest.beneficiaries&&!quest.beneficiaries.some((choice:any)=>choice.npcId===e.target.value)?{beneficiaries:quest.beneficiaries.map((choice:any)=>choice.npcId===quest.npcId?{...choice,npcId:e.target.value,sector,reward:{...choice.reward,loyalty:Boolean(cityForSector(sector))&&choice.reward.loyalty}}:choice)}:{})},!cityForSector(sector)?['rewardChoice','withdrawal']:[]);}}>{contacts.map(c=><option key={c.id} value={c.id} disabled={reserved(c.id)||kind!=='resources'&&(!c.fixedSector||c.canRecruit)}>{c.name}</option>)}</select></label>
          <label>Localidad del encargo<select value={quest.sector} disabled={Boolean(quest.beneficiaries)} onChange={e=>{const destination=namedExits(e.target.value)[0];update({sector:e.target.value,...(!cityForSector(e.target.value)?{reward:{...reward,loyalty:false}}:{}),...(quest.escort&&destination?{escort:{destination:destination.destination,edge:destination.edge}}:{})},!cityForSector(e.target.value)?['rewardChoice','withdrawal']:[]);}}>{CAMPAIGN_SECTORS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><small>{quest.beneficiaries?'La localidad pertenece al contacto que ofrece el encargo. Cada destinatario tiene su propia localidad.':'Recibe la lealtad obtenida. La escolta usa las salidas de esta localidad.'}</small></label>
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
        <fieldset><legend>Destinatarios</legend>
          <label><input type="checkbox" disabled={!beneficiariesAllowed} checked={Boolean(quest.beneficiaries)} onChange={e=>e.target.checked&&contact&&alternateContact?update({beneficiaries:[recipient(contact,'destino-1'),recipient(alternateContact,'destino-2')],reward:{treasury:0,loyalty:false}},['rewardChoice']):update({},['beneficiaries'])}/>Elegir entre dos destinatarios</label>
          {!beneficiariesAllowed&&<p>Necesitás una entrega física y dos contactos fijos que no puedan incorporarse.</p>}
          {quest.beneficiaries&&<><p>La primera entrega aceptada fija el destinatario. Todos los objetos deben ir a esa persona. Después, el jugador confirma el encargo al conversar con ella. Solo se aplica su recompensa.</p>{quest.beneficiaries.map((choice:any,index:number)=><fieldset key={choice.id} aria-label={`Destinatario ${index+1}`}><legend>Destinatario {index+1}</legend>
            <label>Contacto destinatario<select value={choice.npcId} onChange={e=>{const nextContact=contacts.find(c=>c.id===e.target.value)!;update({beneficiaries:quest.beneficiaries.map((other:any,i:number)=>i===index?{...other,npcId:nextContact.id,sector:nextContact.sector,reward:{...other.reward,loyalty:Boolean(cityForSector(nextContact.sector))&&other.reward.loyalty}}:other),...(choice.npcId===quest.npcId?{npcId:nextContact.id,sector:nextContact.sector}:{})});}}>{recipientContacts.map(c=><option key={c.id} value={c.id} disabled={quest.beneficiaries.some((other:any,i:number)=>i!==index&&other.npcId===c.id)}>{c.name}</option>)}</select></label>
            <p>Localidad: {CAMPAIGN_SECTORS.find(s=>s.id===choice.sector)?.name??choice.sector}.</p>
            <label>Texto de entrega al destinatario<textarea value={choice.delivery} maxLength={800} onChange={e=>updateRecipient(index,{delivery:e.target.value})}/></label>
            <label>Recompensa en pesos<input type="number" min={0} max={10000} value={choice.reward.treasury} onChange={e=>updateRecipient(index,{reward:{...choice.reward,treasury:e.target.valueAsNumber}})}/></label>
            <label><input type="checkbox" disabled={!cityForSector(choice.sector)} checked={choice.reward.loyalty} onChange={e=>updateRecipient(index,{reward:{...choice.reward,loyalty:e.target.checked}})}/>Apoyo de la localidad del destinatario (+8)</label>
          </fieldset>)}</>}
        </fieldset>
        <fieldset><legend>Retiro del compromiso</legend><label><input type="checkbox" disabled={!withdrawalAllowed&&!quest.withdrawal} checked={Boolean(quest.withdrawal)} onChange={e=>e.target.checked?update({withdrawal:{supportCost:4}}):update({},['withdrawal'])}/>Permitir retirar una entrega incompleta</label>{quest.withdrawal&&<><label>Costo de apoyo local<input type="number" min={1} max={20} value={quest.withdrawal.supportCost} onChange={e=>update({withdrawal:{supportCost:e.target.valueAsNumber}})}/></label><p>Requiere una entrega parcial real y conversar junto al destinatario elegido. El apoyo baja hasta el costo indicado, sin bajar de cero. Los objetos entregados quedan con esa persona. Los restantes siguen con el jugador. No hay recompensa, reintegro ni cambio de destinatario.</p></>}{!withdrawalAllowed&&<p>Esta opción necesita una entrega física de al menos dos objetos cuyos destinatarios estén en ciudades. Aumentá la cantidad o desactivá el retiro.</p>}</fieldset>
        {!quest.beneficiaries&&<fieldset><legend>Recompensa</legend>
          <label><input type="checkbox" disabled={!rewardChoiceAllowed} checked={Boolean(quest.rewardChoice)} onChange={e=>e.target.checked?update({rewardChoice:{reimbursement:40},reward:{treasury:0,loyalty:false}}):update({},['rewardChoice'])}/>Elegir entre reintegro y apoyo local</label>
          {!rewardChoiceAllowed&&<p>Esta elección necesita una entrega de objetos en una ciudad.</p>}
          {quest.rewardChoice?<><p>Después de entregar todos los objetos, el jugador conversa con el contacto para cobrar el reintegro o renunciar a él y mejorar el apoyo local (+8). No hay recompensa automática.</p><label>Reintegro en pesos<input type="number" min={1} max={10000} value={quest.rewardChoice.reimbursement} onChange={e=>update({rewardChoice:{reimbursement:e.target.valueAsNumber}})}/></label></>:<div className="fields"><label>Pesos de plata<input type="number" min={0} max={10000} value={reward.treasury} onChange={e=>update({reward:{...reward,treasury:e.target.valueAsNumber}})}/></label><label><input type="checkbox" disabled={!cityForSector(quest.sector)} checked={reward.loyalty} onChange={e=>update({reward:{...reward,loyalty:e.target.checked}})}/>Mejorar lealtad de la localidad (+8){!cityForSector(quest.sector)&&<small>Esta localidad rural no registra lealtad.</small>}</label></div>}
        </fieldset>}
      </>}
    </section>
  </div></section>;
}
