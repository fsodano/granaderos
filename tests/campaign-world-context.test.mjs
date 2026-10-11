import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,dispatchCampaign,rosterFor,campaignDate} from '../game/campaign.js';
import {worldCell} from '../game/world-cells.js';
import {sectorPosition} from '../game/strategic-map.js';
import {regionalWeatherAt,regionalClimate} from '../game/regional-weather.js';
import {contentIdentity} from '../game/content-identity.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {campaignRole} from '../game/campaign-roles.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {approachNPC} from './approach-npc.mjs';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
test('world role defaults bind the local cast and explicit content roles take precedence',()=>{
 const documents=scaffoldDocuments('role-world');delete documents.content.campaignRoles;
 documents.world.defaultRoles.foundryEngineer='guide';
 const state=initialCampaign(29,compileCampaignPackage(documents.manifest,documents));
 assert.equal(campaignRole(state,'foundryEngineer').character,'guide');
 assert.ok(campaignRole(state,'foundryEngineer').id>=2000);
 documents.content.campaignRoles={foundryEngineer:null,marchCommander:null};
 assert.equal(campaignRole(initialCampaign(29,compileCampaignPackage(documents.manifest,documents)),'foundryEngineer'),null);
});
function fixture(){
 const documents=scaffoldDocuments('independent-world');
 const {content,world,presentation}=documents;
 const positions={camp:[4,4],'watch-post':[8,4]};
 for(const cell of world.cells){
  const locality=Object.keys(positions).find(id=>positions[id][0]===cell.col&&positions[id][1]===cell.row)??null;
  Object.assign(cell,{land:cell.col>=1&&cell.col<=11&&cell.row>=1&&cell.row<=7,anchor:Boolean(locality),district:Boolean(locality),locality,location:locality??cell.id});
  cell.biome=cell.land?'plains':'water';
 }
 for(const sector of world.sectors){
  const cell=world.cells.find(c=>c.location===sector.id);sector.grid=cell.grid;
  world.places[sector.id]={lon:cell.col,lat:33-cell.row,label:sector.name,dx:12,dy:0};
  world.districts[sector.id]=[{id:`${sector.id}:0`,sectorId:sector.id,col:cell.col,row:cell.row,name:sector.name,x:cell.x,y:cell.y,urban:false}];
 }
 world.geography.land=[{type:'Polygon',coordinates:[[[1,32],[12,32],[12,25],[1,25],[1,32]]]}];
 presentation.calendar={year:42,month:7,day:12};
 world.buildings.types.house.wall='#234567';
 world.ruralSectors=[];world.expansion.rural=[];
 world.weather={version:1,seed:17,climates:{foggy:{name:'Niebla del valle',terrain:'Valle propio',humidity:[1,3,7,5],rain:[0,0,99,0]}},regions:{camp:'foggy','watch-post':'foggy'},fallbacks:{biomes:{},theaters:{frontier:'foggy'},default:'foggy'}};
 const resident={...structuredClone(content.characters[0]),id:'valley-speaker',name:'La voz del valle',nickname:'Voz',recruitmentSource:'encounter',service:'permanent',progression:'fixed',monthlyPay:0};
 delete resident.arrivalHours;
 resident.encounter={recruitable:false,greeting:'El valle tiene su propia historia.',requiredLeadership:0,requiredLiberated:0,requiredSector:null,dialogue:{entry:'offer',nodes:[
  {id:'offer',title:'El informe',text:'Aceptá la tarea.',choices:[{id:'accept',label:'Acepto.',next:'active',effects:[{type:'quest',quest:'valley-report',status:'active'}]}]},
  {id:'active',title:'El informe',text:'Entregá el informe.',choices:[{id:'complete',label:'Aquí está.',next:'done',effects:[{type:'quest',quest:'valley-report',status:'completed'}]}]},
  {id:'done',title:'El informe',text:'Gracias.',choices:[]},
 ]}};
 content.characters.push(resident);
 content.quests=[{id:'valley-report',title:'Informe del valle',description:'Una tarea propia de esta campaña.'}];
 content.placements=[{id:'valley-contact',character:resident.id,mode:'fixed',sectors:['camp'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 const definitions=compileCampaignPackage(documents.manifest,documents);
 let state=initialCampaign(29,definitions),guide=rosterFor(state).find(c=>c.contentId==='guide');
 state=order(state,{type:'recruitCivic',id:guide.id,term:'week',destination:'camp'});
 return {documents,definitions,state,guide};
}

test('a new campaign geography uses the fixed grid, its projection, buildings, climate and real travel',()=>{
 const {state,definitions}=fixture();
 assert.equal(definitions.world.cells.length,36*33);
 assert.equal(worldCell('retiro',state),null);
 assert.deepEqual(campaignDate(state),{year:42,month:7,day:12,hour:0});
 const camp=worldCell('camp',state);
 assert.deepEqual(sectorPosition('camp',state),{x:camp.x,y:camp.y});
 assert.equal(regionalClimate('camp',state).id,'foggy');
 const visit=order(state,{type:'visitSector'}),battle=enterSector(visit.pendingBattle);
 assert.deepEqual(battle.weather,regionalWeatherAt('camp',visit.hour,state));
 assert.equal(battle.regionalWeatherDefinition.calendar.year,42);
 assert.deepEqual(battle.localityIds,['camp','watch-post']);
 const building=battle.buildings.find(b=>b.architecture==='house');
 assert.ok(building,'the authored expansion creates its own house');
 assert.equal(building.campaignStyle.wall,'#234567');
 assert.equal(worldCell('cell-2-4').land,false,'this land exists only in the new world');
 const moved=order(state,{type:'travel',sector:'cell-2-4'});
 assert.equal(moved.location,'cell-2-4');assert.ok(moved.hour>state.hour);
 const cellVisit=order(moved,{type:'visitSector'}),pair=decodeSave(encodeSave(cellVisit,enterSector(cellVisit.pendingBattle)));
 assert.equal(pair.battle.sectorId,'cell-2-4');
 assert.equal(pair.battle.regionalWeatherDefinition.climate.id,'foggy');
 assert.equal(pair.campaign.contentCampaign.identity.hash,contentIdentity(definitions).hash);
 const returned=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 const retainedWire=encodeSave(returned),retainedRaw=JSON.parse(retainedWire);
 assert.equal(retainedRaw.campaign.sectorStates['cell-2-4'].tiles.format,'cell-tiles-v1');
 const retainedCampaign=decodeSave(retainedWire).campaign,retained=retainedCampaign.sectorStates['cell-2-4'];
 const reentry=order(retainedCampaign,{type:'visitSector'}),reentered=enterSector(reentry.pendingBattle,retained);
 assert.equal(reentered.tiles.length,reentered.width*reentered.height);
 assert.equal(reentered.regionalWeatherDefinition.climate.id,'foggy');
});

test('custom NPC dialogue and quest state survive active and retained saves without stock definitions',()=>{
 const {documents,definitions,state,guide}=fixture();
 let campaign=order(state,{type:'visitSector'}),battle=enterSector(campaign.pendingBattle);
 const npc=battle.npcs.find(n=>n.contentId==='valley-speaker');assert.ok(npc);
 battle=approachNPC(battle,String(guide.id),npc.id);
 const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null,synced.error);campaign=synced.campaign;battle=synced.battle;
 const talk={type:'talkNPC',npcId:npc.id,unitId:String(guide.id),approach:'dialogue',sectorState:battle};
 campaign=order(campaign,talk);
 campaign=order(campaign,{...talk,dialogueNode:'offer',dialogueChoice:'accept'});
 campaign=order(campaign,{...talk,dialogueNode:'active',dialogueChoice:'complete'});
 assert.equal(contentQuestStatus(campaign,'valley-report'),'completed');
 const wire=encodeSave(campaign,battle),raw=JSON.parse(wire);
 assert.deepEqual(raw.campaign.pendingBattle.campaignPackage,{campaignDefinitionRef:contentIdentity(definitions).hash});
 const restored=decodeSave(wire);
 assert.equal(restored.campaign.pendingBattle.campaignPackage,restored.campaign.contentCampaign.package);
 assert.equal(contentQuestStatus(restored.campaign,'valley-report'),'completed');
 assert.equal(restored.battle.npcs.find(n=>n.id===npc.id).portraitId,'/campaigns/independent-world/assets/guide.png');
 documents.world.buildings.types.house.wall='#765432';
 const update=compileCampaignPackage(documents.manifest,documents);
 assert.notEqual(contentIdentity(update).hash,restored.campaign.contentCampaign.identity.hash);
 assert.equal(restored.campaign.contentCampaign.package.world.buildings.types.house.wall,'#234567');
 const reordered=JSON.parse(wire);
 reordered.battle.regionalWeatherDefinition=Object.fromEntries(Object.entries(reordered.battle.regionalWeatherDefinition).reverse());
 assert.equal(decodeSave(JSON.stringify(reordered)).battle.regionalWeatherDefinition.climate.id,'foggy');
 const legacy=JSON.parse(wire);delete legacy.battle.regionalWeatherDefinition;
 assert.deepEqual(decodeSave(JSON.stringify(legacy)).battle.regionalWeatherDefinition,battle.regionalWeatherDefinition);
 for(const tamper of [value=>value.battle.localityIds.push('retiro'),value=>value.battle.regionalWeatherDefinition.seed++,value=>value.campaign.pendingBattle.campaignPackage.campaignDefinitionRef='sha256:foreign']){
  const value=JSON.parse(wire);tamper(value);assert.throws(()=>decodeSave(JSON.stringify(value)),/localidades|clima|despliegue/);
 }
 const left=order(restored.campaign,{type:'leaveSector',battleId:restored.campaign.pendingBattle.id,sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 const retained=decodeSave(encodeSave(left)).campaign;
 assert.equal(retained.sectorStates.camp.regionalWeatherDefinition.climate.id,'foggy');
 assert.equal(contentQuestStatus(retained,'valley-report'),'completed');
});
