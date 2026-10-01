import {restForMarch} from './campaign-test-helpers.mjs';
import {approachNPC} from './approach-npc.mjs';
import {scriptedWithdrawal} from './scripted-battle-report.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,civicStatus,recruitmentStatus} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {encountersFor,encounterContacts,encounterRequirements} from '../game/encounters.js';
import {actBattle,createBattle,endTurn} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const A='cell-27-27',B='cell-26-27';
const order=(s,a)=>{const n=dispatchCampaign(a.type==='travel'?restForMarch(s):s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=(campaign,battle=null)=>decodeSave(encodeSave(campaign,battle));
function authored({recruitable=true,mode='fixed',sectors=[A]}={}){
 const d=defaultContentPackage(),template=structuredClone(d.characters.find(c=>c.id==='person-100'));delete template.arrivalHours;
 d.characters.push({...template,id:'alma-posta',name:'Alma de la Posta',nickname:'Alma',monthlyPay:0,recruitmentSource:'encounter',service:'permanent',weapon:null,portrait:'/art/avatar-woman-scout.webp',spriteAppearance:'woman-shawl',attributes:{...template.attributes,maxHp:75},abilities:[],traits:[],encounter:{recruitable,greeting:'Conozco los caminos de la posta.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
 d.placements.push({id:'alma-location',character:'alma-posta',mode,sectors,selection:mode==='daily'?'alternate':'random',moveChance:100,afterDeath:null,delayMin:0,delayMax:0});
 d.characters.find(c=>c.id==='person-110').arrivalHours=0;return d;
}
const idFor=s=>operativeIdForCharacter(s.contentCampaign.package,'alma-posta');
const resident=b=>b.npcs.find(n=>n.contentId==='alma-posta');
function ready(d=authored()){
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});
 return order(s,{type:'travel',sector:s.contentPresence.people['alma-posta'].sector});
}
const visit=s=>{const campaign=order(s,{type:'visitSector'});return {campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour},campaign.sectorStates[campaign.location])};};
const synced=p=>{const n=syncBattleTime(p.campaign,p.battle);assert.equal(n.error,null);return n;};
function act(p,action){p.battle=actBattle(p.battle,{unitId:'110',...action});assert.equal(p.battle.lastError,null);return synced(p);}
function approach(p){p=act(p,{type:'movement',movement:'run'});return synced({...p,battle:approachNPC(p.battle,'110',resident(p.battle).id)});}
const leave=p=>{p=synced(p);return order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});};
const talk=(p,approach='friendly')=>({type:'talkNPC',npcId:resident(p.battle).id,unitId:110,approach,sectorState:p.battle});
function transfer(p){
 const n=resident(p.battle),id=idFor(p.campaign);p.campaign=order(p.campaign,talk(p,'recruit'));
 const op=p.campaign.pendingBattle.squad.find(o=>o.id===id);assert.ok(op);
 p.battle.npcs=p.battle.npcs.filter(v=>v.id!==n.id);p.battle.units.push({...createBattle([op],{width:8,height:8,enemies:[],exploration:true}).units[0],x:n.x,y:n.y});return save(p.campaign,p.battle);
}

test('new world identities are independent of bulletin candidates and cannot inherit historical roles',()=>{
 const d=authored();assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);
 let s=initialCampaign(42,d),id=idFor(s);assert.ok(id>=2000);assert.equal(civicStatus(s,id).available,false);assert.equal(recruitmentStatus(s,id).available,false);assert.ok(dispatchCampaign(s,{type:'recruitCivic',id,term:'day'}).lastError);
 assert.equal(encountersFor(s,A).find(n=>n.contentId==='alma-posta').operativeId,id);assert.equal(encountersFor(s,'retiro').some(n=>n.contentId==='alma-posta'),false);
 assert.equal(encountersFor(s,A).some(n=>n.operativeId===100),false);assert.equal(s.flags.foundry,false);assert.equal(s.flags.northPact,false);
 s=save(s).campaign;assert.equal(idFor(s),id);assert.equal(rosterFor(s).find(o=>o.id===id).service,'permanent');
 for(const mutate of [x=>delete x.characters.at(-1).encounter,x=>x.characters.at(-1).encounter.recruitable='yes',x=>x.characters.at(-1).encounter.requiredSector=A,x=>x.characters.at(-1).encounter.unknown=true,x=>x.characters.at(-1).monthlyPay=10,x=>x.characters.at(-1).arrivalHours=6,x=>x.characters.at(-1).service='unknown',x=>x.characters[0].encounter=x.characters.at(-1).encounter]){const copy=authored();mutate(copy);assert.throws(()=>initialCampaign(42,copy));}
 const wire=JSON.parse(encodeSave(s));wire.campaign.contentCampaign.adapter='character-weapons-v2';delete wire.campaign.contentPresence;assert.throws(()=>decodeSave(JSON.stringify(wire)),/habitantes nuevos/);
});

test('an authored resident keeps her greeting, portrait, wounds and refusal after harm and relocation',()=>{
 let p=approach(visit(ready(authored({mode:'daily',sectors:[A,B]})))),n=resident(p.battle),id=idFor(p.campaign);
 assert.equal(n.maxHp,75);assert.equal(n.hp,75);assert.equal(n.portraitId,'/art/avatar-woman-scout.webp');assert.equal(n.spriteAppearance,'woman-shawl');
 p.campaign=order(p.campaign,talk(p));assert.equal(p.campaign.lastConversation.text,'Conozco los caminos de la posta.');
 p=act(p,{type:'melee',targetId:n.id});p=act(p,{type:'weapon',slot:'medical'});p=act(p,{type:'heal',targetId:n.id});const hp=resident(p.battle).hp;assert.ok(hp>0&&hp<75);
 p=save(p.campaign,p.battle);let s=leave(p),old=s.location;
 s=order(s,{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});const at=s.contentPresence.people['alma-posta'].sector;assert.notEqual(at,old);assert.equal(s.sectorStates[old].npcs.length,0);
 assert.match(encounterContacts(s).find(n=>n.contentId==='alma-posta').locationLabel,/Último encuentro/);
 p=visit(order(save(s).campaign,{type:'travel',sector:at}));p=act(p,{type:'movement',movement:'run'});p=approach(p);assert.equal(resident(p.battle).hp,hp);
 const before=structuredClone(p.campaign),rejected=dispatchCampaign(p.campaign,talk(p,'recruit'));
 assert.match(rejected.lastError,/Me heriste/);assert.equal(rejected.resources.treasury,before.resources.treasury);assert.deepEqual(rejected.recruited,before.recruited);assert.deepEqual(rejected.contracts,before.contracts);
 assert.equal(rejected.recruited.includes(id),false);assert.equal(resident(p.battle).hp,hp);assert.ok(save(rejected,p.battle));
});

test('an unharmed authored resident joins, deploys and returns without payment or duplicate presence',()=>{
 let p=approach(visit(ready())),id=idFor(p.campaign),hp=resident(p.battle).hp,at=p.campaign.location;
 const cash=p.campaign.resources.treasury;p=transfer(p);assert.equal(p.campaign.resources.treasury,cash);assert.equal(p.campaign.contracts[id].kind,'patriot');assert.equal(p.campaign.contracts[id].expiresAt,null);
 assert.equal(p.battle.units.find(u=>u.id===String(id)).hp,hp);assert.equal(resident(p.battle),undefined);assert.equal(encountersFor(p.campaign,at).some(n=>n.operativeId===id),false);
 const s=leave(p);p=visit(save(s).campaign);assert.equal(p.battle.units.find(u=>u.id===String(id)).hp,hp);assert.equal(resident(p.battle),undefined);assert.ok(save(p.campaign,p.battle));
});

test('a non-recruitable authored resident can converse and die but never join or reappear in another cell',()=>{
 let p=approach(visit(ready(authored({recruitable:false,mode:'daily',sectors:[A,B]})))),n=resident(p.battle),id=idFor(p.campaign);
 p.campaign=order(p.campaign,talk(p));assert.equal(p.campaign.lastConversation.options.includes('recruit'),false);assert.equal(recruitmentStatus(p.campaign,id,true).available,false);assert.ok(!encounterContacts(p.campaign).some(n=>n.operativeId===id));
 const forged=structuredClone(p.campaign);forged.recruited.push(id);forged.contracts[id]={kind:'patriot',term:'month',started:forged.hour,expiresAt:null,paid:0};assert.throws(()=>save(forged),/no reclutable/);
 const rejected=dispatchCampaign(p.campaign,talk(p,'recruit'));assert.match(rejected.lastError,/no es un recluta/);assert.equal(rejected.recruited.includes(id),false);
 for(let i=0;i<5&&resident(p.battle).hp>0;i++)p=act(p,{type:'melee',targetId:n.id});assert.equal(resident(p.battle).hp,0);assert.equal(p.campaign.operativeState[id].alive,false);assert.equal(p.campaign.defeated,false);
 p=save(p.campaign,p.battle);let s=leave(p),at=s.location;s=order(s,{type:'wait',hours:24});
 assert.equal(encountersFor(s,at===A?B:A).some(n=>n.operativeId===id),false);p=visit(save(s).campaign);assert.equal(resident(p.battle).hp,0);assert.equal(resident(p.battle).stance,'prone');assert.ok(save(p.campaign,p.battle));
});

test('authored recruitment requirements are enforced before any transfer or charge',()=>{
 const d=authored();Object.assign(d.characters.at(-1).encounter,{requiredLeadership:100,requiredLiberated:2,requiredSector:'jujuy'});
 let p=approach(visit(ready(d))),n=resident(p.battle),id=idFor(p.campaign),cash=p.campaign.resources.treasury;
 assert.match(dispatchCampaign(p.campaign,talk(p,'recruit')).lastError,/liderazgo/);assert.equal(p.campaign.recruited.includes(id),false);assert.equal(p.campaign.resources.treasury,cash);
 assert.match(encounterRequirements(p.campaign,n,{leadership:100}),/localidades/);
 const established=structuredClone(p.campaign);established.sectors.buenos_aires.owner='patriot';established.sectors.ensenada.owner='patriot';
 assert.match(encounterRequirements(established,n,{leadership:100}),/Jujuy/);established.sectors.jujuy.owner='patriot';assert.equal(encounterRequirements(established,n,{leadership:100}),null);
 assert.ok(save(p.campaign,p.battle));
});

test('initial random locations stay pinned and missing placements produce no world resident',()=>{
 const d=authored({mode:'once',sectors:[A,B]});let s=initialCampaign(82,d),at=s.contentPresence.people['alma-posta'].sector;
 assert.equal(encounterContacts(s).find(n=>n.contentId==='alma-posta').locationLabel,'Ubicación por descubrir');
 for(let i=0;i<3;i++){s=order(save(s).campaign,{type:'wait',hours:24});assert.equal(s.contentPresence.people['alma-posta'].sector,at);}
 d.placements=d.placements.filter(p=>p.character!=='alma-posta');s=save(initialCampaign(82,d)).campaign;assert.equal(s.contentPresence.people['alma-posta'].sector,null);assert.ok(!encountersFor(s,A).some(n=>n.contentId==='alma-posta'));
});

test('authored resident saves reject forged identities, ledger names, locations and missing health records',()=>{
 let p=approach(visit(ready()));p.campaign=order(p.campaign,talk(p));p=act(p,{type:'melee',targetId:resident(p.battle).id});p=act(p,{type:'weapon',slot:'medical'});p=act(p,{type:'heal',targetId:resident(p.battle).id});
 const wire=encodeSave(p.campaign,p.battle),key=`person-${idFor(p.campaign)}`;
 for(const mutate of [v=>v.battle.npcs[0].operativeId=3,v=>v.battle.npcs[0].contentId='person-3',v=>v.campaign.civilianState.people[key].npcId='unknown-person',v=>delete v.campaign.operativeState[idFor(v.campaign)],v=>v.campaign.conversations['unknown-person']={met:true,hour:0,lastApproach:'friendly'},v=>v.campaign.contentPresence.people['alma-posta'].sector=B]){const copy=JSON.parse(wire);mutate(copy);assert.throws(()=>decodeSave(JSON.stringify(copy)));}
});

test('authored residents keep growth policy and later soldier health after retreat, dismissal and a new encounter',()=>{
 for(const progression of ['experience','fixed']){
  const d=authored();d.characters.at(-1).progression=progression;
  let p=transfer(approach(visit(ready(d)))),s=leave(p),id=idFor(s);
  // Established service fixture just below a level boundary. A real tactical
  // retreat awards the existing ten experience points; no victory is injected.
  s.operativeState[id].xp=95;s=save(s).campaign;secureArea(s,'buenos_aires');
  s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});
  const request=s.pendingBattle;
  // Keep the whole canonical force and isolate one actual shot at a prone
  // resident. The gunner has a limited prepared action budget, not a new gun.
  let b=createBattle(request.squad.map(u=>({...u,x:u.id===id?5:1,y:u.id===id?1:6,...(u.id===id?{stance:'prone',movementMode:'prone'}:{})})),{...request,width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:Math.floor(i/12)===4?'wall':'grass',blocked:Math.floor(i/12)===4,blocksSight:Math.floor(i/12)===4,cover:0})),enemies:request.enemies.map((u,i)=>({...u,x:7,y:i%8,...(i?{hp:0,bleeding:0,bandaged:0}:{y:1,marksmanship:100})}))});
  b.units.find(u=>u.side==='enemy'&&u.hp>0).ap=30;b=endTurn(b);assert.equal(b.lastError,null);const hurt=b.units.find(u=>u.id===String(id));assert.ok(hurt.hp>=15&&hurt.hp<hurt.maxHp,JSON.stringify({hp:hurt.hp,log:b.log}));
  b=actBattle(b,{type:'weapon',unitId:String(id),slot:'medical'});assert.equal(b.lastError,null);b=actBattle(b,{type:'heal',unitId:String(id)});assert.equal(b.lastError,null);
  p=synced({campaign:s,battle:scriptedWithdrawal(b)});s=order(p.campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
  assert.equal(s.operativeState[id].xp,progression==='experience'?105:95);assert.equal(rosterFor(s).find(o=>o.id===id).maxHp,progression==='experience'?77:75);
  s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'travel',sector:A});p=visit(save(s).campaign);
  const wounded=p.battle.units.find(u=>u.id===String(id));assert.ok(wounded.hp<wounded.maxHp);
  const hp=wounded.hp;s=leave(p);assert.equal(s.operativeState[id].hp,hp);s=order(s,{type:'dismiss',id});p=visit(save(s).campaign);
  assert.equal(resident(p.battle).hp,hp);assert.equal(resident(p.battle).maxHp,progression==='experience'?77:75);assert.ok(save(p.campaign,p.battle));
 }
});
