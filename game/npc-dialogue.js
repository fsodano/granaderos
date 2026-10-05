import {sameSurface} from './tactical-space.js';
import {NPC_QUESTS} from './quests.js';
import {civilianWoundedByPlayer} from './civilian-harm.js';
// Authored conversation is a capability, independent of recruitment.
export function hasAuthoredDialogue(npc){
 return Boolean(npc&&(npc.dialogue==='special'||npc.operativeId!==undefined||npc.mission||NPC_QUESTS.some(q=>q.npcId===npc.id)));
}
export function dialogueOptions(npc,quest=null){
 if(!hasAuthoredDialogue(npc)&&!quest)return [];
 return [['repeat','Repetir respuesta'],['friendly','Saludar'],['direct',npc.operativeId!==undefined?'Preguntar por sus condiciones':'Preguntar por la localidad'],['threaten','Amenazar'],...(npc.mission?[['mission','Conversar sobre la misión']]:[]),
 ...(quest&&!['completed','failed','withdrawn'].includes(quest.status)&&(!quest.carried||quest.status!=='offered'||(quest.rewardChoice||quest.beneficiaries)&&quest.resolutionReady)?[['quest',quest.status==='offered'?(quest.beneficiaries?'Confirmar entrega':quest.rewardChoice?'Elegir recompensa':quest.escort?'Confirmar llegada a la salida':'Entregar pertrechos'):(quest.escort?'Aceptar escolta':'Consultar encargo')]]:[]),
 ...(quest?.withdrawalChoice?[['questWithdraw','Retirar el compromiso']]:[]),
 ...(quest?.escort&&quest.status==='offered'?[['escortFollow','Seguir a este combatiente'],['escortWait','Esperar aquí']]:[]),
 ...(npc.operativeId!==undefined?[['recruit','Proponer incorporación']]:[])];
}
// Threats are an authored response, not a free recruitment or quest shortcut.
export function contextualThreatReply(npc,quest=null){
 if(npc.threatenedReply)return npc.threatenedReply;
 if(npc.mission)return 'Bajá la voz. Tenemos una campaña que conducir; las amenazas no sirven aquí.';
 if(quest?.status==='completed')return 'Cumplí mi parte del trato. No voy a responder a amenazas.';
 if(quest?.status==='failed')return 'El encargo ya terminó. Una amenaza no va a cambiar lo ocurrido.';
 if(quest?.escort)return 'Necesito llegar a salvo. Hablame con respeto si querés que te acompañe.';
 if(quest)return 'Los vecinos necesitan ayuda. Las amenazas no van a resolver este encargo.';
 if(npc.operativeId!==undefined)return 'Puedo servir por voluntad propia. No vas a contratarme con amenazas.';
 return npc.sector?`En esta localidad tratamos con respeto a quien llega. Guardá tus amenazas.`:'Guardá tus amenazas. Podemos conversar con respeto.';
}
export function dialogueApproach(reachable,target){
 return target?reachable.filter(point=>sameSurface(point,target)&&Math.abs(point.x-target.x)+Math.abs(point.y-target.y)===1).sort((a,b)=>(a.cost??0)-(b.cost??0))[0]:undefined;
}
export function dialogueAvailability(state,actor,target,{visible=true,busy=false}={}){
 const result=(code,reason)=>({code,reason,canApproach:code==='level'||code==='range'});
 if(busy||!actor||actor.side!=='player'||actor.hp<=0||actor.unconscious||actor.routed||actor.departure||actor.knockedDown||actor.energy<=0||state.phase!=='player'||!['active','victory'].includes(state.status))return result('actor','El combatiente no puede conversar ahora.');
 if(!target||!visible||target.departure||target.fled||target.routed||(target.hp??100)<=0||target.unconscious)return result('target','El interlocutor no está disponible.');
 if(hasAuthoredDialogue(target)&&state.mode!=='exploration'&&state.status!=='victory'&&!state.sectorCleared)return result('combat','Terminá el combate antes de conversar.');
 if(!sameSurface(actor,target))return result('level','Acercate al mismo nivel para hablar.');
 if(Math.abs(actor.x-target.x)+Math.abs(actor.y-target.y)>1)return result('range','Acercate a una casilla contigua para hablar.');
 if(civilianWoundedByPlayer(target))return result('refused','Me heriste. No voy a ayudarte.');
 return result(null,null);
}
export const dialogueReason=(state,actor,target,options)=>dialogueAvailability(state,actor,target,options).reason;
const replies={
 hurt:['Me heriste. No voy a ayudarte.','Alejate. No quiero hablar con vos.','No voy a ayudarte después de lo que hiciste.'],
 enemy:['¡No des un paso más!','No tengo nada que hablar con vos.','¡Apartate de mi puesto!'],
 surrendered:['Ya dejé el arma.','No voy a resistirme.','Solo quiero salir de aquí con vida.'],
 danger:['¡Busco refugio!','¡No te quedes en medio del fuego!','Ahora no. Tengo que ponerme a salvo.'],
 working:['Disculpá, estoy trabajando.','Tengo que terminar esta tarea.','Hoy hay mucho por hacer.'],
 civilian:['Buen día.','Disculpá, ahora estoy ocupado.','Que tengas buen viaje.'],
};
export function ambientReply(npc,sequence=0){
 const category=civilianWoundedByPlayer(npc)?'hurt':npc.surrendered?'surrendered':npc.side==='enemy'?'enemy':['hiding','fleeing'].includes(npc.ai?.activity)?'danger':npc.ai?.activity==='working'?'working':'civilian';
 const lines=category==='civilian'&&npc.greeting?[npc.greeting,...replies.civilian]:replies[category];
 const hash=[...String(npc.id)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
 return lines[(hash+Math.max(0,Math.floor(sequence)))%lines.length];
}
