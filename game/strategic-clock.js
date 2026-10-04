// Speeds are simulated seconds per real second. The clock starts paused.
export const STRATEGIC_CLOCK_SPEEDS=Object.freeze([60,300,900,3600]);
export const campaignSeconds=s=>s.hour*3600+(s.secondOfHour??0);
const changed=(before,after)=>after&&JSON.stringify(before)!==JSON.stringify(after);
export function strategicClockInterrupt(before,after){
 if(after.lastError)return after.lastError;
 if(after.defeated)return 'La campaña ha terminado.';
 if(after.pendingEncounter||after.pendingBattle)return 'Un sector necesita órdenes de combate.';
 if(changed(before.travelNotice,after.travelNotice))return after.travelNotice.events.map(e=>`${e.name}: ${e.text}`).join(' ');
 for(const id of after.recruited??[]){
  const old=before.operativeState?.[id],next=after.operativeState?.[id];
  for(const [skill,value] of Object.entries(next?.trainedStats??{}))if(value>(old?.trainedStats?.[skill]??0))return 'Un combatiente mejoró una habilidad.';
 }
 if(changed(before.assignmentAttention?.notice,after.assignmentAttention?.notice))return 'Hay novedades en las asignaciones: revisá el aviso.';
 if(changed(before.contractAttention?.notice,after.contractAttention?.notice))return 'Un contrato necesita atención.';
 if(changed(before.logisticsNotice,after.logisticsNotice))return 'Hay novedades en suministros y entregas.';
 if((after.hiringArrivals?.length??0)<(before.hiringArrivals?.length??0))return 'Llegó un combatiente contratado.';
 const questEvent=(after.contentQuestEvents??[]).slice(before.contentQuestEvents?.length??0).at(-1);
 if(questEvent){const title=after.contentCampaign?.package.quests?.find(q=>q.id===questEvent.quest)?.title??'Un encargo';return `${title}: ${questEvent.to==='failed'?'no pudo completarse.':'hay novedades.'}`;}
 if(after.completed&&!before.completed)return 'Se completó la campaña.';
 return null;
}
