'use client';
import {questJournal,questResolutionText,questBeneficiaryResolutionText} from '../../game/quests.js';
import {CAMPAIGN_SECTORS} from '../../game/data.js';
import {encounterDefinitions} from '../../game/encounters.js';
import {beneficiaryDeliveryNotice} from '../../game/ja2-hud.js';
import './quest-journal.css';
const sectorName=(id:string)=>CAMPAIGN_SECTORS.find(sector=>sector.id===id)?.name??id;
const stamp=(hour:number)=>`Día ${1+Math.floor(hour/24)} · ${hour%24}:00`;
export default function QuestJournal({state}:{state:any}){
 const entries=questJournal(state);
 return <section className="quest-journal" aria-labelledby="quest-journal-title">
  <h3 id="quest-journal-title">Encargos locales</h3>
  {!entries.length?<p className="muted">Todavía no aceptaste encargos. Conversá con los habitantes durante tus visitas.</p>:<ul>{entries.map((quest:any)=>{const selected=quest.beneficiaries?.find((recipient:any)=>recipient.id===quest.beneficiaryId),recipientId=selected?.npcId??quest.npcId;return <li key={quest.id} data-quest={quest.id}>
   <article>
    <header><h4>{quest.title}</h4><strong className={`quest-status ${quest.status}`}>{quest.status==='offered'?'Pendiente':quest.status==='completed'?'Cumplido':'Fallido'}</strong></header>
    <p>{encounterDefinitions(state).find(npc=>npc.id===recipientId)?.name} · {sectorName(selected?.sector??quest.sector)}</p>
    <p className="quest-date">Aceptado: {stamp(quest.offeredAt)}</p>
    {quest.carried&&<p>{quest.carried.label} entregad{quest.carried.item?'as':'os'}: {quest.delivered}/{quest.carried.count}</p>}
    {quest.beneficiaries&&quest.status==='offered'&&<p>{beneficiaryDeliveryNotice({beneficiaries:quest.beneficiaries,selectedBeneficiaryId:quest.beneficiaryId})}</p>}
    {quest.status==='offered'?<>
     <p>{quest.escort&&state.contentCampaign?.package.errands===undefined?'Acompañá al arriero hasta la salida occidental hacia Humahuaca. Hablale allí para confirmar la llegada. Podés pedirle que espere o que siga a otro combatiente.':quest.carried?quest.carried.instruction:quest.offer}</p>
     {quest.escort&&<p>{quest.escortOrder?.waiting?'El arriero espera. Hablale para continuar.':'El arriero sigue al combatiente designado cuando el camino está libre.'}</p>}
     {quest.rewardChoice&&<p>{quest.resolutionReady?'Entrega completa. Conversá con el contacto para elegir la recompensa.':'Completá la entrega y las condiciones para elegir la recompensa.'} Reintegro de {quest.rewardChoice.reimbursement} pesos o apoyo local (+8).</p>}
     {selected&&<p>{quest.resolutionReady?'Entrega completa. Conversá con el destinatario para confirmar el encargo.':'Completá la entrega y las condiciones. Después, conversá con el destinatario para confirmar.'}</p>}
     {quest.missingQuests.length>0&&<p className="quest-blocker">Primero completá: {quest.missingQuests.join(', ')}.</p>}
     {quest.unsecured.length>0&&<p className="quest-blocker">Primero asegurá: {quest.unsecured.map(sectorName).join(', ')}.</p>}
    </>:quest.status==='completed'?<p>{quest.questResolution?questResolutionText(quest,quest.questResolution):selected?questBeneficiaryResolutionText(quest):quest.delivery} <span className="quest-date">Cumplido: {stamp(quest.completedAt)}.</span></p>:<p>{quest.failureReason==='contacts-dead'?'Ambos destinatarios murieron. El encargo terminó sin recompensa.':quest.escort?'El arriero murió. La escolta terminó sin recompensa.':'El contacto murió. El encargo terminó sin recompensa. Los objetos ya entregados permanecen con el contacto.'} <span className="quest-date">Fallido: {stamp(quest.failedAt)}.</span></p>}
   </article>
  </li>;})}</ul>}
 </section>;
}
