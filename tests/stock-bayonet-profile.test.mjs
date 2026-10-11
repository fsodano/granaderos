import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../campaigns/granaderos/manifest.json' with {type:'json'};
import assets from '../campaigns/granaderos/assets.json' with {type:'json'};
import {DEFAULT_WORLD,DEFAULT_MAPS,DEFAULT_PRESENTATION} from '../campaigns/default.js';
import {defaultContentPackage} from '../game/content-package.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,bladeFor} from '../game/tactical.js';
import {compileWeaponDefinition,weaponMetadata,weaponRecord} from '../game/weapon-definition.js';
import {fixedBayonetProfile} from '../game/weapon-fittings.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const actorId=119;
const installed=(content=defaultContentPackage())=>compileCampaignPackage(manifest,{content,world:DEFAULT_WORLD,maps:DEFAULT_MAPS,presentation:DEFAULT_PRESENTATION,assets});
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(battle,action)=>{const next=actBattle(battle,action);assert.equal(next.lastError,null,next.lastError);return next;};
const profile=unit=>{const p=bladeFor(unit);return {ap:p.ap,damage:p.damage,reach:p.reach};};
function deployed(content){
 let campaign=initialCampaign(1812,content);
 const quote=contractQuote(campaign,rosterFor(campaign).find(o=>o.id===actorId),'day'),money=campaign.resources.treasury;
 assert.equal(quote.available,true,quote.reason);
 campaign=order(campaign,{type:'recruitCivic',id:actorId,term:'day'});
 assert.equal(campaign.resources.treasury,money-quote.price);
 campaign=order(campaign,{type:'visitSector'});
 const battle=enterSector(campaign.pendingBattle);
 return {campaign,battle,unit:battle.units.find(u=>u.id===String(actorId))};
}
// The paid recruit and equipment come from real deployment. This small field
// isolates contact and reach; it is not a campaign battle or route proof.
function field(unit,{distance=1,condition=100,slot='blade'}={}){
 const battle=createBattle([{...unit,x:1,y:3,activeSlot:slot,...(slot==='blade'?{bladeCondition:condition}:{condition})}],{
  width:12,height:8,seed:45,
  tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'target',x:1+distance,y:3,weapon:1800,hp:100,maxHp:100,morale:100,patrol:false,overwatch:false},{id:'reserve',x:11,y:7,weapon:1800,patrol:false,overwatch:false}],
 });
 battle.units.find(u=>u.id==='target').ap=0;
 return battle;
}
function contact(battle){
 const before=battle.units.find(u=>u.id===String(actorId));
 const next=act(battle,{type:'melee',unitId:before.id,targetId:'target'}),after=next.units.find(u=>u.id===before.id);
 return {damage:100-next.units.find(u=>u.id==='target').hp,paidAP:before.ap-after.ap,condition:after.bladeCondition};
}
function savedAction(pair,action){
 const battle=act(pair.battle,{unitId:String(actorId),...action}),synced=syncBattleTime(pair.campaign,battle);
 assert.equal(synced.error,null,synced.error);
 return decodeSave(encodeSave(synced.campaign,synced.battle));
}

test('ordinary and installed paid deployment retain the same loose bayonet contact, AP and wear',()=>{
 const ordinary=deployed(null),stock=deployed(installed());
 assert.equal(stock.unit.bladeMetadata.contentWeapon.id,'blade-1811-loose');
 for(const condition of [100,85,25,10]){
  const a=field(ordinary.unit,{condition}),b=field(stock.unit,{condition});
  assert.deepEqual(profile(b.units[0]),profile(a.units[0]));
  const before=structuredClone(b),actual=contact(b);
  assert.deepEqual(actual,contact(a));assert.equal(actual.paidAP,16);
  if(condition===100)assert.deepEqual(actual,{damage:24,paidAP:16,condition:99});
  assert.deepEqual(b,before,'the reducer cannot mutate the deployed source');
 }
});

test('the loose secondary cannot borrow primary or attached bayonet reach and guard',()=>{
 const stock=deployed(installed()),loose=field(stock.unit,{distance:2});
 assert.deepEqual(profile(loose.units[0]),{ap:16,damage:24,reach:1});
 for(const action of [{type:'melee',targetId:'target'},{type:'brace'}]){
  const denied=actBattle(loose,{unitId:String(actorId),...action});assert.ok(denied.lastError);assert.deepEqual(denied.units,loose.units);
 }
 const primary=defaultContentPackage().weapons.find(w=>w.id==='blade-1811');
 const main=field({...stock.unit,weapon:1811,weaponMetadata:weaponMetadata(primary)},{distance:2,slot:'primary'});
 assert.deepEqual(profile(main.units[0]),{ap:16,damage:50,reach:2});
 const hit=act(main,{type:'melee',unitId:String(actorId),targetId:'target'});
 assert.equal(hit.units.find(u=>u.id==='target').hp,50);assert.equal(main.units[0].ap-hit.units[0].ap,16);assert.equal(hit.units[0].condition,99);
 assert.deepEqual(profile({weapon:1800,activeSlot:'primary',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'fixed-control',condition:100}}}),{ap:16,damage:50,reach:2});
 assert.equal(fixedBayonetProfile({weapon:1800,activeSlot:'primary',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'fixed-control',condition:100}}}).fitting,true);
});

test('the actual stock secondary identity survives hand selection, drop, pickup and active campaign saves',()=>{
 let pair=deployed(installed());pair=savedAction(pair,{type:'weapon',slot:'blade'});
 const original=weaponRecord(pair.battle.units.find(u=>u.id===String(actorId)),'blade');
 assert.equal(original.contentWeapon.id,'blade-1811-loose');
 pair=savedAction(pair,{type:'drop',slot:'blade'});
 const ground=pair.battle.groundItems.find(item=>item.contentWeapon?.id==='blade-1811-loose');assert.ok(ground);
 pair=savedAction(pair,{type:'loot',groundId:ground.id});
 const unit=pair.battle.units.find(u=>u.id===String(actorId)),key=Object.keys(unit.inventory).find(k=>unit.inventory[k].contentWeapon?.id==='blade-1811-loose');assert.ok(key);
 pair=savedAction(pair,{type:'equipLoot',inventoryKey:key,slot:'blade'});
 assert.deepEqual(weaponRecord(pair.battle.units.find(u=>u.id===String(actorId)),'blade'),original);
 assert.deepEqual(profile({...pair.battle.units.find(u=>u.id===String(actorId)),activeSlot:'blade'}),{ap:16,damage:24,reach:1});
 const altered=JSON.parse(encodeSave(pair.campaign,pair.battle));
 altered.battle.units.find(u=>u.id===String(actorId)).bladeMetadata.contentWeapon={...compileWeaponDefinition(defaultContentPackage().weapons.find(w=>w.id==='blade-1811-loose')),damage:25};
 assert.throws(()=>decodeSave(JSON.stringify(altered)),/arma|contenido/i);
});

test('an explicit authored loose override keeps its own contact values without gaining a fixed guard',()=>{
 const content=defaultContentPackage();
 content.weapons.push({id:'custom-contact-bayonet',template:1811,name:'Bayoneta de prueba',damage:31,ap:29,reach:3});
 content.characters.find(c=>c.id===`person-${actorId}`).blade='custom-contact-bayonet';
 const stock=deployed(installed(content)),battle=field(stock.unit,{distance:3});
 assert.deepEqual(profile(battle.units[0]),{ap:29,damage:31,reach:3});
 assert.deepEqual(contact(battle),{damage:31,paidAP:29,condition:99});
 const denied=actBattle(battle,{type:'brace',unitId:String(actorId)});assert.ok(denied.lastError);assert.deepEqual(denied.units,battle.units);
 assert.equal(decodeSave(encodeSave(stock.campaign,stock.battle)).battle.units.find(u=>u.id===String(actorId)).bladeMetadata.contentWeapon.id,'custom-contact-bayonet');
});

test('older pinned primary-definition secondary choices remain unchanged and reject absent variant references',()=>{
 const content=defaultContentPackage();content.weapons=content.weapons.filter(w=>w.id!=='blade-1811-loose');
 for(const character of content.characters)if(character.blade==='blade-1811-loose')character.blade='blade-1811';
 const old=deployed(installed(content)),restored=decodeSave(encodeSave(old.campaign,old.battle)),unit=restored.battle.units.find(u=>u.id===String(actorId));
 assert.deepEqual(profile({...unit,activeSlot:'blade'}),{ap:16,damage:50,reach:2});
 assert.equal(restored.campaign.contentCampaign.package.weapons.some(w=>w.id==='blade-1811-loose'),false);
 const forged=JSON.parse(encodeSave(old.campaign,old.battle));forged.battle.units.find(u=>u.id===String(actorId)).bladeMetadata.contentWeapon={definitionRef:'blade-1811-loose'};
 assert.throws(()=>decodeSave(JSON.stringify(forged)),/referencia|arma/i);
});
