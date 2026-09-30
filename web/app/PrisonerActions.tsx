'use client';
import {prisonerReleasePreview,teamCanSee} from '../../game/tactical.js';
export default function PrisonerActions({state,unit,busy,onRelease,onEscort}:{state:any;unit:any;busy:boolean;onRelease:(id:string)=>void;onEscort:(id:string,order:'follow'|'wait')=>void}){
 const prisoners=(state.npcs??[]).filter((npc:any)=>npc.detention&&npc.hp>0&&teamCanSee(state,'player',npc));
 const escaped=(state.npcs??[]).filter((npc:any)=>npc.detentionEscape&&npc.departure);
 if(!prisoners.length&&!escaped.length)return null;
 const cost=(preview:any)=>state.mode==='exploration'?' · 1 s':` · ${preview.cost} PA`;
 return <section className="hud-mission" aria-label="Prisioneros a la vista"><h2>Prisioneros a la vista</h2><p>Soltá sus ataduras para que te sigan. Para escapar, llevá a cada prisionero junto a su rescatista al mismo borde y usá Retirada. Necesita poder caminar y la orden de seguir. El equipo queda en el lugar de cautiverio.</p><ul>{prisoners.map((npc:any)=>{
  const preview=prisonerReleasePreview(state,unit,npc),leader=state.units.find((u:any)=>u.id===npc.escort?.leaderId);
  const able=leader&&leader.hp>=15&&!leader.unconscious&&!leader.departure&&!leader.fled&&!leader.routed&&!leader.surrendered&&leader.energy>0;
  const danger=Boolean(npc.ai?.threat&&(state.elapsedSeconds??0)<npc.ai.safeAfter),sheltering=danger&&['fleeing','hiding'].includes(npc.ai?.activity);
  const alarm=npc.ai?.threat?.kind==='fire'?'los disparos':npc.ai?.threat?.kind==='explosion'?'una explosión':'la alarma';
  const follow=prisonerReleasePreview(state,unit,npc,'follow'),wait=prisonerReleasePreview(state,unit,npc,'wait');
  return <li key={npc.id}><strong>{npc.name}</strong> · {npc.hp}/{npc.maxHp} salud {npc.detention.freed?<>
   <span>{npc.unconscious?'Necesita atención antes de caminar.':sheltering?`${npc.ai.activity==='fleeing'?'Busca refugio':'Permanece a cubierto'} por ${alarm}. ${npc.escort.waiting?'Tiene la orden de esperar.':able?`Volverá a seguir a ${leader.name} cuando pase el peligro.`:'Necesita otro rescatista.'}`:npc.escort.waiting?'Espera aquí.':!able?'Necesita otro rescatista.':`Sigue a ${leader.name}.`}</span>
   <button className="line-button" disabled={busy||!follow.valid} title={follow.reason??undefined} onClick={()=>onEscort(npc.id,'follow')}>Seguirme{cost(follow)}</button>
   <button className="line-button" disabled={busy||!wait.valid} title={wait.reason??undefined} onClick={()=>onEscort(npc.id,'wait')}>Esperar aquí{cost(wait)}</button>
  </>:<><button className="line-button" disabled={busy||!preview.valid} onClick={()=>onRelease(npc.id)}>Soltar ataduras{cost(preview)}</button>{preview.reason&&<span>{preview.reason}</span>}{npc.unconscious&&<span>Necesita atención antes de caminar.</span>}</>}</li>;
 })}</ul>{escaped.length>0&&<ul aria-label="Prisioneros que salieron">{escaped.map((npc:any)=><li key={npc.id}>{npc.name} salió hacia {npc.departure.destination.replaceAll('_',' ')}. Su equipo queda en el lugar de cautiverio.</li>)}</ul>}</section>;
}
