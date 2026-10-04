import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage,resolveContent} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {freshDefaultRoadsideDiscoveries,roadsideDiscoveriesFor,validateRoadsideDiscoveries} from '../game/roadside-discoveries.js';
import {buildSectorMap} from '../game/maps.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';

const CELL='cell-24-27',CHEST='roadside:cell-24-27:clothing-tools';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const saved=s=>restoreCampaign(serializeCampaign(s));
function pending(content=defaultContentPackage()){
 let c=order(initialCampaign(42,content),{type:'recruitCivic',id:110,term:'week'});
 c=order(c,{type:'wait',hours:6});
 c=order(c,{type:'visitSector'});
 const pair=prepareCampaignBattle(c);assert.equal(pair.error,null,pair.error);
 return decodeSave(encodeSave(pair.campaign,pair.battle));
}

test('fresh discovery definitions are detached, pinned content with one finite period-tool cache',()=>{
 const d=defaultContentPackage(),definitions=freshDefaultRoadsideDiscoveries();
 assert.deepEqual(d.roadsideDiscoveries,definitions);
 assert.deepEqual(definitions,[{version:1,id:'roadside-clothing-tools',cell:CELL,x:10,y:7,crowbarCondition:60,linenShirtCondition:75}]);
 assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(resolveContent(d),d);
 assert.deepEqual(campaignContentReport(d).blocked,[]);
 const c=initialCampaign(42,d),plain=initialCampaign(42);
 assert.deepEqual(roadsideDiscoveriesFor(c),definitions);assert.deepEqual(roadsideDiscoveriesFor(plain),definitions);
 const hash=c.contentCampaign.identity.hash;
 d.roadsideDiscoveries[0].crowbarCondition=90;definitions[0].linenShirtCondition=90;
 assert.equal(roadsideDiscoveriesFor(c)[0].crowbarCondition,60);
 assert.equal(roadsideDiscoveriesFor(plain)[0].linenShirtCondition,75);
 assert.equal(saved(c).contentCampaign.identity.hash,hash);assert.deepEqual(saved(plain).roadsideDiscoveryDefinitions,plain.roadsideDiscoveryDefinitions);
 const changed=structuredClone(c);changed.contentCampaign.package.roadsideDiscoveries[0].crowbarCondition=61;
 assert.throws(()=>saved(changed),/identidad/);
});

test('omitted and explicitly disabled packages stay neutral after restore and map construction',()=>{
 for(const mode of ['omitted','disabled']){
  const d=defaultContentPackage();if(mode==='omitted')delete d.roadsideDiscoveries;else d.roadsideDiscoveries=[];
  const c=saved(initialCampaign(42,d));assert.deepEqual(roadsideDiscoveriesFor(c),[]);
  assert.equal(Object.hasOwn(c.contentCampaign.package,'roadsideDiscoveries'),mode==='disabled');
  // A plain-state snapshot must never override an explicit package's omission.
  const shadow=structuredClone(c);shadow.roadsideDiscoveryDefinitions=freshDefaultRoadsideDiscoveries();
  assert.deepEqual(roadsideDiscoveriesFor(shadow),[]);
  const map=buildSectorMap({sector:CELL,roadsideDiscoveryDefinitions:roadsideDiscoveriesFor(c)});
  assert.equal(map.props.some(p=>p.id===CHEST),false);
 }
 // This deleted optional field is a declared older-save admission fixture.
 const older=initialCampaign(42);delete older.roadsideDiscoveryDefinitions;
 const restored=saved(older);assert.equal(Object.hasOwn(restored,'roadsideDiscoveryDefinitions'),false);
 assert.deepEqual(roadsideDiscoveriesFor(restored),[]);
 assert.equal(buildSectorMap({sector:CELL}).props.some(p=>p.id===CHEST),false);
});

test('discovery import rejects unsupported locations, equipment, quantities and versions',()=>{
 assert.deepEqual(validateRoadsideDiscoveries(undefined),[]);assert.deepEqual(validateRoadsideDiscoveries([]),[]);
 for(const value of [null,{},[null],[...freshDefaultRoadsideDiscoveries(),...freshDefaultRoadsideDiscoveries()]])assert.ok(validateRoadsideDiscoveries(value).length);
 const mutations=[r=>r.version=2,r=>r.id='different-cache',r=>r.cell='retiro',r=>r.cell='cell-0-0',r=>r.x=9,r=>r.y=8,r=>r.crowbarCondition=0,r=>r.crowbarCondition=101,r=>r.linenShirtCondition=1.5,r=>r.linenShirtCondition=NaN,r=>r.ammo=100,r=>r.explosives=1,r=>delete r.crowbarCondition];
 for(const mutate of mutations){const d=defaultContentPackage();mutate(d.roadsideDiscoveries[0]);assert.ok(validateContentPackage(d).length,mutate.toString());assert.throws(()=>initialCampaign(42,d));}
 const d=defaultContentPackage();d.roadsideDiscoveries[0].crowbarCondition=1;d.roadsideDiscoveries[0].linenShirtCondition=100;
 assert.deepEqual(validateContentPackage(d),[]);
});

test('active, pending and retained scenes cannot substitute their discovery context',()=>{
 const pair=pending();assert.deepEqual(pair.battle.roadsideDiscoveryDefinitions,roadsideDiscoveriesFor(pair.campaign));
 for(const mutate of [b=>delete b.roadsideDiscoveryDefinitions,b=>b.roadsideDiscoveryDefinitions=[],b=>b.roadsideDiscoveryDefinitions[0].crowbarCondition++]){
  const battle=structuredClone(pair.battle);mutate(battle);assert.throws(()=>decodeSave(encodeSave(pair.campaign,battle)),/hallazgo|descubrim/i);
  const rejected=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
  assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},pair.campaign);
 }
 const pendingChanged=structuredClone(pair.campaign);pendingChanged.pendingBattle.roadsideDiscoveryDefinitions=[];
 assert.throws(()=>decodeSave(encodeSave(pendingChanged,pair.battle)),/hallazgo|descubrim/i);
 const c=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 c.sectorStates.retiro.roadsideDiscoveryDefinitions=[];assert.throws(()=>saved(c),/hallazgo|descubrim/i);
});

test('an older omitted package visits, retains and revisits the rural cell without gaining a cache',()=>{
 const d=defaultContentPackage();delete d.roadsideDiscoveries;
 let c=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'week'});c=order(c,{type:'wait',hours:6});
 c=order(c,{type:'travel',sector:CELL});assert.equal(c.location,CELL);
 c=order(c,{type:'visitSector'});let pair=prepareCampaignBattle(c);assert.equal(pair.error,null,pair.error);
 assert.equal(pair.battle.props.some(p=>p.id===CHEST),false);
 pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 c=order(pair.campaign,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 c=saved(c);c=order(c,{type:'visitSector'});pair=prepareCampaignBattle(c);assert.equal(pair.error,null,pair.error);
 assert.deepEqual(pair.battle.props,[]);assert.deepEqual(roadsideDiscoveriesFor(pair.campaign),[]);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
});

test('the admitted fresh map places only existing chest furniture and canonical finite items',()=>{
 for(const compactLayout of [true,false]){
  const request={sector:CELL,compactLayout,exploration:true,squad:[],enemies:[],roadsideDiscoveryDefinitions:freshDefaultRoadsideDiscoveries()};
  const battle=enterSector(request),chest=battle.props.find(p=>p.id===CHEST);
  assert.ok(chest);assert.equal(battle.props.length,1);assert.equal(chest.type,'chest');assert.equal(chest.open,false);assert.equal(chest.locked,false);assert.equal(chest.trap,undefined);
  assert.deepEqual(chest.contents.map(i=>[i.instanceId,i.count,i.condition]),[['cache:cell-24-27:crowbar',1,60],['cache:cell-24-27:linen-shirt',1,75]]);
  assert.equal(chest.contents[0].toolKey,'crowbar');assert.equal(chest.contents[1].outfit,'linen_shirt');
  assert.equal(buildSectorMap({...request,roadsideDiscoveryDefinitions:[]}).props.length,0);
  // This standalone retained-scene fixture isolates map restoration; it is
  // not a migration of a pinned campaign to different content.
  const earlier=enterSector({...request,roadsideDiscoveryDefinitions:[]});
  const retained=enterSector(request,earlier);
  assert.deepEqual(retained.props,[]);assert.deepEqual(retained.tiles,earlier.tiles);
 }
});
