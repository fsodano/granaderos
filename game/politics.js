// Campaign policy values are game balance, not reconstructed historical tariffs.
export function tradeQuote(state,basePrice){
 const reputation=state.reputation.foreign;
 const rate=reputation>=60?.8:reputation>=40?.9:reputation<0?1.5:reputation<20?1.2:1;
 return Math.ceil(basePrice*rate);
}
export function policyStatus(state){
 return {taxDue:!state.completed&&state.hour>=168&&(state.politics?.taxPaidPeriod??0)<Math.floor(state.hour/168),tax:120,
 requisitionReady:state.hour>=(state.politics?.requisitionAfter??0),nextRequisition:Math.max(0,(state.politics?.requisitionAfter??0)-state.hour)};
}
const standing=(s,id,n)=>{s.reputation[id]=Math.max(-100,Math.min(100,s.reputation[id]+n));};
const note=(s,text)=>{s.log.unshift({hour:s.hour,text});s.log=s.log.slice(0,80);};
export function applyPolicy(s,kind){
 s.politics??={};
 if(kind==='tax'){
  if(!policyStatus(s).taxDue)throw Error('No hay una contribución nacional pendiente.');
  if(s.resources.treasury<120)throw Error('Se necesitan 120 pesos para la contribución.');
  s.resources.treasury-=120;s.politics.taxPaidPeriod=Math.floor(s.hour/168);standing(s,'directory',8);note(s,'Se remiten 120 pesos al gobierno. El cumplimiento fortalece el apoyo del Directorio.');
 }else if(kind==='frontierRequisition'){
  if(!['mendoza','uspallata','los_patos'].includes(s.location)||s.sectors[s.location].owner!=='patriot')throw Error('La requisa de frontera requiere presencia en un sector propio de Cuyo.');
  if(!policyStatus(s).requisitionReady)throw Error('Las estancias todavía no han recuperado sus existencias.');
  s.politics.requisitionAfter=s.hour+336;s.resources.treasury+=160;standing(s,'indigenous',-35);standing(s,'gauchos',-15);
  s.sectors[s.location].loyalty=Math.max(0,s.sectors[s.location].loyalty-15);
  if(s.flags.parliament){s.flags.parliament=false;note(s,'La requisa rompe el parlamento. Habrá que renovar el acuerdo de los pasos.');}
  note(s,'Se toman 160 pesos de la frontera. La población denuncia la violación de sus acuerdos.');
 }else throw Error('La orden política no existe.');
}
export function dailyPolitics(s){
 if(s.completed||s.defeated)return;
 s.politics??={};
 if(s.hour%168===0){
  if(s.hour>168&&(s.politics.taxPaidPeriod??0)<Math.floor(s.hour/168)-1){standing(s,'directory',-8);note(s,'El gobierno reclama la contribución vencida. Disminuye su confianza en el ejército.');}
  if(!s.flags.emancipation||!s.flags.commission){standing(s,'pardos',-3);note(s,'Los batallones de Pardos y Morenos reclaman garantías y acceso a las comisiones.');}
  if(s.reputation.indigenous<0){const at=['uspallata','los_patos','mendoza'].find(id=>s.sectors[id].owner==='patriot');if(at){const lost=Math.min(100,s.resources.treasury);s.resources.treasury-=lost;s.sectors[at].damageUntil=Math.max(s.sectors[at].damageUntil,s.hour+72);note(s,`Una partida de frontera recupera ${lost} pesos y perturba la actividad de las estancias de Cuyo durante tres días.`);}}
 }
}
export function validatePolitics(s){
 const p=s.politics??{};
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['taxPaidPeriod','requisitionAfter'].includes(k))||Object.values(p).some(v=>!Number.isInteger(v)||v<0||v>1e9)||(p.taxPaidPeriod??0)>Math.floor(s.hour/168))throw Error('Las decisiones políticas guardadas son inválidas.');
}
