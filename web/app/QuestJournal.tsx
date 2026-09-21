'use client';
import {questJournal} from '../../game/quests.js';
import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from '../../game/data.js';
import {ENCOUNTERS} from '../../game/encounters.js';
import './quest-journal.css';
const sectorName=(id:string)=>CAMPAIGN_SECTORS.find(sector=>sector.id===id)?.name??id;
const stamp=(hour:number)=>`Día ${1+Math.floor(hour/24)} · ${hour%24}:00`;
export default function QuestJournal({state}:{state:any}){
 const entries=questJournal(state);
 return <section className="quest-journal" aria-labelledby="quest-journal-title">
  <h3 id="quest-journal-title">Encargos locales</h3>
  {!entries.length?<p className="muted">Todavía no aceptaste encargos. Conversá con los habitantes durante tus visitas.</p>:<ul>{entries.map((quest:any)=><li key={quest.id} data-quest={quest.id}>
   <article>
    <header><h4>{quest.title}</h4><strong className={`quest-status ${quest.status}`}>{quest.status==='offered'?'Pendiente':quest.status==='completed'?'Cumplido':'Fallido'}</strong></header>
    <p>{ENCOUNTERS.find(npc=>npc.id===quest.npcId)?.name} · {sectorName(quest.sector)}</p>
    <p className="quest-date">Aceptado: {stamp(quest.offeredAt)}</p>
    {quest.carried&&<p>Ponchos entregados: {quest.delivered}/{quest.carried.count}</p>}
    {quest.status==='offered'?<>
     <p>{quest.carried?'Llevá los ponchos restantes. Seleccioná cada uno en el inventario y entregáselo al contacto.':`Entregá ${Object.entries(quest.cost).map(([key,count])=>`${count} ${(RESOURCE_NAMES as any)[key]?.toLowerCase()??key}`).join(' y ')} al conversar con el contacto.`}</p>
     {quest.unsecured.length>0&&<p className="quest-blocker">Primero asegurá: {quest.unsecured.map(sectorName).join(', ')}.</p>}
    </>:quest.status==='completed'?<p>{quest.delivery} <span className="quest-date">Cumplido: {stamp(quest.completedAt)}.</span></p>:<p>El contacto murió. El encargo terminó sin recompensa. Los objetos ya entregados permanecen con el contacto. <span className="quest-date">Fallido: {stamp(quest.failedAt)}.</span></p>}
   </article>
  </li>)}</ul>}
 </section>;
}
