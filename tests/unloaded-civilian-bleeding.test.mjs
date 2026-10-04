import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {encountersFor} from '../game/encounters.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {approachNPC} from './approach-npc.mjs';
const A='cell-27-27';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const saved=p=>decodeSave(encodeSave(p.campaign,p.battle??null));
const now=s=>s.hour*3600+(s.secondOfHour??0);
const npc=p=>p.battle.npcs.find(n=>n.contentId==='patient');
const id=s=>operativeIdForCharacter(s.contentCampaign.package,'patient');
const health=s=>s.civilianState.people[`person-${id(s)}`].health;
function ready({successor=false,quest=false}={}){
 // These wound-clock tests need two separate paid observers for a month.
 // Authored funds isolate wound timing from the opening hiring budget.
 const d=defaultContentPackage();d.rules.startingTreasury=8000;const base=structuredClone(d.characters.find(c=>c.id==='person-100'));delete base.arrivalHours;
 for(const [name,label]of [['patient','Vecino herido'],...(successor?[['successor','Sucesor']]:[])]){
  d.characters.push({...structuredClone(base),id:name,name:label,nickname:label,monthlyPay:0,recruitmentSource:'encounter',service:'permanent',attributes:{...base.attributes,maxHp:100},weapon:null,abilities:[],traits:[],encounter:{recruitable:true,greeting:label,requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
  d.placements.push({id:`place-${name}`,character:name,mode:'fixed',sectors:[A],moveChance:100,afterDeath:name==='successor'?'patient':null,delayMin:name==='successor'?1:0,delayMax:name==='successor'?1:0});
 }
 if(quest){
  d.quests=[{id:'keep-patient',title:'Proteger al vecino',description:'El vecino debe sobrevivir.',requiredAlive:['patient'],deadlineHours:1}];
  d.characters.find(c=>c.id==='patient').encounter.dialogue={entry:'start',nodes:[{id:'start',title:'Ayuda',text:'Necesito tu ayuda.',choices:[{id:'accept',label:'Voy a ayudarte.',next:'start',effects:[{type:'quest',quest:'keep-patient',status:'active'}]}]}]};
 }
 for(const id of [110,111])d.characters.find(c=>c.id===`person-${id}`).arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});
 s=order(s,{type:'recruitCivic',id:111,term:'month'});s=order(s,{type:'createSquad',name:'Puesto del Retiro',ids:[111]});
 s=order(s,{type:'selectSquad',id:'squad-1'});return order(s,{type:'travel',sector:A});
}
function visit(s){const campaign=order(s,{type:'visitSector'});return{campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour},campaign.sectorStates[campaign.location])};}
function sync(p){const next=syncBattleTime(p.campaign,p.battle);assert.equal(next.error,null);return next;}
function act(p,a){const battle=actBattle(p.battle,{unitId:p.battle.units.find(u=>u.side==='player').id,...a});assert.equal(battle.lastError,null);return sync({...p,battle});}
function approach(p,target=npc(p)){
 const actor=p.battle.units.find(u=>u.side==='player'),movement=actor.movementMode??'walk';
 if(movement!=='run')p=act(p,{type:'movement',movement:'run'});
 p=sync({...p,battle:approachNPC(p.battle,actor.id,target.id)});
 if(movement!=='run')p=act(p,{type:'movement',movement});
 return p;
}
function wound(p){p=approach(p);p=act(p,{type:'melee',targetId:npc(p).id});assert.ok(npc(p).hp>15&&npc(p).bleeding>0);return p;}
function leave(p){p=sync(p);return order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});}
function second(p){const u=p.battle.units.find(u=>u.side==='player'),before=now(p.campaign);p=act(p,{type:'stance',stance:u.stance==='prone'?'standing':'prone'});assert.equal(now(p.campaign),before+1);return p;}
const remote=p=>visit(order(leave(p),{type:'selectSquad',id:'squad-2'}));

test('a real untreated wound advances after departure, records its actual death minute and activates one saved successor',()=>{
 let p=wound(visit(ready({successor:true})));const n=structuredClone(npc(p)),at=now(p.campaign),deathSecond=at+Math.ceil(n.hp/n.bleeding)*6-(n.civilianWoundSeconds??0),body={x:n.x,y:n.y};
 let s=leave(saved(p));s=order(s,{type:'wait',hours:2});
 assert.equal(health(s).hp,0);assert.equal(health(s).bleeding,0);assert.equal(health(s).civilianWoundSeconds,undefined);
 assert.equal(s.operativeState[id(s)].deathMinute,Math.floor(deathSecond/60));
 assert.equal(s.contentPresence.receipts.length,1);assert.equal(s.contentPresence.receipts[0].minute,Math.floor(deathSecond/60));assert.equal(s.contentPresence.receipts[0].at,Math.floor(deathSecond/60)+1);assert.equal(s.contentPresence.people.successor.appeared,true);
 assert.equal(civilianIncidents(health(s)).at(-1).attackerId,'110');assert.equal(s.log.filter(l=>l.text.includes('Vecino herido murió por sus heridas')).length,1);
 p=visit(saved({campaign:s} ).campaign);assert.equal(npc(p).hp,0);assert.deepEqual({x:npc(p).x,y:npc(p).y},body);assert.equal(p.battle.npcs.find(n=>n.contentId==='successor').hp,100);
 s=order(leave(saved(p)),{type:'wait',hours:24});assert.equal(s.contentPresence.receipts.length,1);assert.equal(civilianIncidents(health(s)).filter(e=>e.kind==='death').length,1);assert.ok(saved({campaign:s}));
});

test('one-second orders in another squad preserve the remaining wound interval across saves and sector reentry',()=>{
 let p=wound(visit(ready())),before=structuredClone(npc(p));p=remote(p);
 const interval=6-(before.civilianWoundSeconds??0);assert.ok(interval>=1&&interval<=6);
 for(let i=1;i<interval;i++){p=second(p);assert.equal(health(p.campaign).hp,before.hp);p=saved(p);}
 p=second(p);assert.equal(health(p.campaign).hp,before.hp-before.bleeding);assert.equal(health(p.campaign).civilianWoundSeconds,0);
 const repeated=sync(saved(p));assert.deepEqual(repeated.campaign,p.campaign);
 p=second(p);p=second(p);const hp=health(p.campaign).hp;
 let s=order(leave(p),{type:'selectSquad',id:'squad-1'});p=visit(saved({campaign:s}).campaign);assert.equal(npc(p).civilianWoundSeconds,2);assert.equal(npc(p).hp,hp);
 for(let i=0;i<3;i++){p=second(p);assert.equal(npc(p).hp,hp);}
 p=second(p);assert.equal(npc(p).hp,hp-before.bleeding);assert.equal(health(p.campaign).hp,npc(p).hp);assert.ok(saved(p));
});

test('a loaded resident receives each wound interval once and first aid stops later off-screen damage',()=>{
 let p=wound(visit(ready())),before=structuredClone(npc(p));
 for(let i=0;i<6;i++)p=second(p);assert.equal(npc(p).hp,before.hp-before.bleeding);assert.equal(health(p.campaign).hp,npc(p).hp);
 const supplies=p.battle.units[0].medkits;p=act(p,{type:'weapon',slot:'medical'});p=approach(p);p=act(p,{type:'heal',targetId:npc(p).id});assert.equal(npc(p).bleeding,0);assert.equal(npc(p).civilianWoundSeconds,undefined);assert.ok(p.battle.units[0].medkits<supplies);
 const hp=npc(p).hp;let s=order(leave(saved(p)),{type:'wait',hours:24});assert.equal(health(s).hp,hp);assert.equal(s.operativeState[id(s)].alive,true);assert.ok(saved({campaign:s}));
});

test('off-screen civilian death fails only accepted errands and applies the real responsibility once',()=>{
 for(const offered of [true,false]){
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 let p=visit(order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'}));p=approach(p,p.battle.npcs.find(n=>n.id==='local-retiro'));
 if(offered)p.campaign=order(p.campaign,{type:'talkNPC',npcId:'local-retiro',unitId:110,approach:'quest',sectorState:p.battle});
 p=act(p,{type:'melee',targetId:'local-retiro'});const target=p.battle.npcs.find(n=>n.id==='local-retiro');assert.ok(target.hp>0&&target.bleeding>0);
 const loyalty=p.campaign.sectors.retiro.loyalty;let s=order(leave(saved(p)),{type:'wait',hours:1});
 assert.equal(s.quests['retiro-uniformes']?.status,offered?'failed':undefined);assert.equal(s.sectors.retiro.loyalty,loyalty-10);assert.equal(s.cityLoyaltyEvents.filter(e=>e.eventId==='civilian:npc-local-retiro').length,1);
 const receipt=structuredClone(s.quests['retiro-uniformes']);s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.deepEqual(s.quests['retiro-uniformes'],receipt);assert.equal(s.sectors.retiro.loyalty,loyalty-10);assert.ok(saved({campaign:s}));
 }
});

test('legacy wound clocks start from the saved health and malformed or inconsistent remainders are rejected',()=>{
 let p=wound(visit(ready())),wire=JSON.parse(encodeSave(p.campaign,p.battle));
 const clear=v=>{delete v.campaign.civilianState.people[`person-${id(v.campaign)}`].health.civilianWoundSeconds;for(const scene of [v.battle,v.campaign.pendingBattle,...Object.values(v.campaign.sectorStates)])for(const n of scene.npcs??[])delete n.civilianWoundSeconds;};
 clear(wire);const oldHp=npc(p).hp;p=decodeSave(JSON.stringify(wire));assert.equal(npc(p).hp,oldHp);p=remote(p);for(let i=0;i<5;i++)p=second(p);assert.equal(health(p.campaign).hp,oldHp);p=second(p);assert.equal(health(p.campaign).hp,oldHp-health(p.campaign).bleeding);
 for(const value of [-1,6,1.5,'2',null]){const bad=structuredClone(wire);bad.battle.npcs.find(n=>n.contentId==='patient').civilianWoundSeconds=value;assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 const bad=structuredClone(wire);bad.campaign.civilianState.people[`person-${id(bad.campaign)}`].health.civilianWoundSeconds=4;assert.throws(()=>decodeSave(JSON.stringify(bad)));
 const malformed=leave(wound(visit(ready())));health(malformed).civilianWoundSeconds=Math.ceil(health(malformed).hp/health(malformed).bleeding)*6;
 const rejected=dispatchCampaign(malformed,{type:'wait',hours:1});assert.match(rejected.lastError,/intervalo/);assert.deepEqual({...rejected,lastError:null},malformed);
 const s=order(initialCampaign(42),{type:'wait',hours:1});assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));assert.ok(!s.civilianState?.people['person-110']);
});


test('a batched remote checkpoint crossing midnight uses the actual wound delta and the earlier death minute',()=>{
 let s=ready({successor:true});
 // A declared clock fixture isolates the midnight boundary. Health, the wound,
 // both paid contracts, actions and the subsequent elapsed interval are real.
 s.hour=23;s.secondOfHour=3540;synchronizeCampaignPresence(s);
 let p=wound(visit(s));const h=structuredClone(npc(p)),deathSecond=now(p.campaign)+Math.ceil(h.hp/h.bleeding)*6-(h.civilianWoundSeconds??0);
 assert.ok(now(p.campaign)<24*3600);p=remote(p);
 const before=now(p.campaign);let battle=actBattle(p.battle,{type:'rest',unitId:'111'});assert.equal(battle.lastError,null);assert.equal(battle.elapsedSeconds-p.battle.elapsedSeconds,600);
 p=sync({...p,battle});assert.equal(now(p.campaign),before+600);assert.equal(health(p.campaign).hp,0);
 assert.equal(p.campaign.contentPresence.receipts[0].minute,Math.floor(deathSecond/60));assert.ok(p.campaign.contentPresence.receipts[0].minute<p.campaign.contentPresence.minute);
 assert.equal(p.campaign.contentPresence.people.successor.appeared,true);assert.equal(serializeCampaign(sync(saved(p)).campaign),serializeCampaign(p.campaign));assert.ok(saved(p));
});


test('a historical command casualty outside the loaded sector preserves the explicit loss after saving',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});
 // Prepared northern chapter and controlled road, not a claimed campaign route.
 s.phase=2;s.flags.sanLorenzo=true;s.flags.northPact=true;
 for(const sector of ['buenos_aires','cordoba','mendoza','tucuman','salta'])s.sectors[sector].owner='patriot';
 s=order(s,{type:'travel',sector:'mendoza'});let p=visit(s);
 for(let attempts=0;attempts<8;attempts++){
  const target=p.battle.npcs.find(n=>n.id==='san-martin'),u=p.battle.units[0];
  if(Math.hypot(u.x-target.x,u.y-target.y)<=1.5)break;
  p=approach(p,target);
 }
 p=act(p,{type:'melee',targetId:'san-martin'});const actor=p.battle.npcs.find(n=>n.id==='san-martin');assert.ok(actor.hp>0&&actor.bleeding>0);
 s=order(leave(saved(p)),{type:'wait',hours:1});assert.equal(s.defeated,true);assert.equal(s.operativeState[57].alive,false);assert.equal(s.civilianState.people['person-57'].health.hp,0);
 assert.ok(s.log.some(l=>l.text.includes('La campaña no puede continuar sin este mando')));assert.equal(saved({campaign:s}).campaign.defeated,true);
});


test('batched and incremental tactical checkpoints produce identical off-screen death receipts and succession',()=>{
 let p=approach(visit(ready({successor:true,quest:true})));p.campaign=order(p.campaign,{type:'talkNPC',npcId:npc(p).id,unitId:110,approach:'dialogue',dialogueNode:'start',dialogueChoice:'accept',sectorState:p.battle});
 const initial=remote(wound(p));let immediate=saved(initial),battle=initial.battle;
 const remoteWound=health(initial.campaign),duration=Math.ceil(remoteWound.hp/remoteWound.bleeding)*6-(remoteWound.civilianWoundSeconds??0)+60;
 for(let i=0;i<duration;i++){
  battle=actBattle(battle,{type:'ambient'});assert.equal(battle.lastError,null);
  immediate=sync({campaign:immediate.campaign,battle});
 }
 const batch=sync({campaign:initial.campaign,battle});assert.equal(now(batch.campaign),now(immediate.campaign));
 assert.deepEqual(health(batch.campaign),health(immediate.campaign));assert.deepEqual(batch.campaign.contentPresence,immediate.campaign.contentPresence);
 assert.equal(health(batch.campaign).hp,0);assert.deepEqual(batch.campaign.contentQuestEvents,immediate.campaign.contentQuestEvents);
 const failed=batch.campaign.contentQuestEvents.at(-1);assert.equal(failed.death,'patient');assert.equal(Math.floor((failed.hour*3600+failed.secondOfHour)/60),batch.campaign.operativeState[id(batch.campaign)].deathMinute);
 assert.ok(saved(batch));assert.ok(saved(immediate));
 let later=batch;for(let i=0;i<6;i++)later=act(later,{type:'rest'});assert.equal(later.campaign.contentQuestEvents.length,2);assert.deepEqual(later.campaign.contentQuestEvents.at(-1),failed);assert.ok(saved(later));
});
