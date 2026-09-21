import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';

export function prepareFreshTucumanRecapture(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'travel',sector:'cordoba',mode:'posta'});order({type:'purchaseMedicalSupplies',operativeId:57,quantity:15});
order({type:'assignCare',operativeId:57,assignment:'doctor'});order({type:'assignCare',operativeId:6,assignment:'patient'});
for(let i=0;i<36&&c.operativeState[6].hp<c.operativeState[6].maxHp;i++)order({type:'wait',hours:1});assert.equal(c.operativeState[6].hp,c.operativeState[6].maxHp);
for(let h=0;h<240&&(c.merchants.cordoba.ammunition.musket_69??0)<60;h++)order({type:'wait',hours:1});order({type:'purchaseAmmunition',ammoType:'musket_69',quantity:60});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<36&&c.squad.some(id=>c.operativeState[id].fatigue>0);h++)order({type:'wait',hours:1});
for(let h=0;h<48&&(c.hour%24!==6||c.squad.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});
for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
 order({type:'purchaseEquipment',item:'bronze4'});
 order({type:'attack',sector:'tucuman',queue:true,mode:'posta'});
 for(let h=0;h<20&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';h++)order({type:'wait',hours:1});
 order({type:'beginAssault',sector:'tucuman'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),[57,6]);
 assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,1);
 return c;
}
