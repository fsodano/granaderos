import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
// Continue from an actual recapture. A paid medic arrives at the routed
// patient's location; remaining dressings come from the controlled workshop.
export function recoverRecapturedRoad(start){
let c=decodeSave(encodeSave(start)).campaign;
const prior=structuredClone(c), events=[];
const order=a=>{if(['wait','travel'].includes(a.type))for(const id of c.recruited.filter(id=>c.operativeState[id].alive)){let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+(a.type==='wait'?a.hours:24)){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;q=c.contracts[id];}}const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;events.push({action:a,hour:c.hour,funds:c.resources.treasury});};

 order({type:'recruitCivic',id:130,term:'day',destination:'buenos_aires'});
 for(const id of c.recruited)if(c.operativeState[id].alive)order({type:'assignCare',operativeId:id,assignment:id===124?'patient':'rest'});
 for(let h=0;h<24&&!c.recruited.includes(130);h++)order({type:'wait',hours:1});assert.ok(c.recruited.includes(130));
 order({type:'createSquad',ids:[130,124],sector:'buenos_aires',name:'Puesto sanitario'});
 const wounded=()=>c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&(r.hp<r.maxHp||r.bleeding);});
 for(let h=0;h<100&&wounded().length;h++){
  assert.equal(c.pendingEncounter,null);
  for(const at of ['buenos_aires','cordoba']){
   const ids=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location===at);
   const patients=ids.filter(id=>wounded().includes(id));if(!patients.length)continue;
   const local=c.squads.find(q=>q.location===at&&q.members.some(id=>ids.includes(id)));assert.ok(local);order({type:'selectSquad',id:local.id});
   const medic=rosterFor(c).filter(o=>ids.includes(o.id)&&c.operativeState[o.id].hp>=15&&!c.operativeState[o.id].bleeding&&c.operativeState[o.id].energy>10&&o.medical>=20&&patients.some(id=>id!==o.id)).sort((a,b)=>Number(patients.includes(a.id))-Number(patients.includes(b.id))||b.medical-a.medical)[0];assert.ok(medic,at);
   if(!c.operativeState[medic.id].medkits){
    const model=()=>sectorInventoryModel(c,at,rosterFor(c),medic.id);let row=model().entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');
    if(!row){const donor=ids.find(id=>id!==medic.id&&c.operativeState[id].medkits>0);if(donor){order({type:'sectorInventory',sector:at,operativeId:donor,direction:'drop',item:'medkits',count:1});row=model().entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');}}
    if(row)order({type:'sectorInventory',sector:at,operativeId:medic.id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
    else if(at==='buenos_aires'){
     for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
     order({type:'travel',sector:'retiro',mode:'posta'});assert.equal(c.location,'retiro');
     order({type:'purchaseMedicalSupplies',operativeId:medic.id,quantity:6});
     order({type:'travel',sector:'buenos_aires',mode:'posta'});assert.equal(c.location,at);
    }else order({type:'purchaseMedicalSupplies',operativeId:medic.id,quantity:1});
   }
   for(const id of ids)order({type:'assignCare',operativeId:id,assignment:id===medic.id?'doctor':patients.includes(id)?'patient':'rest'});
  }
  order({type:'wait',hours:1});
 }
 assert.deepEqual(wounded(),[]);for(const [id,r]of Object.entries(prior.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 for(const id of prior.recruited.filter(id=>prior.operativeState[id].alive))assert.ok(c.operativeState[id].alive,`care must preserve ${id}`);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);return {campaign:c,events};
}
