import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {equipmentFingerprint} from '../game/tactical-inventory.js';
import {defaultProfile} from '../game/character-profile.js';
import {transportPath} from '../game/logistics.js';import {encodeSave,decodeSave} from '../game/save.js';import {prepareCampaignBattle} from '../game/battle-handoff.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const create={type:'createOfficer',name:'Testigo',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}};
const own=s=>Object.entries(s.sectors).filter(([,r])=>r.owner==='patriot').map(([id])=>id);
const save=s=>{assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);return s;};
test('fresh campaigns start with no recruits, no custom character and only Retiro controlled',()=>{
 for(const seed of [1,8,45]){const s=initialCampaign(seed);assert.deepEqual(own(s),['retiro']);assert.deepEqual(s.recruited,[]);assert.deepEqual(s.squad,[]);assert.deepEqual(s.squads[0].members,[]);assert.deepEqual(s.contracts,{});assert.equal(s.officer,null);assert.equal(s.defeated,false);assert.equal(s.location,'retiro');assert.equal(isSupplied(s,'retiro'),true);assert.equal(isSupplied(s,'buenos_aires'),false);assert.deepEqual(transportPath(s,'reserve','retiro'),['retiro']);save(s);}
});
test('hiring alone builds and deploys a paid squad while the custom character stays absent',()=>{
 let s=initialCampaign(8);for(const id of [110,114])s=order(s,{type:'recruitCivic',id,term:'week'});assert.equal(s.officer,null);assert.deepEqual(s.recruited,[110,114]);assert.deepEqual(s.squad,[110,114]);assert.ok(s.resources.treasury<3200);assert.deepEqual(own(s),['retiro']);save(s);
 assert.ok(dispatchCampaign(s,{type:'purchaseMedicalSupplies',operativeId:110,quantity:2}).lastError);s=order(s,{type:'visitSector'});const pair=prepareCampaignBattle(s);assert.equal(pair.error,null);assert.deepEqual(pair.battle.units.filter(u=>u.side==='player').map(u=>u.id).sort(),['110','114']);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).battle,pair.battle);
});
test('custom-only and mixed squads can form before Buenos Aires is liberated, in either order',()=>{
 for(const orderOf of ['custom','hire-first','custom-first']){let s=initialCampaign(8);if(orderOf==='hire-first')s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,create);if(orderOf==='custom-first')s=order(s,{type:'recruitCivic',id:110,term:'week'});assert.equal(s.officer.name,'Testigo');assert.ok(s.recruited.includes(1000));assert.equal(s.recruited.length,orderOf==='custom'?1:2);assert.deepEqual(own(s),['retiro']);assert.equal(s.sectors.buenos_aires.owner,'royalist');assert.equal(s.defeated,false);save(s);const again=dispatchCampaign(s,create);assert.ok(again.lastError);assert.deepEqual(again.recruited,s.recruited);}
});
test('waiting and academy preparation do not lose the campaign because Buenos Aires starts occupied',()=>{
 let s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'academy'});s=order(s,{type:'wait',hours:24});assert.equal(s.defeated,false);assert.deepEqual(own(s),['retiro']);assert.equal(s.flags.academy,true);save(s);
 const lost=structuredClone(s);lost.sectors.retiro.owner='royalist';const ended=order(lost,{type:'wait',hours:1});assert.equal(ended.defeated,true);assert.match(ended.log.at(-1).text,/Retiro/);
});
test('the first expansion is an actual hostile deployment and never gives the capital for free',()=>{
 let s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});const walked=dispatchCampaign(s,{type:'travel',sector:'buenos_aires'});assert.ok(walked.lastError);assert.deepEqual(own(walked),['retiro']);s=order(s,{type:'attack',sector:'buenos_aires'});assert.ok(s.pendingBattle.enemies.length>0);assert.equal(s.pendingBattle.sector,'buenos_aires');assert.equal(s.sectors.buenos_aires.owner,'royalist');assert.equal(s.officer,null);const pair=prepareCampaignBattle(s);assert.equal(pair.error,null);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).campaign,pair.campaign);
});

test('one paid hire automatically starts the campaign without regiment funding or supply debits',()=>{
 const before=initialCampaign(8),snapshot=structuredClone(before);
 let s=order(before,{type:'recruitCivic',id:110,term:'week'});
 assert.deepEqual(before,snapshot);
 assert.equal(s.phase,1);assert.equal(s.flags.academy,true);assert.deepEqual(s.squad,[110]);
 assert.equal(s.resources.treasury,before.resources.treasury-s.contracts[110].paid);
 for(const key of ['horses','muskets','textiles'])assert.equal(s.resources[key],before.resources[key]);
 const again=order(s,{type:'academy'});assert.deepEqual(again,s,'older clients cannot charge or reward funding again');
 s=order(s,{type:'visitSector'});const pair=prepareCampaignBattle(s);
 assert.equal(pair.error,null);assert.equal(pair.battle.units.filter(u=>u.side==='player').length,1);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
});
test('one created character can start at zero treasury and deploy without purchasing ammunition',()=>{
 const before=initialCampaign(8);before.resources.treasury=0;
 let s=order(before,create);assert.equal(s.resources.treasury,0);assert.equal(s.phase,1);assert.equal(s.flags.academy,true);assert.deepEqual(s.squad,[1000]);
 for(const key of ['horses','muskets','textiles'])assert.equal(s.resources[key],before.resources[key]);
 // The original firearm and its one-time cartridges are already owned.
 // A zero balance permits entry and ordinary weapon storage without refills.
 const allowed=dispatchCampaign(s,{type:'visitSector'});assert.equal(allowed.lastError,null);assert.equal(allowed.resources.treasury,0);assert.equal(allowed.pendingBattle.issuedCartridges,10);
 const actor=sectorInventoryModel(s,'retiro',rosterFor(s),1000).personal;
 s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'arrange',kind:'cursor',cursorAction:'dragEquipment',sourceId:'hand:right',destinationId:'large-1',expectedSource:equipmentFingerprint(actor,'hand:right'),expectedDestination:equipmentFingerprint(actor,'large-1'),count:1});
 assert.equal(s.resources.treasury,0);assert.equal(s.operativeState[1000].weaponDropped,true);assert.ok(Object.values(s.operativeState[1000].inventory).some(i=>i.weapon===actor.weapon));
 s=order(s,{type:'visitSector'});const pair=prepareCampaignBattle(s);assert.equal(pair.error,null);
 assert.deepEqual(pair.battle.units.filter(u=>u.side==='player').map(u=>u.id),['1000']);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
});
test('an empty or failed recruitment cannot unlock the start',()=>{
 const before=initialCampaign(8);before.resources.treasury=0;
 for(const action of [{type:'academy'},{type:'recruitCivic',id:110,term:'week'}]){
  const failed=dispatchCampaign(before,action);assert.ok(failed.lastError);assert.equal(failed.phase,0);assert.equal(failed.flags.academy,false);assert.deepEqual(failed.recruited,[]);assert.equal(failed.resources.treasury,0);
 }
});
