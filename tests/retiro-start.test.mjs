import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,isSupplied,contractQuote,rosterFor} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';
import {defaultContentPackage} from '../game/content-package.js';
import {hiringArrivalOptions} from '../game/hiring-arrivals.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const create={type:'createOfficer',name:'Testigo',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}};
const owned=s=>Object.entries(s.sectors).filter(([,r])=>r.owner==='patriot').map(([id])=>id);
const save=s=>{const restored=decodeSave(encodeSave(s)).campaign;assert.deepEqual(restored,s);return restored;};

test('new campaigns have only Retiro, an empty force, pesos and a working headquarters supply line',()=>{
 for(const seed of [1,8,45])for(const content of [null,defaultContentPackage()]){
  const s=initialCampaign(seed,content);assert.deepEqual(owned(s),['retiro']);assert.deepEqual(s.recruited,[]);assert.deepEqual(s.squad,[]);assert.deepEqual(s.squads[0].members,[]);assert.deepEqual(s.contracts,{});assert.equal(s.officer,null);assert.equal(s.location,'retiro');assert.equal(s.defeated,false);assert.deepEqual(s.resources,{treasury:3200});assert.equal(isSupplied(s,'retiro'),true);assert.equal(isSupplied(s,'buenos_aires'),false);assert.deepEqual(hiringArrivalOptions(s).map(o=>o.id),['retiro']);save(s);
 }
});
test('a created character starts free at zero pesos, but ammunition and equipment still have real prices',()=>{
 const before=initialCampaign(8);before.resources.treasury=0;const snapshot=structuredClone(before);
 const s=order(before,create);assert.deepEqual(before,snapshot);assert.equal(s.resources.treasury,0);assert.equal(s.phase,1);assert.equal(s.flags.academy,true);assert.deepEqual(s.squad,[1000]);assert.deepEqual(owned(s),['retiro']);assert.equal(s.contracts[1000].paid,0);save(s);
 assert.deepEqual(order(s,{type:'academy'}),s);assert.ok(dispatchCampaign(s,{type:'visitSector'}).lastError);assert.ok(dispatchCampaign(s,{type:'purchaseEquipment',item:1801}).lastError);
 const funded=order(initialCampaign(8),create),entered=order(funded,{type:'visitSector'}),battle=enterSector(entered.pendingBattle);
 assert.equal(battle.mode,'exploration');assert.deepEqual(battle.units.filter(u=>u.side==='player').map(u=>u.id),['1000']);assert.equal(funded.resources.treasury-entered.resources.treasury,entered.pendingBattle.issuedCartridges);assert.deepEqual(decodeSave(encodeSave(entered,battle)).battle,battle);
});
test('hired-only opening waits for actual arrival and retains every term across saves',()=>{
 for(const [term,hours]of [['day',24],['week',168],['month',720]]){
  let s=initialCampaign(8,defaultContentPackage());const price=contractQuote(s,rosterFor(s).find(o=>o.id===110),term).price;
  s=order(s,{type:'recruitCivic',id:110,term});assert.equal(s.phase,0);assert.equal(s.flags.academy,false);assert.deepEqual(s.recruited,[]);assert.equal(s.resources.treasury,3200-price);assert.ok(dispatchCampaign(s,{type:'academy'}).lastError);
  s=order(save(s),{type:'wait',hours:5});assert.equal(s.phase,0);s=order(save(s),{type:'wait',hours:1});assert.equal(s.phase,1);assert.equal(s.flags.academy,true);assert.equal(s.officer,null);assert.deepEqual(s.squad,[110]);assert.equal(s.contracts[110].started,6);assert.equal(s.contracts[110].expiresAt,6+hours);assert.equal(s.resources.treasury,3200-price);assert.deepEqual(owned(s),['retiro']);assert.deepEqual(order(s,{type:'academy'}),s);save(s);
 }
});
test('an empty start or cancelled and unaffordable hire cannot unlock the chapter',()=>{
 let s=initialCampaign(8,defaultContentPackage());s=order(s,{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'cancelHireArrival',id:110});s=order(s,{type:'wait',hours:6});assert.equal(s.phase,0);assert.equal(s.resources.treasury,3200);assert.equal(s.defeated,false);
 s.resources.treasury=0;for(const action of [{type:'academy'},{type:'recruitCivic',id:110,term:'week'}]){const failed=dispatchCampaign(s,action);assert.ok(failed.lastError);assert.deepEqual({...failed,lastError:null},s);}
});
test('custom and paid paths can be combined in either order without owning Buenos Aires',()=>{
 for(const first of ['hire','custom']){let s=initialCampaign(8);if(first==='hire')s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,create);if(first==='custom')s=order(s,{type:'recruitCivic',id:110,term:'week'});assert.deepEqual(new Set(s.recruited),new Set([110,1000]));assert.equal(s.phase,1);assert.deepEqual(owned(s),['retiro']);assert.ok(dispatchCampaign(s,create).lastError);save(s);}
});
test('Retiro supplies the first workshop and losing headquarters ends the campaign',()=>{
 let s=order(initialCampaign(8),{type:'purchaseEquipment',item:1801});assert.ok(s.armory[1801]>0);assert.ok(s.resources.treasury<3200);s=order(s,{type:'wait',hours:24});assert.equal(s.defeated,false);assert.deepEqual(owned(s),['retiro']);
 s.sectors.buenos_aires.owner='patriot';assert.equal(isSupplied(s,'buenos_aires'),true);s.sectors.retiro.owner='royalist';assert.equal(isSupplied(s,'buenos_aires'),false);s=order(s,{type:'wait',hours:1});assert.equal(s.defeated,true);assert.match(s.log[0].text,/Retiro/);save(s);
});
test('existing saves retain their controlled territory, spent treasury and unlocked chapter',()=>{
 let s=initialCampaign(8);for(const id of ['buenos_aires','ensenada'])s.sectors[id].owner='patriot';s.flags.academy=true;s.phase=1;s.resources.treasury=2900;
 s=save(s);const resumed=order(s,{type:'academy'});assert.deepEqual(resumed.sectors,s.sectors);assert.deepEqual(resumed.resources,s.resources);assert.equal(resumed.phase,s.phase);assert.deepEqual(owned(s).sort(),['buenos_aires','ensenada','retiro']);assert.equal(s.resources.treasury,2900);
});
test('the first hostile deployment cannot gain the capital through a travel order',()=>{
 let s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});const failed=dispatchCampaign(s,{type:'travel',sector:'buenos_aires'});assert.ok(failed.lastError);assert.deepEqual({...failed,lastError:null},s);
 s=order(s,{type:'attack',sector:'buenos_aires'});assert.deepEqual(owned(s),['retiro']);assert.equal(s.pendingBattle.sector,'buenos_aires');assert.ok(s.pendingBattle.enemies.length>0);const battle=enterSector(s.pendingBattle);assert.ok(battle.units.some(u=>u.side==='enemy'));assert.deepEqual(decodeSave(encodeSave(s,battle)).battle,battle);
});
