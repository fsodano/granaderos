import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD,DEFAULT_MAPS} from '../campaigns/default.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition,unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {enterSector} from '../game/world.js';
import {sameCell,surfaceAt} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {prepareHiredNorthernDefense} from './fresh-northern-command.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const saved=(campaign,battle=null)=>{const pair=decodeSave(encodeSave(campaign,battle));assert.deepEqual(pair,{campaign,battle});return pair;};
const roster=[100,101,102,103,104,105,106,108,109,110,113,114,115,116,117];
const physical=r=>Object.fromEntries(['alive','hp','maxHp','bleeding','bandaged','medkits','rations','torches','condition','bladeCondition','weaponOverride','weaponDropped'].map(key=>[key,structuredClone(r[key])]));
const rounds=(c,id)=>unitAmmunitionByType(carriedAmmunition(rosterFor(c).find(person=>person.id===id),c.operativeState[id]));

function setup({count=15,casualty=false}={}){
 const ids=roster.slice(0,count),content=defaultContentPackage();
 // The cast, prices, finite starting rounds and periodic raid are declared
 // before validation/factory. The current Córdoba map and roof links stay exact.
 content.includeOriginalResidents=false;content.errands=[];
 content.rules.startingTreasury=50000;content.rules.deploymentCartridges=12;
 content.startingTerritory.cordoba={owner:'patriot',loyalty:65};
 content.campaignStory={introduction:'Guardia local declarada.',victory:'Objetivo posterior.',defeat:'La campaña termina.',chapters:[{id:'later',name:'Objetivo posterior',objective:'Continuar después del control.',conditions:[{type:'day',min:100,max:null}]}],failureConditions:[]};
 content.world=structuredClone(DEFAULT_WORLD);content.maps=structuredClone(DEFAULT_MAPS);
 const theater=content.world.sectors.find(sector=>sector.id==='cordoba').theater;
 content.world.enemyStrategy={version:1,theaters:{[theater]:{legHours:1,reserve:3,raidEveryHours:12,axis:['cordoba']}}};
 const supplied=new Set([...ids,...(casualty?[119]:[])]);
 for(const person of content.characters){const id=Number(person.id.slice(7));if(id>=100&&id<1000){person.monthlyPay=supplied.has(id)?300:1000000;person.arrivalHours=0;}}
 if(casualty){const person=content.characters.find(person=>person.id==='person-119');person.startingCondition={hp:1,energy:100,fatigue:0,bleeding:1,bandaged:0};}
 assert.deepEqual(validateContentPackage(content),[]);const declaration=structuredClone(content);let c=initialCampaign(42,content),cost=0;
 for(const id of supplied){const quote=contractQuote(c,rosterFor(c).find(person=>person.id===id),'week'),cash=c.resources.treasury;assert.equal(quote.available,true,quote.reason);c=order(c,{type:'recruitCivic',id,term:'week',destination:'cordoba'});assert.equal(cash-c.resources.treasury,quote.total);cost+=quote.total;}
 assert.equal(c.hiringArrivals.length,0);
 if(casualty){c=order(c,{type:'wait',hours:1});assert.equal(c.operativeState[119].alive,false);assert.equal(c.operativeState[119].hp,0);}
 for(let index=0;index<ids.length;index+=6)c=order(c,{type:'createSquad',sector:'cordoba',ids:ids.slice(index,index+6),name:'Guardia existente '+index});
 assert.equal(c.squads.filter(group=>group.members.length).length,Math.ceil(ids.length/6));
 assert.equal(c.resources.treasury,content.rules.startingTreasury-cost);assert.deepEqual(content,declaration);
 return {start:saved(c).campaign,ids,declaration,cost};
}

function prepared(options={}){
 const {start,ids,declaration,cost}=setup(options),before=structuredClone(start),events=[];
 const c=prepareHiredNorthernDefense(start,{report:event=>events.push(event)}),event=events.find(event=>event.event==='routeRoofDefenders');
 assert.deepEqual(start,before);assert.ok(event);assert.deepEqual(new Set(event.ids),new Set(ids));assert.equal(event.positions.length,ids.length);
 assert.equal(new Set(event.positions.map(point=>`${point.tacticalLevel}:${point.x}:${point.y}`)).size,ids.length);
 assert.ok(event.elapsedSeconds>0);assert.ok(event.actions.some(action=>action.type==='move'));assert.ok(clock(c)>clock(start)+6*3600);
 assert.ok(clock(c)<=clock(start)+(6+144)*3600+event.elapsedSeconds,'The original six-hour arrival wait and 144-hour raid bound are unchanged.');
 assert.equal(c.resources.treasury,start.resources.treasury-150);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.sectors.cordoba.fort,1);
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle.sector,'cordoba');assert.equal(c.pendingBattle.defenseFort,1);assert.ok(c.pendingBattle.defenseGroupId);
 assert.deepEqual(new Set(c.pendingBattle.squad.map(unit=>Number(unit.id))),new Set(ids));assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(new Set(c.recruited.filter(id=>c.operativeState[id].alive)),new Set(ids));
 const groups=c.squads.filter(group=>group.members.some(id=>ids.includes(id)));assert.equal(groups.length,Math.ceil(ids.length/6));assert.ok(groups.every(group=>group.members.length<=6));assert.ok(c.squads.filter(group=>group.members.length).length<=8);
 assert.equal(c.activeSquadId,groups[0].id);assert.deepEqual(c.squad,groups[0].members,'The first actual defense group remains selected, as before.');
 for(const id of ids){assert.deepEqual(physical(c.operativeState[id]),physical(start.operativeState[id]));assert.deepEqual(rounds(c,id),rounds(start,id));assert.equal(rosterFor(c).find(person=>person.id===id).weapon,rosterFor(start).find(person=>person.id===id).weapon);assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));assert.ok(sameCell(c.operativeState[id].residentPosition,event.positions.find(point=>point.id===id)));assert.equal(c.operativeState[id].assignment,'active');}
 assert.deepEqual(c.ammunitionStores,start.ammunitionStores);assert.deepEqual(c.artillerySelection,start.artillerySelection);
 const request=structuredClone(c.pendingBattle),previous=structuredClone(c.sectorStates.cordoba),battle=enterSector(c.pendingBattle,c.sectorStates.cordoba);
 assert.deepEqual(c.pendingBattle,request);assert.deepEqual(c.sectorStates.cordoba,previous);validateBattleSnapshot(battle,request);
 for(const id of ids){const unit=battle.units.find(unit=>unit.id===String(id));assert.ok(unit&&unit.hp>0);assert.ok(sameCell(unit,event.positions.find(point=>point.id===id)));assert.ok(unit.tacticalLevel>0);assert.ok(surfaceAt(battle,unit).cover>=10);assert.equal(unit.hp,start.operativeState[id].hp);assert.equal(unit.medkits,start.operativeState[id].medkits);}
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);saved(pair.campaign,pair.battle);
 // Re-execute only the successful current fresh input, including every actual
 // visit and movement. No failed/retained campaign is used as a game input.
 assert.deepEqual(prepareHiredNorthernDefense(saved(start).campaign),c);
 assert.deepEqual(c.contentCampaign.package.maps,declaration.maps);return {start,c,battle,ids,event,cost};
}

test('all three paid local Córdoba groups earn distinct current-map roof posts before the ordinary fortified raid',()=>{
 const {ids,event,battle}=prepared();assert.equal(ids.length,15);assert.equal(battle.width,64);assert.equal(battle.height,48);assert.equal(event.positions.filter(point=>point.tacticalLevel>0).length,15);
});

test('a single paid defense group keeps the same finite people and first-group selection',()=>{
 const {ids,c,event}=prepared({count:4});assert.equal(ids.length,4);assert.equal(c.squad.length,4);assert.equal(event.positions.length,4);
});

test('a real prior untreated bleeding death stays dead and never gains a defense post or issued slot',()=>{
 const {start,c,ids,event,battle}=prepared({count:8,casualty:true});assert.equal(start.operativeState[119].alive,false);assert.deepEqual(c.operativeState[119],start.operativeState[119]);assert.ok(!ids.includes(119));assert.ok(!event.ids.includes(119));assert.ok(!c.pendingBattle.squad.some(unit=>Number(unit.id)===119));assert.ok(!battle.units.some(unit=>unit.id==='119'&&unit.hp>0));
});
