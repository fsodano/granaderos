'use client';
import {prisonerReleasePreview,teamCanSee} from '../../game/tactical.js';
export default function PrisonerActions({state,unit,busy,onRelease,onEscort}:{state:any;unit:any;busy:boolean;onRelease:(id:string)=>void;onEscort:(id:string,order:'follow'|'wait')=>void}){
 const prisoners=(state.npcs??[]).filter((npc:any)=>npc.detention&&npc.hp>0&&teamCanSee(state,'player',npc));
 if(!prisoners.length)return null;
 const cost=(preview:any)=>state.mode==='exploration'?' · 1 s':` · ${preview.cost} PA`;
 return <section className="hud-mission" aria-label="Prisioneros a la vista"><h2>Prisioneros a la vista</h2><p>Soltá sus ataduras para que te sigan. Recuperá el sector para devolverlos a tu escuadra.</p><ul>{prisoners.map((npc:any)=>{
  const preview=prisonerReleasePreview(state,unit,npc),leader=state.units.find((u:any)=>u.id===npc.escort?.leaderId);
  const able=leader&&leader.hp>=15&&!leader.unconscious&&!leader.departure&&!leader.fled&&!leader.routed&&!leader.surrendered&&leader.energy>0;
  const follow=prisonerReleasePreview(state,unit,npc,'follow'),wait=prisonerReleasePreview(state,unit,npc,'wait');
  return <li key={npc.id}><strong>{npc.name}</strong> · {npc.hp}/{npc.maxHp} salud {npc.detention.freed?<>
   <span>{npc.unconscious?'Necesita atención antes de caminar.':npc.escort.waiting?'Espera aquí.':!able?'Necesita otro rescatista.':`Sigue a ${leader.name}.`}</span>
   <button className="line-button" disabled={busy||!follow.valid} title={follow.reason??undefined} onClick={()=>onEscort(npc.id,'follow')}>Seguirme{cost(follow)}</button>
   <button className="line-button" disabled={busy||!wait.valid} title={wait.reason??undefined} onClick={()=>onEscort(npc.id,'wait')}>Esperar aquí{cost(wait)}</button>
  </>:<><button className="line-button" disabled={busy||!preview.valid} onClick={()=>onRelease(npc.id)}>Soltar ataduras{cost(preview)}</button>{preview.reason&&<span>{preview.reason}</span>}{npc.unconscious&&<span>Necesita atención antes de caminar.</span>}</>}</li>;
 })}</ul></section>;
}
