import {settleServiceGuarantee} from './service-guarantees.js';
import {sameCaptivity} from './capture-identity.js';
import {validatePrisonerEscape} from './prisoner-escape.js';
import {restoredCaptiveContract} from './prisoner-custody.js';
import {SUPPLY_ITEMS,itemQuantity,readItemStack} from './tactical-inventory.js';
import {returnEquipment,clearCarriedLoading} from './equipment.js';
const need=(ok,message)=>{if(!ok)throw Error(message);};

// Move confiscated property onto the actual detention map once. The escaped
// soldier carries none of it; later ordinary field pickup can recover it.
export function settlePrisonerEscapes(campaign,request,battle,roster){
 for(const npc of battle.npcs??[]){
  if(!npc.detentionEscape)continue;
  validatePrisonerEscape(npc,battle);
  const id=npc.detention.operativeId,record=campaign.operativeState[id],receipt=campaign.detentionRecords[npc.id],exit=request.exits?.find(e=>e.id===npc.departure.exitId);
  need(sameCaptivity(record,npc.detention)&&receipt&&!receipt.escape&&exit&&campaign.sectors[exit.destination]?.owner==='patriot'&&!campaign.enemyGroups.some(g=>g.target===exit.destination&&['engaged','stationed'].includes(g.status)),'El destino del prisionero no está seguro.');
  const origin=npc.detentionRelease.prisoner,unit={...roster.find(op=>op.id===id),...structuredClone(record),ammunitionVersion:2,loaded:record.capturedAmmunition.loaded,reloadProgress:record.capturedAmmunition.reloadProgress};
  const items=['primary','blade','offhand','headwear','outfit','legwear','cursor',...Object.keys(SUPPLY_ITEMS).filter(k=>k!=='ammo'),...Object.keys(unit.inventory??{}).map(k=>`inventory:${k}`)],cacheIds=[];
  for(const item of items){const count=itemQuantity(unit,item);if(!count)continue;const stack=readItemStack(unit,item,count),cacheId=`custody:${npc.id}:${cacheIds.length}`;
   need(!battle.groundItems.some(g=>g.id===cacheId),'El equipo incautado ya existe en el campo.');
   battle.groundItems.push({...structuredClone(stack),type:'item',id:cacheId,x:origin.x,y:origin.y,tacticalLevel:origin.tacticalLevel??0});cacheIds.push(cacheId);
  }
  const contract=restoredCaptiveContract(record,campaign.hour,campaign.secondOfHour??0);
  if(!contract)settleServiceGuarantee(campaign,record.capturedContract,roster.find(op=>op.id===id));
  for(const horse of campaign.horseState.horses)if(horse.custody?.kind==='captured'&&horse.custody.operativeId===id)horse.custody.kind='field';
  returnEquipment(campaign,id,{weapon:0,blade:0,activeSlot:'unarmed',weaponDropped:false,jammed:false,outfit:null,headwear:null,legwear:null,leftHandItem:null});clearCarriedLoading(record);
  for(const key of Object.keys(SUPPLY_ITEMS))record[key]=0;
  record.inventory={};delete record.pocketOrder;
  Object.assign(record,{captured:false,capturedSector:null,capturedAt:null,capturedAtSecond:null,capturedContract:null,capturedAmmunition:{loaded:0,ammo:0},location:exit.destination,arrival:{battleId:request.id,fromSector:request.sector,fromScene:null,exitId:exit.id,entryEdge:exit.entryEdge,entryAnchor:structuredClone(exit.entryAnchor)},residentSector:null,residentScene:null,asleep:false,sleepCollapsed:false,assignment:contract?(record.hp<record.maxHp||record.bleeding?'patient':'rest'):'active'});
  if(contract){campaign.contracts[id]=contract;campaign.recruited.push(id);const squad=campaign.squads.find(q=>q.location===exit.destination&&!q.journey&&q.members.length<6);if(squad){squad.members.push(id);if(squad.id===campaign.activeSquadId)campaign.squad=[...squad.members];}}
  receipt.escape={battleId:request.id,hour:campaign.hour,destination:exit.destination,cacheIds};
  campaign.log.unshift({hour:campaign.hour,text:`${npc.name} escapa hacia ${exit.destination}. Conserva sus heridas; su equipo permanece en el lugar de cautiverio.${contract?' Retoma el servicio pendiente.':' Su contrato había terminado.'}`});campaign.log=campaign.log.slice(0,80);
 }
}
