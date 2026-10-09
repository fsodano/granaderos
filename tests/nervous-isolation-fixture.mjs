import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {createBattle,actBattle,endTurn,presentedActBattle,presentedEndTurn,weaponFor} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {travelLegHours} from '../game/squad-travel.js';

export const nervousActor=(battle,id)=>battle.units.find(unit=>unit.id===String(id));
export const nervousSaved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
export const nervousOrder=(campaign,action)=>{
 const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;
};

export function preparedNervousArena({oldPinned=false,oldRenewal=false,term='day'}={}){
 const content=defaultContentPackage();
 // This declared clinical experiment pins the original pre-kinetic Brown Bess
 // balance before campaign creation. The separate kinetic acceptance tests the
 // fresh default energy profile; no executed health, gear or RNG is reset here.
 const clinicalGun=content.weapons.find(weapon=>weapon.template===1800);
 delete clinicalGun.projectileEnergy;delete clinicalGun.projectileAirDrag;
 for(const load of clinicalGun.alternativeLoads??[]){delete load.projectileEnergy;delete load.projectileAirDrag;}
 // Compatibility control is declared before campaign creation; care remains.
 if(oldPinned){const cejas=content.characters.find(person=>person.id==='person-130');cejas.abilities=cejas.abilities.filter(ability=>ability!=='nervous_isolation');}
 if(oldRenewal){const cejas=content.characters.find(person=>person.id==='person-130');cejas.abilities=cejas.abilities.filter(ability=>ability!=='low_morale_refusal');}
 let campaign=initialCampaign(42,content);const prices=[],campaignHistory=[],campaignStart=nervousSaved({campaign});
 const campaignStep=action=>{campaign=nervousOrder(campaign,action);campaignHistory.push(structuredClone(action));};
 for(const id of [130,110]){
  const quote=contractQuote(campaign,rosterFor(campaign).find(person=>person.id===id),term),before=campaign.resources.treasury;
  campaignStep({type:'recruitCivic',id,term});prices.push({id,price:quote.price});assert.equal(campaign.resources.treasury,before-quote.price);
 }
 campaignStep({type:'wait',hours:6});
 assert.ok([130,110].every(id=>campaign.recruited.includes(id)));
 if(term==='day')assert.deepEqual(prices,[{id:130,price:36},{id:110,price:60}]);
 if(term==='week')assert.deepEqual(prices,[{id:130,price:252},{id:110,price:420}]);
 assert.equal(campaign.resources.treasury,3200-prices.reduce((sum,item)=>sum+item.price,0));
 // Preserve the declared daylight clinical contact after the shorter city road.
 // The paid wait is part of the official campaign replay and contract clock.
 campaignStep({type:'wait',hours:18-campaign.hour-travelLegHours('retiro','buenos_aires')});
 campaignStep({type:'attack',sector:'buenos_aires'});
 const request=campaign.pendingBattle,width=48,height=16;
 // Prepared initial observation arena, not a native opening victory. Positions,
 // passive hostile posts and seed42 are fixed before the first official save.
 // Native people, health, skills, terms and finite kit remain; only the
 // pre-admission Brown Bess profile exception above is declared.
 const battle=createBattle(request.squad.map(unit=>({...unit,x:1,y:unit.id===130?3:5,facing:2})),{
  ...request,width,height,seed:42,props:[],
  tiles:Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width);return x===7&&y===2?{x,y,type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}:{x,y,type:'grass',blocked:false,cover:0};}),
  enemies:request.enemies.map((unit,i)=>({...unit,x:i===0?14:i===1?11:46,y:i===0?3:i===1?5:12+i,patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,i)=>({...npc,x:40+i,y:15})),
 });
 if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 const start=nervousSaved({campaign,battle});
 const pinnedGun=start.campaign.contentCampaign.package.weapons.find(weapon=>weapon.template===1800);
 assert.equal(Object.hasOwn(pinnedGun,'projectileEnergy'),false);assert.equal(Object.hasOwn(pinnedGun,'projectileAirDrag'),false);
 assert.ok((pinnedGun.alternativeLoads??[]).every(load=>!Object.hasOwn(load,'projectileEnergy')&&!Object.hasOwn(load,'projectileAirDrag')));
 assert.equal(weaponFor(nervousActor(start.battle,110)).projectileEnergy,undefined,'the official saved clinical load retains its explicit legacy profile');
 return {start,prices,oldPinned,campaignStart,campaignHistory};
}

export function nervousStep(pair,event,history){
 const source=structuredClone(pair),ordinary=event.type==='enemyTurn'?endTurn(pair.battle):actBattle(pair.battle,event),presented=event.type==='enemyTurn'?presentedEndTurn(pair.battle):presentedActBattle(pair.battle,event);
 assert.equal(ordinary.lastError,null,`${JSON.stringify(event)}: ${ordinary.lastError}`);assert.deepEqual(presented.state,ordinary);assert.deepEqual(pair,source);
 const synced=syncBattleTime(pair.campaign,ordinary);assert.equal(synced.error,null,synced.error);history?.push(structuredClone(event));return nervousSaved(synced);
}

export const nervousInjuryOrders=[
 {type:'move',unitId:'130',x:4,y:3},
 {type:'fire',unitId:'130',targetId:'enemy-1',aim:4},
 {type:'fire',unitId:'110',targetId:'enemy-1',aim:4},
 {type:'enemyTurn'},
 {type:'move',unitId:'110',x:5,y:3},
 {type:'enemyTurn'},
 {type:'move',unitId:'110',x:5,y:2},
 {type:'move',unitId:'130',x:6,y:3},
 {type:'reload',unitId:'130'},
 {type:'fire',unitId:'130',targetId:'enemy-0',aim:4},
 {type:'enemyTurn'},
];

// Hostile damage and one further real miss earn the threshold. The wounded
// doctor spends her own dressing and moves behind the declared stone screen.
// Acosta's resulting critical condition supplies no military support.
export const nervousFearOrders=[...nervousInjuryOrders,
 {type:'weapon',unitId:'130',slot:'medical'},
 {type:'heal',unitId:'130',targetId:'130'},
 {type:'move',unitId:'130',x:6,y:1},
 {type:'enemyTurn'},
];

export function earnNervousIsolation(options={}){
 const fixture=preparedNervousArena(options);let pair=fixture.start;
 const history=[];let wounded,beforeFear;
 for(let i=0;i<nervousFearOrders.length;i++){
  if(i===nervousInjuryOrders.length)wounded=structuredClone(pair);
  if(i===nervousFearOrders.length-1)beforeFear=structuredClone(pair);
  pair=nervousStep(pair,nervousFearOrders[i],history);
 }
 return {...fixture,pair,history,wounded,beforeFear};
}
