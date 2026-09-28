import test from 'node:test';import assert from 'node:assert/strict';
import {ARTILLERY,artilleryProfile,validateArtilleryProfiles} from '../game/artillery-definitions.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {contentIdentity} from '../game/content-identity.js';
import {initialCampaign,dispatchCampaign,serializeCampaign,restoreCampaign,deploymentCost} from '../game/campaign.js';
import {equipmentCatalog} from '../game/equipment.js';
import {createBattle,actBattle,endTurn,artilleryCosts,artilleryShotTrace} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {crewField} from './artillery-crew-fixture.mjs';
import {order,saved,sync,visit,leave} from './local-contract-fixture.mjs';
const profiles=()=>structuredClone(ARTILLERY);
function authored(patch={}){const d=defaultContentPackage();d.artilleryProfiles=profiles();Object.assign(d.artilleryProfiles.swivel,patch);return d;}
const officer=d=>order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
function deployed(d){let campaign=order(officer(d),{type:'purchaseEquipment',item:'swivel'});campaign=order(campaign,{type:'attack',sector:'buenos_aires'});return {campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour})};}

test('optional gun profiles preserve old content identity and reject incomplete, unknown or invalid definitions',()=>{
 const original=defaultContentPackage(),identity=contentIdentity(original);assert.equal(original.artilleryProfiles,undefined);assert.deepEqual(contentIdentity(saved({campaign:officer(original)}).campaign.contentCampaign.package),identity);assert.deepEqual(validateArtilleryProfiles(undefined),[]);
 const d=authored();assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);assert.notEqual(contentIdentity(d).hash,identity.hash);
 const mutations=[p=>delete p.bronze4,p=>p.extra={...p.swivel},p=>p.swivel.extra=1,p=>delete p.swivel.damage,p=>p.swivel.crew=0,p=>p.swivel.crew=7,p=>p.swivel.damage=NaN,p=>p.swivel.reloadAP=301,p=>p.swivel.price=-1,p=>p.swivel.range=1.5,p=>p.swivel.initialAmmo=-1,p=>p.swivel.initialLoaded=1,p=>p.swivel.art='https://elsewhere.invalid/image.png',p=>p.swivel.name=' '];
 for(const mutate of mutations){const p=profiles();mutate(p);assert.ok(validateArtilleryProfiles(p).length);}assert.ok(validateArtilleryProfiles(null).length);
});

test('all three authored models charge the real catalog price, including zero, without changing identity',()=>{
 for(const [type,price]of [['bronze4',0],['field8',127],['swivel',231]]){const d=authored();Object.assign(d.artilleryProfiles[type],{price,name:`Modelo ${type}`,crew:1,art:'/art/weapon-1801.png'});let s=officer(d);const cash=s.resources.treasury,item=equipmentCatalog(s).find(w=>w.item===type);assert.equal(item.price,price);assert.equal(item.name,`Modelo ${type}`);assert.equal(item.art,'/art/weapon-1801.png');assert.equal(item.crew,1);s=order(s,{type:'purchaseEquipment',item:type});assert.equal(s.resources.treasury,cash-price);assert.equal(s.armory[type],1);assert.equal(restoreCampaign(serializeCampaign(s)).armory[type],1);}
});

test('actual paid attack entry pins initial load and reserves and compact saves retain definitions once',()=>{
 const art='data:image/png;base64,'+'A'.repeat(20000),d=authored({name:'Pedrero del puerto',price:123,initialLoaded:false,initialAmmo:3,art});const p=deployed(d),wire=encodeSave(p.campaign,p.battle),parsed=JSON.parse(wire),restored=decodeSave(wire);
 const before=officer(d);assert.equal(p.campaign.resources.treasury,before.resources.treasury-123-deploymentCost(before));
 assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,3);assert.equal(p.campaign.armory.swivel,0);assert.equal(p.campaign.pendingBattle.artilleryDefinitions.swivel.name,'Pedrero del puerto');
 assert.equal(parsed.campaign.contentCampaign.package.artilleryProfiles.swivel.art,art);assert.deepEqual(parsed.battle.artilleryDefinitions,{definitionRef:'artilleryProfiles'});assert.deepEqual(parsed.campaign.pendingBattle.artilleryDefinitions,{definitionRef:'artilleryProfiles'});assert.equal(wire.split(art).length-1,1);assert.deepEqual(restored.battle.artilleryDefinitions,d.artilleryProfiles);
 d.artilleryProfiles.swivel.damage=1;assert.equal(artilleryProfile(restored.battle,'swivel').damage,65);assert.equal(artilleryProfile(restored.campaign,'swivel').damage,65);assert.equal(artilleryProfile(restoreCampaign(serializeCampaign(p.campaign)),'swivel').price,123);
});

test('full saves and ordinary campaign reports reject missing, mismatched or foreign gun definitions',()=>{
 const p=deployed(authored({damage:42}));
 for(const mutate of [b=>delete b.artilleryDefinitions,b=>b.artilleryDefinitions.swivel.damage=99,b=>b.artilleryDefinitions=null]){
  const b=structuredClone(p.battle);mutate(b);assert.throws(()=>saved({campaign:p.campaign,battle:b}),/artillería/);
  const rejected=dispatchCampaign(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.match(rejected.lastError,/artillería/);assert.deepEqual(rejected.resources,p.campaign.resources);assert.deepEqual(rejected.pendingBattle,p.campaign.pendingBattle);
 }
 for(const ref of [{definitionRef:'another'},{definitionRef:'artilleryProfiles',extra:true}]){const wire=JSON.parse(encodeSave(p.campaign,p.battle));wire.battle.artilleryDefinitions=ref;assert.throws(()=>decodeSave(JSON.stringify(wire)),/referencia de artillería/);}
 const ordinary=deployed(defaultContentPackage()),bad=JSON.parse(encodeSave(ordinary.campaign,ordinary.battle));bad.battle.artilleryDefinitions={definitionRef:'artilleryProfiles'};assert.throws(()=>decodeSave(JSON.stringify(bad)),/referencia de artillería/);
});

test('authored crew size, action costs and partial work govern actual orders instead of the old family values',()=>{
 let b=crewField('swivel');b.artilleryDefinitions=profiles();Object.assign(b.artilleryDefinitions.swivel,{crew:3,fireAP:17,reloadAP:160,moveAP:9,pivotAP:7});const costs=artilleryCosts(b,b.units[0],b.artillery[0]);assert.deepEqual(costs,{crew:3,fire:17,reload:160,move:9,pivot:7});
 const short=structuredClone(b);short.units[2].stance='prone';assert.ok(actBattle(short,{type:'artilleryReload',unitId:20,artilleryId:'gun'}).lastError);
 b=actBattle(b,{type:'artilleryReload',unitId:20,artilleryId:'gun'});assert.equal(b.lastError,null);assert.equal(b.artillery[0].reloadProgress,100/160);assert.equal(b.artillery[0].ammo,3);assert.ok(b.units.filter(u=>u.side==='player').every(u=>u.ap===0));b=endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(b))));
 b=actBattle(b,{type:'artilleryReload',unitId:20,artilleryId:'gun'});assert.equal(b.lastError,null);assert.equal(b.artillery[0].ammo,2);assert.ok(b.units.filter(u=>u.side==='player').every(u=>u.ap===40));
 b=actBattle(b,{type:'artilleryPivot',unitId:20,artilleryId:'gun',x:8,y:3});assert.equal(b.lastError,null);assert.equal(b.units[0].ap,33);b=actBattle(b,{type:'artillery',unitId:20,artilleryId:'gun',x:8,y:3});assert.equal(b.lastError,null);assert.equal(b.units[0].ap,16);b=actBattle(b,{type:'artilleryMove',unitId:20,artilleryId:'gun',x:3,y:3});assert.equal(b.lastError,null);assert.equal(b.units[0].ap,7);
});

test('authored range, damage, penetration and canister scale change the real trajectory and impacts',()=>{
 const defs=profiles();Object.assign(defs.swivel,{range:5,damage:30,penetration:0,radius:1});
 const make=()=>createBattle([{id:20,x:1,y:3}],{width:20,height:8,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),artilleryDefinitions:defs,artillery:[{id:'gun',type:'swivel',side:'player',x:2,y:3}],enemies:[{id:'near',x:4,y:3,morale:100},{id:'far',x:7,y:3,morale:100},{id:'reserve',x:18,y:6}]});
 const b=make();assert.ok(actBattle(b,{type:'artillery',unitId:20,artilleryId:'gun',x:8,y:3}).lastError);const n=actBattle(b,{type:'artillery',unitId:20,artilleryId:'gun',x:7,y:3});assert.equal(n.lastError,null);assert.equal(n.units.find(u=>u.id==='near').hp,70);assert.equal(n.units.find(u=>u.id==='far').hp,100);
 const wall=make();Object.assign(wall.tiles.find(t=>t.x===3&&t.y===3),{type:'wall',blocked:true,material:'adobe'});const stopped=actBattle(wall,{type:'artillery',unitId:20,artilleryId:'gun',x:7,y:3});assert.equal(stopped.units.find(u=>u.id==='near').hp,100);assert.equal(stopped.tiles.find(t=>t.x===3&&t.y===3).blocked,true);
 const trace=artilleryShotTrace(b,b.units[0],b.artillery[0],{x:7,y:3},'canister');assert.deepEqual(trace.events.filter(e=>e.type==='impact').map(e=>e.unitId),['near']);const spray=actBattle(b,{type:'artillery',unitId:20,artilleryId:'gun',x:7,y:3,mode:'canister'});assert.equal(spray.units.find(u=>u.id==='near').hp,89);assert.equal(spray.units.find(u=>u.id==='far').hp,100);
});

test('enemy crew selection and firing use the authored model rather than its original required crew',async()=>{
 const {artilleryField}=await import('./artillery-autonomy-fixture.mjs');const b=artilleryField({type:'field8'});b.units=b.units.filter(u=>u.id!=='crew-2'&&u.id!=='crew-3');b.artilleryDefinitions=profiles();Object.assign(b.artilleryDefinitions.field8,{crew:1,damage:35,fireAP:100});const n=endTurn(b);assert.equal(n.lastError,null);assert.ok(n.log.some(s=>s.includes('dispara una bala rasa')));assert.equal(n.artillery[0].loaded,false);assert.equal(n.artillery[0].ammo,2);assert.equal(n.units.find(u=>u.id==='crew-1').ap,0);assert.ok(n.units.find(u=>u.id==='target').hp<300);
});

test('a real authored emplacement retains finite configured ammunition and names through shots, return and saved reentry',async()=>{
 const {wonBattery,fireStationed}=await import('./stationed-artillery-fixture.mjs');const d=authored({name:'Pedrero del Litoral',fireAP:12,initialAmmo:2});let p=visit(wonBattery(d));const gun=structuredClone(p.battle.artillery[0]);assert.equal(gun.ammo,2);p=fireStationed(p);assert.equal(p.battle.artillery[0].loaded,false);assert.equal(p.battle.artillery[0].ammo,2);
 const retained=visit(saved({campaign:leave(p)}).campaign);assert.equal(retained.battle.artillery[0].id,gun.id);assert.equal(retained.battle.artillery[0].loaded,false);assert.equal(retained.battle.artillery[0].ammo,2);assert.equal(artilleryProfile(retained.battle,gun).name,'Pedrero del Litoral');assert.equal(artilleryCosts(retained.battle,retained.battle.units[0],gun).fire,12);assert.ok(saved(retained));
});
