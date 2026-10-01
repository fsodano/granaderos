import {hasAuthoredDialogue} from '../../game/npc-dialogue.js';
import {canSee} from '../../game/tactical.js';
import {sameCell,tacticalLevel} from '../../game/tactical-space.js';

// The reducer receipt is transient. Save data owns accepted items and quest
// progress; this model only chooses the visible response after movement ends.
export function npcGiftFeedback(battle:any,receipt:any,conversation:any=null){
 if(!receipt||!['accepted','refused'].includes(receipt.status))return null;
 const actor=battle.units.find((unit:any)=>unit.id===receipt.unitId);
 const npc=(battle.npcs??[]).find((person:any)=>person.id===receipt.npcId);
 if(!actor||!npc||!sameCell(npc,receipt)||!canSee(battle,actor,npc))return null;
 const accepted=receipt.status==='accepted',authored=hasAuthoredDialogue(npc);
 const saved=accepted&&conversation?.npcId===npc.id&&conversation.giftCount>0&&conversation.giftCount===npc.questGifts?.length?conversation:null;
 return {id:npc.id,name:npc.name,x:npc.x,y:npc.y,tacticalLevel:tacticalLevel(npc),
  kind:authored?'conversation':'speech',responseOnly:!accepted,
  conversation:saved??{npcId:npc.id,text:receipt.text},text:saved?.text??receipt.text};
}
