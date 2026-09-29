import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {order,saved,sync} from './local-contract-fixture.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';

// Prepared control and a compact final encounter isolate mission settlement.
// Every victory, medical action and recovered item still uses tactical orders.
function wonMission(){
 let s=order(secureArea(initialCampaign(8,defaultContentPackage()),'buenos_aires','san_nicolas'),{type:'createOfficer',name:'Isabel',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'san_lorenzo'});
 let b=createBattle([...s.pendingBattle.squad.map(u=>({...u,x:2,y:3})),...s.pendingBattle.missionAllies.map(u=>({...u,x:3,y:3,hp:45}))],{id:s.pendingBattle.id,sector:'san_lorenzo',npcs:s.pendingBattle.npcs,hour:s.hour,width:12,height:10,enemies:[{id:'last-royalist',name:'Último realista',x:4,y:3,hp:20,maxHp:60,weapon:1800}],tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}))});
 b=actBattle(b,{type:'melee',unitId:'57',targetId:'last-royalist'});assert.equal(b.status,'victory');return saved(sync({campaign:s,battle:b}));
}
const apply=(p,a)=>{const b=actBattle(p.battle,a);assert.equal(b.lastError,null,b.lastError);return saved(sync({campaign:p.campaign,battle:b}));};
const report=p=>({type:'battleResult',battleId:p.campaign.pendingBattle.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});

test('San Lorenzo settles after actual post-victory exploration, field care, loot and reload',()=>{
 let p=wonMission(),before=p.battle.units.find(u=>u.id==='57').hp;
 p=apply(p,{type:'explore'});p=apply(p,{type:'heal',unitId:'1000',targetId:'57'});
 assert.equal(p.battle.units.find(u=>u.id==='57').hp,before);assert.equal(p.battle.units.find(u=>u.id==='57').bandaged,p.battle.units.find(u=>u.id==='57').maxHp-before);assert.equal(p.battle.units.find(u=>u.id==='1000').medkits,1);
 p=apply(p,{type:'move',unitId:'1000',x:4,y:2});p=apply(p,{type:'loot',unitId:'1000',targetId:'last-royalist',item:'weapon'});
 assert.equal(p.battle.status,'active');assert.equal(p.battle.mode,'exploration');assert.equal(p.battle.sectorCleared,true);
 const commander=structuredClone(p.battle.units.find(u=>u.id==='57')),s=saved({campaign:order(p.campaign,report(p))}).campaign;
 assert.equal(s.flags.sanLorenzo,true);assert.equal(s.missions.san_lorenzo.completed,true);assert.equal(s.phase,2);assert.equal(s.pendingBattle,null);assert.equal(s.missionAllies.san_lorenzo.hp,commander.hp);assert.ok(!s.recruited.includes(57));
 assert.ok(Object.values(s.operativeState[1000].inventory).some(i=>i.weapon===1800));assert.equal(s.sectorStates.san_lorenzo.units.find(u=>u.id==='last-royalist').weaponDropped,true);
 assert.ok(dispatchCampaign(s,report(p)).lastError);assert.equal(s.operativeState[1000].medkits,1);
});

test('mission victory still requires a cleared result and no standing enemies',()=>{
 const original=apply(wonMission(),{type:'explore'});
 for(const change of [b=>b.sectorCleared=false,b=>b.status='defeat',b=>b.mode='combat',b=>{b.units.find(u=>u.side==='enemy').hp=20;},b=>{b.status='victory';b.units.find(u=>u.side==='enemy').hp=20;}]){
  const p=structuredClone(original);change(p.battle);assert.ok(dispatchCampaign(p.campaign,report(p)).lastError);
 }
 const routed=structuredClone(original),enemy=routed.battle.units.find(u=>u.side==='enemy');enemy.hp=20;enemy.unconscious=false;enemy.energy=100;enemy.routed=true;
 assert.equal(dispatchCampaign(routed.campaign,report(routed)).lastError,null,'a routed enemy no longer contests a cleared sector');
});

test('a commander who dies during post-victory exploration still causes permanent mission defeat',()=>{
 let p=apply(wonMission(),{type:'explore'});
 // Prepared fatal wound isolates death during exploration, after the actual victory.
 const commander=p.battle.units.find(u=>u.id==='57');commander.hp=1;commander.bleeding=10;
 p=apply(p,{type:'ambient'});assert.equal(p.battle.units.find(u=>u.id==='57').hp,0);
 const s=saved({campaign:order(p.campaign,report(p))}).campaign;
 assert.equal(s.defeated,true);assert.equal(s.missions.san_lorenzo.stage,'failed');assert.equal(s.flags.sanLorenzo,false);assert.equal(s.missionAllies.san_lorenzo.hp,0);
});

test('the mounted game can explore the won mission and use its ordinary return control',async t=>{
 const m=await mountCampaign(t,wonMission());await m.click('Explorar el sector y recoger equipo');await m.click('Pausar exploración');
 await act(async()=>m.issue({type:'heal',unitId:'1000',targetId:'57'}));const health=m.saved().battle.units.find(u=>u.id==='57').hp;
 await m.click('Volver a la campaña');const {campaign:s,battle}=m.saved();
 assert.equal(battle,null);assert.equal(s.flags.sanLorenzo,true);assert.equal(s.missions.san_lorenzo.completed,true);assert.equal(s.missionAllies.san_lorenzo.hp,health);assert.equal(s.phase,2);
 assert.ok(!m.document.body.textContent.includes('La victoria exige derrotar'));
});
