import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {createCampaignSandbox,dispatchCampaignSandbox,campaignSandboxDialogues,encodeCampaignSandbox,decodeCampaignSandbox} from '../game/campaign-editor-sandbox.js';
import {contentQuestStatus} from '../game/content-quests.js';
import {contentIdentity} from '../game/content-identity.js';
import {roadsideDiscoveryIds,validateRoadsideDiscoveries} from '../game/roadside-discoveries.js';
import {getReachable,containerLootPreview,canSee} from '../game/tactical.js';
import {inventoryUsage,equipmentFingerprint} from '../game/tactical-inventory.js';
import {createContentSession,advanceContentSession,encodeContentSession,decodeContentSession} from '../game/content-placement.js';

function packageForTest({deadlineHours=24,cost=5,reward=50}={}){
 const docs=scaffoldDocuments('studio-unit','Prueba del taller'),guide=docs.content.characters[0];
 docs.content.quests=[{id:'supply-report',title:'El informe',description:'Entregá el informe.',deadlineHours}];
 docs.content.characters.push({...structuredClone(guide),id:'resident',name:'Habitante del taller',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,blade:null,arrivalHours:undefined,encounter:{recruitable:false,greeting:'Tengo un encargo.',requiredLeadership:0,requiredLiberated:0,requiredSector:null,noncombatant:true,dialogue:{entry:'offer',nodes:[
  {id:'offer',title:'Oferta',text:'Aceptá el encargo.',choices:[{id:'accept',label:'Aceptar',next:'active',effects:[{type:'quest',quest:'supply-report',status:'active'},{type:'treasury',operation:'pay',amount:cost}]}]},
  {id:'active',title:'En curso',text:'Espero el informe.',choices:[{id:'complete',label:'Entregar',next:'done',conditions:[{type:'quest',quest:'supply-report',status:'active'}],effects:[{type:'quest',quest:'supply-report',status:'completed'},{type:'treasury',operation:'receive',amount:reward}]}]},
  {id:'done',title:'Terminado',text:'Gracias.',choices:[{id:'back',label:'Repetir',next:'offer'}]},
 ]}}});
 delete docs.content.characters[1].arrivalHours;delete docs.content.characters[1].blade;
 docs.content.placements=[{id:'resident-place',character:'resident',mode:'fixed',sectors:['camp'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 return compileCampaignPackage(docs.manifest,docs);
}
const command=(s,a)=>{const next=dispatchCampaignSandbox(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
function ready(content){let s=createCampaignSandbox(content,42);s=command(s,{type:'recruitCivic',id:2000,term:'week'});s=command(s,{type:'enter'});const npc=s.battle.npcs.find(n=>n.contentId==='resident');return command(s,{type:'approach',unitId:'2000',npcId:npc.id});}
const choose=(s,node,choice)=>command(s,{type:'talk',unitId:'2000',npcId:s.battle.npcs.find(n=>n.contentId==='resident').id,node,choice});

test('studio uses real hiring, map entry, dialogue payment and permanent quest receipts without changing author data',()=>{
 const content=packageForTest(),hash=contentIdentity(content).hash;let s=ready(content),before=s.campaign.resources.treasury;
 assert.equal(s.battle.sectorId,'camp');assert.equal(s.battle.units[0].contentId,'guide');assert.equal(campaignSandboxDialogues(s)[0].choices[0].available.id,'accept');
 s=choose(s,'offer','accept');assert.equal(s.campaign.resources.treasury,before-5);assert.equal(contentQuestStatus(s.campaign,'supply-report'),'active');
 s=choose(s,'active','complete');assert.equal(contentQuestStatus(s.campaign,'supply-report'),'completed');assert.equal(s.campaign.resources.treasury,before+45);
 assert.equal(s.campaign.contentQuestEvents.length,2);assert.equal(s.campaign.conversations['authored-resident'].dialogueReceipts.length,2);
 s=choose(s,'done','back');s=choose(s,'offer','accept');assert.equal(s.campaign.resources.treasury,before+45);assert.equal(s.campaign.contentQuestEvents.length,2);assert.equal(s.campaign.lastConversation.dialogueEffect.applied,false);
 assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);assert.equal(contentIdentity(content).hash,hash);
});
test('studio preserves atomic insufficient-funds rejection and actual deadline expiry after leaving a sector',()=>{
 const expensive=packageForTest({cost:1000000}),before=ready(expensive),rejected=dispatchCampaignSandbox(before,{type:'talk',unitId:'2000',npcId:'authored-resident',node:'offer',choice:'accept'});
 assert.match(rejected.lastError,/Faltan/);assert.equal(rejected.campaign,before.campaign);assert.equal(contentQuestStatus(rejected.campaign,'supply-report'),'not-started');assert.equal(rejected.history,before.history);
 const content=packageForTest({deadlineHours:1});let s=choose(ready(content),'offer','accept');s=command(s,{type:'wait',hours:1});assert.equal(s.battle,null);assert.equal(contentQuestStatus(s.campaign,'supply-report'),'failed');assert.ok(s.campaign.contentQuestEvents.at(-1).deadline);assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
});
test('studio exposes conditions from the real evaluator and rejects a save whose author content changed',()=>{
 const content=structuredClone(packageForTest());content.characters[1].encounter.dialogue.nodes[0].choices[0].conditions=[{type:'treasury',min:1000000,max:null}];let s=ready(content);const view=campaignSandboxDialogues(s)[0];assert.equal(view.choices[0].conditions[0].met,false);assert.equal(view.choices[0].available,null);
 const rejected=dispatchCampaignSandbox(s,{type:'talk',unitId:'2000',npcId:'authored-resident',node:'offer',choice:'accept'});assert.match(rejected.lastError,/disponible/);
 const wire=encodeCampaignSandbox(s),changed=structuredClone(content);changed.name='Otra edición';assert.throws(()=>decodeCampaignSandbox(wire,changed),/otro contenido/);
 const forged=JSON.parse(wire),save=JSON.parse(forged.save);save.campaign.contentQuestEvents=[{quest:'supply-report',from:'not-started',to:'active',hour:0,secondOfHour:0,npc:'authored-resident',node:'offer',choice:'accept'}];forged.save=JSON.stringify(save);assert.throws(()=>decodeCampaignSandbox(JSON.stringify(forged),content),/encargo|secuencia|registro|conversación/);
});
test('studio test setup is explicit, isolated, validated and uses scheduled event outcomes',()=>{
 const content=structuredClone(packageForTest());content.campaignEvents=[{id:'gift',atHour:1,text:'Un aporte.',conditions:[{type:'treasury',min:100,max:null}],effects:[{type:'treasury',operation:'receive',amount:25}]}];
 let s=createCampaignSandbox(content,42,{startingTreasury:0});s=command(s,{type:'wait',hours:1});assert.equal(s.campaign.resources.treasury,0);assert.equal(s.campaign.campaignEventState.receipts[0].outcome,'skipped');assert.equal(content.rules.startingTreasury,1000);assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
 assert.throws(()=>createCampaignSandbox(content,42,{startingTreasury:-1}),/tesorería/);
});
test('an authored roadside cache uses its own physical identity and admitted tile',()=>{
 const docs=scaffoldDocuments('studio-cache'),cell=docs.world.cells.find(c=>c.land&&c.location==='camp').id;
 const discovery={version:1,id:'camp-tools',cell,x:4,y:8,crowbarCondition:42,linenShirtCondition:81};docs.content.roadsideDiscoveries=[discovery];
 assert.deepEqual(validateRoadsideDiscoveries([discovery],{world:docs.world}),[]);assert.ok(validateRoadsideDiscoveries([{...discovery,cell:'cell-0-0'}],{world:docs.world}).length);
 const content=compileCampaignPackage(docs.manifest,docs);let s=createCampaignSandbox(content,42);s=command(s,{type:'recruitCivic',id:2000,term:'week'});s=command(s,{type:'enter'});
 const ids=roadsideDiscoveryIds(discovery),chest=s.battle.props.find(p=>p.id===ids.chest);assert.ok(chest);assert.deepEqual([chest.x,chest.y],[26,24]);assert.deepEqual(chest.contents.map(i=>[i.instanceId,i.condition,i.count]),[[ids.crowbar,42,1],[ids.shirt,81,1]]);
 // Custody survives real leave/reentry and the save codec; no fresh cache is
 // allocated when a retained scene already contains the finite container.
 for(let i=0;i<240;i++){
  const actor=s.battle.units.find(u=>u.id==='2000');if(Math.abs(actor.x-chest.x)+Math.abs(actor.y-chest.y)<=1)break;
  if(actor.energy<10){s=command(s,{type:'tactical',order:{type:'endTurn'}});continue;}
  const route=getReachable(s.battle,actor).filter(p=>Math.abs(p.x-chest.x)+Math.abs(p.y-chest.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(route?.path.length,'a real path reaches the authored chest');
  s=command(s,{type:'tactical',order:{type:'move',unitId:actor.id,...route.path[0]}});
 }
 if(!canSee(s.battle,s.battle.units.find(u=>u.id==='2000'),chest))s=command(s,{type:'tactical',order:{type:'look',unitId:'2000',x:chest.x,y:chest.y}});s=command(s,{type:'tactical',order:{type:'environment',unitId:'2000',kind:'container',id:chest.id,verb:'open'}});
 for(let i=0;i<2;i++){const preview=containerLootPreview(s.battle,s.battle.units.find(u=>u.id==='2000'),{id:chest.id},0,1);assert.equal(preview.valid,true,preview.reason);s=command(s,{type:'tactical',order:preview.action});}
 const carrier=s.battle.units.find(u=>u.id==='2000');assert.deepEqual(Object.values(carrier.inventory).map(i=>[i.instanceId,i.count,i.condition]).sort(),[[ids.crowbar,1,42],[ids.shirt,1,81]].sort());
 s=command(s,{type:'leave'});s=command(s,{type:'enter'});assert.deepEqual(s.battle.props.find(p=>p.id===ids.chest).contents,[]);assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
});
test('placement rehearsal protects renamed world localities and replays the selected geography',()=>{
 const content=structuredClone(packageForTest());delete content.characters[1].encounter.noncombatant;content.placements[0]={...content.placements[0],mode:'daily',sectors:['camp','watch-post'],selection:'alternate',loadedGuard:'range'};
 const initial=createContentSession(content,42),session=advanceContentSession(initial,240,'camp');assert.equal(session.people.resident.sector,initial.people.resident.sector);assert.deepEqual(decodeContentSession(encodeContentSession(session)),session);
 assert.throws(()=>advanceContentSession(initial,240,'retiro'),/Sector inválido/);
});

test('local hiring projects the real recruit into the battle before strict save and leave',()=>{
 const content=structuredClone(packageForTest()),resident=content.characters[1];resident.service='contract';resident.monthlyPay=300;resident.encounter.recruitable=true;delete resident.encounter.noncombatant;
 let s=ready(content),npc=s.battle.npcs.find(n=>n.contentId==='resident'),position=[npc.x,npc.y];
 s=command(s,{type:'talk',approach:'recruit',unitId:'2000',npcId:npc.id,term:'day'});
 assert.equal(s.campaign.lastConversation.outcome,'recruited');assert.equal(s.battle.npcs.some(n=>n.id===npc.id),false);
 const recruit=s.battle.units.find(u=>u.contentId==='resident');assert.ok(recruit);assert.deepEqual([recruit.x,recruit.y],position);assert.ok(s.campaign.recruited.includes(Number(recruit.id)));
 assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);s=command(s,{type:'leave'});assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
});
test('dialogue movement projects selected-world orders and preserves their physical identity on save',()=>{
 const content=structuredClone(packageForTest()),runner={...structuredClone(content.characters[1]),id:'runner',name:'Mensajero'};delete runner.encounter.dialogue;content.characters.push(runner);
 const cell=content.world.cells.find(c=>c.location==='camp').id;content.placements.push({...content.placements[0],id:'runner-place',character:'runner',sectors:[cell]});
 content.characters[1].encounter.dialogue.nodes[0].choices[0].effects=[{type:'movement',character:'runner',destination:'speaker'}];
 let s=choose(ready(content),'offer','accept');assert.equal(s.campaign.dialogueMovements.length,1);const npc=s.battle.npcs.find(n=>n.contentId==='runner');assert.ok(npc.scriptedMove);assert.deepEqual(npc.scriptedMove.target,s.campaign.dialogueMovements[0].target);
 assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
});

test('sandbox physical delivery consumes declared supplies, acknowledges custody and rewards only once',()=>{
 const content=structuredClone(packageForTest());content.characters[0].startingSupplies={rations:2,torches:0,medkits:2,boleadoras:0};
 content.errands=[{id:'camp-bandages',npcId:'authored-resident',sector:'camp',title:'Vendas del taller',offer:'Traé dos vendas.',delivery:'El taller recibió las vendas.',cost:{},requiredSectors:[],carried:{item:'medkits',count:2,label:'Vendas',instruction:'Entregá dos vendas del inventario.'},reward:{treasury:23,loyalty:false}}];
 let s=ready(content),cash=s.campaign.resources.treasury;
 for(let i=0;i<2;i++){
  const actor=s.battle.units.find(u=>u.id==='2000'),npc=s.battle.npcs.find(n=>n.id==='authored-resident'),slot=inventoryUsage(actor).slots.find(slot=>slot.entry?.item==='medkits');assert.ok(slot);
  s=command(s,{type:'tactical',order:{type:'inventoryMap',unitId:actor.id,sourceId:slot.id,expectedSource:equipmentFingerprint(actor,slot.id),count:1,intent:'auto',x:npc.x,y:npc.y,tacticalLevel:npc.tacticalLevel??0,targetId:npc.id}});
  assert.equal(s.battle.units.find(u=>u.id==='2000').medkits,1-i);assert.equal(s.battle.npcs.find(n=>n.id==='authored-resident').questGifts.length,i+1);
  assert.equal(s.campaign.quests['camp-bandages'].status,i===0?'offered':'completed');assert.equal(s.campaign.resources.treasury,cash+(i===0?0:23));
  s=decodeCampaignSandbox(encodeCampaignSandbox(s),content);
 }
 s=command(s,{type:'leave'});s=command(s,{type:'enter'});assert.equal(s.battle.npcs.find(n=>n.id==='authored-resident').questGifts.length,2);assert.equal(s.campaign.resources.treasury,cash+23);assert.equal(s.campaign.conversations['authored-resident'].giftCount,2);
 assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
});

test('selected-world escort follows real movement to its authored exit and saves completion',()=>{
 const content=structuredClone(packageForTest());content.world.exitLinks=[['camp','E',19,8,'watch-post','W',0,8]];
 // The authored destination starts safe; escort completion still requires its
 // issued exit and actual adjacent arrival, as in an ordinary campaign.
 content.startingTerritory['watch-post']={owner:'patriot',loyalty:65};
 content.errands=[{id:'camp-escort',npcId:'authored-resident',sector:'camp',title:'Llegar a la salida',offer:'Acompañame a la salida.',delivery:'Llegamos a la salida.',cost:{},requiredSectors:['camp','watch-post'],escort:{edge:'E',destination:'watch-post'},reward:{treasury:23,loyalty:false}}];
 let s=ready(content),cash=s.campaign.resources.treasury;s=command(s,{type:'talk',unitId:'2000',npcId:'authored-resident',approach:'quest'});assert.equal(s.campaign.quests['camp-escort'].status,'offered');
 assert.equal(s.battle.npcs.find(n=>n.id==='authored-resident').escort.waiting,false);const started=s.battle.elapsedSeconds;
 for(let i=0;i<240;i++){
  const actor=s.battle.units.find(u=>u.id==='2000');if(actor.x===s.battle.width-1)break;
  const target=getReachable(s.battle,actor).filter(p=>p.x===s.battle.width-1).sort((a,b)=>a.cost-b.cost)[0];
  if(!target){s=command(s,{type:'tactical',order:{type:'rest'}});continue;}
  s=command(s,{type:'tactical',order:{type:'move',unitId:actor.id,x:target.x,y:target.y}});
 }
 for(let i=0;i<30;i++){const actor=s.battle.units.find(u=>u.id==='2000'),npc=s.battle.npcs.find(n=>n.id==='authored-resident');if(Math.abs(actor.x-npc.x)+Math.abs(actor.y-npc.y)<=1)break;s=command(s,{type:'tactical',order:{type:'rest'}});}
 const leader=s.battle.units.find(u=>u.id==='2000'),contact=s.battle.npcs.find(n=>n.id==='authored-resident');assert.equal(leader.x,s.battle.width-1);assert.ok(s.battle.elapsedSeconds>started);assert.ok(Math.abs(leader.x-contact.x)+Math.abs(leader.y-contact.y)<=1,JSON.stringify({leader:[leader.x,leader.y],contact:[contact.x,contact.y],order:contact.escort,exits:s.battle.exits}));assert.ok(s.battle.exits.some(e=>e.id==='camp:watch-post'),JSON.stringify(s.battle.exits));
 if(!canSee(s.battle,leader,contact))s=command(s,{type:'tactical',order:{type:'look',unitId:leader.id,x:contact.x,y:contact.y}});
 s=command(s,{type:'talk',unitId:leader.id,npcId:contact.id,approach:'quest'});assert.equal(s.campaign.quests['camp-escort'].status,'completed');assert.equal(s.campaign.resources.treasury,cash+23);assert.equal(s.campaign.quests['camp-escort'].arrival.leaderX,s.battle.width-1);assert.equal(s.battle.npcs.find(n=>n.id===contact.id).escort.waiting,true);
 assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);s=command(s,{type:'leave'});s=command(s,{type:'enter'});assert.equal(s.campaign.quests['camp-escort'].status,'completed');assert.equal(s.campaign.resources.treasury,cash+23);assert.deepEqual(decodeCampaignSandbox(encodeCampaignSandbox(s),content),s);
});
