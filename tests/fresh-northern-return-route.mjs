import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';

export function prepareFreshTucumanRecapture(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'travel',sector:'cordoba',mode:'posta'});order({type:'purchaseMedicalSupplies',operativeId:5,quantity:20});
order({type:'assignCare',operativeId:5,assignment:'doctor'});order({type:'assignCare',operativeId:7,assignment:'patient'});order({type:'assignCare',operativeId:57,assignment:'patient'});
for(let h=0;h<72&&[7,57].some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp);h++){
 if(!c.operativeState[5].medkits)order({type:'purchaseMedicalSupplies',operativeId:5,quantity:10});
 if(c.operativeState[7].hp===c.operativeState[7].maxHp&&c.operativeState[7].medkits&&c.operativeState[7].assignment!=='doctor')order({type:'assignCare',operativeId:7,assignment:'doctor'});
 order({type:'wait',hours:1});
}
for(const id of [7,57])assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);
for(const operativeId of c.squad){order({type:'resupply',operativeId});order({type:'repairWeapon',operativeId});order({type:'assignCare',operativeId,assignment:'rest'});}
order({type:'purchaseEquipment',item:'bronze4'});order({type:'configureArtillery',types:['bronze4']});
for(let h=0;h<48&&(c.hour%24!==6||c.squad.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'attack',sector:'tucuman',queue:true,mode:'posta'});for(let h=0;h<24&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';h++)order({type:'wait',hours:1});for(let h=0;h<24&&c.hour%24!==22;h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'tucuman'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),[7,57,5]);
 assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,1);
 return c;
}

export function prepareFreshSaltaRecapture(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'travel',sector:'cordoba',mode:'posta'});order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:['swivel']});if(c.operativeState[57].medkits<10)order({type:'purchaseMedicalSupplies',operativeId:57,quantity:10-c.operativeState[57].medkits});
order({type:'travel',sector:'tucuman',mode:'posta'});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});
for(let h=0;h<48&&(c.hour%24!==18||c.squad.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});
order({type:'attack',sector:'salta',queue:true,mode:'posta'});for(let h=0;h<24&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'salta'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),[7,57,5]);
 assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,1);
 return c;
}

export function prepareFreshJujuyAssault(start){
 let c=decodeSave(encodeSave(start)).campaign;
 const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};
order({type:'travel',sector:'cordoba',mode:'posta'});order({type:'purchaseEquipment',item:'swivel'});order({type:'configureArtillery',types:['swivel']});order({type:'travel',sector:'salta',mode:'posta'});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'rest'});for(let h=0;h<48&&(c.hour%24!==18||c.squad.some(id=>c.operativeState[id].fatigue>0));h++)order({type:'wait',hours:1});for(const operativeId of c.squad)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:'jujuy',queue:true,mode:'posta'});for(let h=0;h<24&&c.squads.find(q=>q.id===c.activeSquadId).journey?.status!=='ready';h++)order({type:'wait',hours:1});for(let h=0;h<24&&c.hour%24!==6;h++)order({type:'wait',hours:1});order({type:'beginAssault',sector:'jujuy'});
 assert.deepEqual(c.pendingBattle.squad.map(u=>u.id),[7,57,5]);
 assert.equal(c.pendingBattle.artillery.filter(g=>!g.stationed).length,1);
 return c;
}
