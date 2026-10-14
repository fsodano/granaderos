import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalSceneControls}=await import('../web/app/TacticalSceneControls.tsx');
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const {default:JA2GroupMovePanel}=await import('../web/app/JA2GroupMovePanel.tsx');
const {default:MovementCursor}=await import('../web/app/MovementCursor.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
function arena({exploration=false}={}){return createBattle([{id:'p',name:'Patriota',x:1,y:2,facing:2,weapon:1800,loaded:1,ammo:3},{id:'q',name:'Compañera',x:1,y:3,facing:2,weapon:1800,loaded:1,ammo:3}],{width:12,height:8,seed:45,exploration,deferContact:true,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Realista',x:8,y:2,patrol:false,overwatch:false}]});}

test('individual footprints appear from the native worker before any movement order',async t=>{
 const battle=arena(),before=structuredClone(battle),commits=[],m=await mountBattlefield(t,Battlefield,{battle,onChange:next=>{commits.push(next);return next;},onFinish(){}}),get=type=>nodes(m.tree()).find(n=>n.type===type);
 await m.act(async()=>get(TacticalSceneControls).props.onHover({x:5,y:2}));
 const request=m.jobs().find(row=>row.job.kind==='reachable-preview');assert.ok(request);
 await m.deliver('reachable-preview');
 const route=nodes(m.tree()).find(n=>n.type===MovementCursor&&n.props.preview?.movement);assert.ok(route);assert.ok(route.props.preview.path.length>0);assert.deepEqual(route.props.preview.path.at(-1),{x:5,y:2});
 assert.equal(commits.length,0);assert.equal(m.jobs().some(row=>['action','movement-step'].includes(row.job.kind)),false);assert.deepEqual(battle,before);
});

test('a group gets its actual formation footprints while route details stay closed and no order is issued',async t=>{
 const battle=arena({exploration:true}),before=structuredClone(battle),commits=[],m=await mountBattlefield(t,Battlefield,{battle,onChange:next=>{commits.push(next);return next;},onFinish(){}}),get=type=>nodes(m.tree()).find(n=>n.type===type);
 await m.act(async()=>get(JA2Strip).props.onSelect('q',true));
 await m.act(async()=>get(TacticalSceneControls).props.onHover({x:5,y:2}));
 assert.equal(get(JA2GroupMovePanel).props.previewOpen,false);
 const request=m.jobs().find(row=>row.job.kind==='group-preview');assert.ok(request,'pointing starts the native formation preview without opening its panel');const expected=runBattleJob(request.job);assert.equal(expected.ok,true);
 await m.deliver('group-preview');
 const panel=get(JA2GroupMovePanel),routes=nodes(m.tree()).filter(n=>n.type===MovementCursor&&n.props.preview?.movement);assert.equal(panel.props.previewOpen,false);assert.deepEqual(panel.props.preview,expected);
 assert.equal(routes.length,expected.members.length);for(const member of expected.members){const route=routes.find(n=>n.props.unit.id===member.unitId);assert.ok(route);assert.deepEqual(route.props.preview.path,member.path);assert.equal(route.props.preview.pa,member.cost);}
 assert.equal(routes.filter(n=>n.props.showCost).length,1,'only the group reference displays a cost label');assert.equal(commits.length,0);assert.equal(m.jobs().some(row=>['action','movement-step'].includes(row.job.kind)),false);assert.deepEqual(battle,before);
});

test('full native shot details remain available in a closed disclosure beside the compact pointer',async t=>{
 const battle=arena(),before=structuredClone(battle),m=await mountBattlefield(t,Battlefield,{battle,onChange:next=>next,onFinish(){}}),get=type=>nodes(m.tree()).find(n=>n.type===type);
 await m.act(async()=>{get(JA2Strip).props.onMode('fire');get(TacticalSceneControls).props.onHover(battle.units.find(u=>u.id==='e'));});
 const details=nodes(m.tree()).find(n=>n.props?.['aria-label']==='Vista previa de la orden');assert.equal(details.type,'details');assert.equal(details.props.open,undefined);assert.equal(nodes(details).find(n=>n.type==='summary').props.children,'Detalles del tiro');assert.ok(nodes(details).some(n=>n.type==='span'&&n.props.children));
 assert.equal(m.jobs().some(row=>['action','movement-step'].includes(row.job.kind)),false);assert.deepEqual(battle,before);
});
