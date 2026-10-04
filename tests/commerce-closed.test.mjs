import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor,deploymentCost} from '../game/campaign.js';
import {prepareCampaignAmmunition} from '../game/campaign-ammunition.js';
import {defaultProfile} from '../game/character-profile.js';

const tradeOrders=['purchaseToolkits','purchaseAmmunition','purchaseGrenades','purchaseMedicalSupplies','purchaseEquipment','purchaseUsedEquipment','sellEquipment','exchangeEquipment','sellArtillery','purchaseUsedArtillery','repurchaseArtillery','resupplyArtillery','supplyArtillery','resupply','repairWeapon'];
test('current campaigns reject commerce orders without charging, creating stock or changing custody',()=>{
 const s=restoreCampaign(serializeCampaign(initialCampaign()));
 const actions=[...tradeOrders.map(type=>({type,operativeId:3,item:1800,quantity:1})),{type:'ammunition',direction:'buy',family:'musket_75',quantity:1}, {type:'sectorInventory',direction:'issueOutfit',sector:'retiro',operativeId:3},...['acquire','hire','feed','breed'].map(type=>({type:'horseAction',order:{type}}))];
 for(const action of actions){const rejected=dispatchCampaign(s,action);assert.match(rejected.lastError,/comercio de equipo no está disponible/);assert.deepEqual({...rejected,lastError:null},s,JSON.stringify(action));}
});
test('deployment can load only actual carried cartridges and never silently buys ammunition',()=>{
 let s=dispatchCampaign(initialCampaign(),{type:'createOfficer',name:'Prueba de inventario',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
 assert.equal(s.lastError,null);const id=1000,record=s.operativeState[id],before=structuredClone(s);
 const quote=prepareCampaignAmmunition(s,rosterFor(s),[id],{at:'retiro',supplied:true});
 assert.equal(quote.cost,0);assert.equal(deploymentCost(s),0);assert.deepEqual(s,before,'quotes cannot mutate owned items');
 const committed=prepareCampaignAmmunition(s,rosterFor(s),[id],{at:'retiro',supplied:true,commit:true});
 assert.equal(committed.cost,0);assert.equal(s.resources.treasury,before.resources.treasury);assert.deepEqual(s.ammunitionShops,before.ammunitionShops);
 assert.equal(committed.issued,quote.issued);assert.equal(record.carriedLoaded,quote.allocation[id].loaded);
 const next=prepareCampaignAmmunition(s,rosterFor(s),[id],{at:'retiro',supplied:true,commit:true});assert.deepEqual(next,committed,'entry cannot mint cartridges');
 assert.ok(restoreCampaign(serializeCampaign(s)));
});
