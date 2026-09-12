import {sameSurface} from './tactical-space.js';
import {NPC_QUESTS} from './quests.js';
// Authored conversation is a capability, independent of recruitment.
export function hasAuthoredDialogue(npc){
 return Boolean(npc&&(npc.dialogue==='special'||npc.operativeId!==undefined||npc.mission||NPC_QUESTS.some(q=>q.npcId===npc.id)));
}
export function dialogueOptions(npc,quest=null){
 if(!hasAuthoredDialogue(npc))return [];
 return [['repeat','Repetir respuesta'],...(npc.mission?[['mission','Conversar sobre la misión']]:[['friendly','Saludar'],['direct',npc.operativeId!==undefined?'Preguntar por sus condiciones':'Preguntar por la localidad']]),
 ...(quest&&quest.status!=='completed'&&(!quest.carried||quest.status!=='offered')?[['quest',quest.status==='offered'?'Entregar pertrechos':'Consultar encargo']]:[]),
 ...(npc.operativeId!==undefined?[['recruit','Proponer incorporación']]:[])];
}
export function dialogueApproach(reachable,target){
 return target?reachable.filter(point=>sameSurface(point,target)&&Math.abs(point.x-target.x)+Math.abs(point.y-target.y)===1).sort((a,b)=>(a.cost??0)-(b.cost??0))[0]:undefined;
}
export function dialogueReason(state,actor,target,{visible=true,busy=false}={}){
 if(busy||!actor||actor.side!=='player'||actor.hp<=0||actor.unconscious||actor.routed||actor.departure||actor.knockedDown||actor.energy<=0||state.phase!=='player'||!['active','victory'].includes(state.status))return 'El combatiente no puede conversar ahora.';
 if(!target||!visible||target.departure||target.fled||target.routed||(target.hp??100)<=0||target.unconscious)return 'El interlocutor no está disponible.';
 if(hasAuthoredDialogue(target)&&state.mode!=='exploration'&&state.status!=='victory'&&!state.sectorCleared)return 'Terminá el combate antes de conversar.';
 if(!sameSurface(actor,target))return 'Acercate al mismo nivel para hablar.';
 if(Math.abs(actor.x-target.x)+Math.abs(actor.y-target.y)>1)return 'Acercate a una casilla contigua para hablar.';
 return null;
}
const replies={
 enemy:['¡No des un paso más!','No tengo nada que hablar con vos.','¡Apartate de mi puesto!'],
 surrendered:['Ya dejé el arma.','No voy a resistirme.','Solo quiero salir de aquí con vida.'],
 danger:['¡Busco refugio!','¡No te quedes en medio del fuego!','Ahora no. Tengo que ponerme a salvo.'],
 working:['Disculpá, estoy trabajando.','Tengo que terminar esta tarea.','Hoy hay mucho por hacer.'],
 civilian:['Buen día.','Disculpá, ahora estoy ocupado.','Que tengas buen viaje.'],
};
export function ambientReply(npc,sequence=0){
 const category=npc.surrendered?'surrendered':npc.side==='enemy'?'enemy':['hiding','fleeing'].includes(npc.ai?.activity)?'danger':npc.ai?.activity==='working'?'working':'civilian';
 const lines=category==='civilian'&&npc.greeting?[npc.greeting,...replies.civilian]:replies[category];
 const hash=[...String(npc.id)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
 return lines[(hash+Math.max(0,Math.floor(sequence)))%lines.length];
}
