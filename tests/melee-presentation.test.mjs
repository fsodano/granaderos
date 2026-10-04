import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,presentedEndTurn,actionCosts,teamCanSee,getMeleeAttackResult} from '../game/tactical.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';
import {battleFrameDuration,battleFramePose,battleFrameFocus} from '../game/battle-playback.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const floor=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
const unit=(s,id='p')=>s.units.find(u=>u.id===id);
const order={type:'melee',unitId:'p',targetId:'e'};
const socket=()=>({bayonet:{weapon:1811,fittingPattern:'india_socket',condition:80,instanceId:'presentation-socket'}});
function field(player={},target={},sector={}){
 const s=createBattle([{id:'p',name:'Patriota',x:2,y:3,weapon:1809,loaded:0,ammo:0,stance:'standing',movementMode:'walk',facing:2,strength:100,dexterity:100,agility:100,wisdom:100,experienceLevel:10,...player}],{
  width:24,height:10,tiles:floor(),seed:45,enemies:[{id:'e',name:'Realista',x:3,y:3,weapon:0,activeSlot:'unarmed',loaded:0,ammo:0,patrol:false,overwatch:false,agility:0,dexterity:0,wisdom:0,experienceLevel:1,morale:100,...target},{id:'reserve',x:22,y:8,patrol:false,overwatch:false}],...sector,
 });
 for(const u of s.units)u.ap=u.id==='p'?(player.ap??100):u.id===String(target.id??'e')?(target.ap??0):0;
 return s;
}
function present(s,a=order){
 const before=structuredClone(s),r=presentedActBattle(s,a);
 assert.equal(r.state.lastError,null);assert.deepEqual(r.state,actBattle(s,a));assert.deepEqual(s,before);
 assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(r.state))),r.state);
 assert.equal(r.state.contactComplete,undefined);assert.equal(r.state.frames,undefined);
 return r;
}

for(const [name,patch] of [
 ['sabre',{}],['buttstock',{weapon:1800,weaponMode:'melee',loaded:1,ammo:9,condition:73,jammed:true}],
 ['fixed bayonet',{weapon:1800,weaponMode:'melee',loaded:1,ammo:9,weaponFittings:socket()}],
 ['mounted sabre',{horse:true,mounted:true,mount:{id:'presentation-horse',condition:100,stamina:100}}],
])test(`paid ${name} contact precedes its actual wound without changing equipment, time or random outcome`,()=>{
 const s=field(patch),r=present(s),contact=r.frames.find(f=>f.type==='contact'),impact=r.frames.find(f=>f.type==='impact');
 assert.ok(contact&&impact);assert.ok(r.frames.indexOf(contact)<r.frames.indexOf(impact));
 assert.equal(unit(contact.state,'e').hp,unit(s,'e').hp);assert.deepEqual(contact.impacts,[]);
 assert.equal(unit(contact.state).ap,unit(s).ap-actionCosts(s,unit(s)).melee);assert.equal(battleFramePose(contact),'strike');
 assert.equal(battleFrameDuration(contact),650);assert.equal(unit(impact.state,'e').hp,unit(r.state,'e').hp);
 assert.ok(impact.impacts[0].damage>0);assert.equal(impact.impacts[0].damage,unit(s,'e').hp-unit(r.state,'e').hp);
 assert.equal(battleFramePose(impact),'idle');assert.equal(battleFrameDuration(impact),900);
 assert.equal(r.frames.at(-1).contactComplete,true);assert.equal(battleFramePose(r.frames.at(-1)),'idle');assert.equal(battleFrameDuration(r.frames.at(-1)),0);
 assert.equal(r.state.elapsedSeconds,6);assert.equal(unit(r.state).ammo,unit(s).ammo);assert.equal(unit(r.state).loaded,unit(s).loaded);
 if(patch.weaponFittings)assert.equal(unit(r.state).weaponFittings.bayonet.condition,79);
});

test('a real punch shows the conscious defender before its finite breath loss and knockout',()=>{
 const s=field({weapon:0,activeSlot:'unarmed'},{energy:30}),r=present(s),contact=r.frames.find(f=>f.type==='contact'),impact=r.frames.find(f=>f.type==='impact');
 assert.equal(unit(contact.state,'e').energy,30);assert.equal(unit(contact.state,'e').unconscious,false);assert.equal(unit(contact.state,'e').hp,100);
 assert.equal(unit(impact.state,'e').energy,0);assert.equal(unit(impact.state,'e').unconscious,true);assert.equal(unit(impact.state,'e').hp,92);
 assert.equal(impact.impacts[0].damage,8);assert.notEqual(r.state.seed,s.seed);assert.equal(unit(r.state).ap,88);
});

test('a missed punch has a paid strike and no injury, breath loss or fabricated hit reaction',()=>{
 const s=field({weapon:0,activeSlot:'unarmed',strength:0,dexterity:0,agility:0,energy:20},{strength:100,dexterity:100,agility:100},{seed:1000}),r=present(s);
 assert.ok(r.frames.some(f=>f.type==='contact'&&battleFramePose(f)==='strike'));
 assert.ok(r.frames.every(f=>f.impacts.length===0));assert.equal(unit(r.state,'e').hp,100);assert.equal(unit(r.state,'e').energy,100);
 assert.equal(unit(r.state).ap,unit(s).ap-12);assert.notEqual(r.state.seed,s.seed);assert.ok(r.state.log.some(line=>line.includes('falla el golpe')));
});

for(const mounted of [false,true])test(`${mounted?'mounted':'foot'} charge records each paid approach cell before the committed contact and impact`,()=>{
 const s=field(mounted?{horse:true,mounted:true,mount:{id:'charge-horse',condition:100,stamina:100}}:{},{x:7}),r=present(s,{...order,type:'charge'});
 const steps=r.frames.filter(f=>f.type==='step'),contact=r.frames.find(f=>f.type==='contact'&&f.unitId==='p'),impact=r.frames.find(f=>f.type==='impact'&&f.unitId==='p');
 assert.ok(steps.length>0);assert.equal(contact.action,'charge');assert.equal(unit(contact.state).ap,0);
 assert.deepEqual([unit(contact.state).x,unit(contact.state).y],[unit(steps.at(-1).state).x,unit(steps.at(-1).state).y]);
 assert.equal(unit(contact.state,'e').hp,100);assert.ok(unit(impact.state,'e').hp<100);assert.ok(r.frames.indexOf(steps.at(-1))<r.frames.indexOf(contact));
 assert.ok(steps.every(f=>unit(f.state,'e').hp===100));assert.ok(unit(contact.state).energy<unit(s).energy);
 assert.equal(battleFramePose(contact),'strike');assert.equal(getMeleeAttackResult(s,r.state,'p'),true);
});

test('a real counterstrike is paid and shown only after the initial wound, without repeating either impact',()=>{
 const s=field({}, {weapon:1813,activeSlot:'primary',ap:100}),r=present(s),contacts=r.frames.filter(f=>f.type==='contact'),impacts=r.frames.filter(f=>f.type==='impact');
 assert.deepEqual(contacts.map(f=>f.unitId),['p','e']);assert.equal(impacts.length,2);
 assert.equal(unit(contacts[0].state,'e').hp,100);assert.equal(unit(contacts[1].state,'e').hp,unit(r.state,'e').hp);
 assert.equal(unit(contacts[1].state).hp,unit(s).hp);assert.ok(unit(contacts[1].state,'e').ap<unit(s,'e').ap);
 assert.deepEqual(impacts.map(f=>f.impacts.map(hit=>hit.unitId)),[['e'],['p']]);assert.ok(unit(r.state).hp<unit(s).hp);
});

test('prone stance preparation interrupted by real reaction fire cannot show a canceled strike',()=>{
 const tiles=floor();Object.assign(tiles[3*24+3],{type:'wall',blocked:true,obstacleHeight:.8});
 const s=field({weapon:1800,weaponMode:'melee',weaponFittings:socket(),loaded:1,ammo:7,stance:'prone',movementMode:'prone',agility:0,wisdom:0,experienceLevel:1},
  {x:4,weapon:1805,loaded:1,activeSlot:'primary',ammo:0,marksmanship:100,agility:100,wisdom:100,experienceLevel:10,overwatch:true,ap:100},
  {tiles,upperSurfaces:[{id:'roof-sight',x:20,y:3,tacticalLevel:1,type:'floor',kind:'roof',elevation:3,blocked:false,cover:0}]});
 s.units.push({...structuredClone(unit(s)),id:'spotter',x:4,y:2,stance:'standing',movementMode:'walk',weapon:0,weaponFittings:undefined,activeSlot:'unarmed',loaded:0,ap:0});
 unit(s,'e').ap=actionCosts(s,unit(s,'e'),unit(s)).fire;
 const r=present(s);assert.ok(unit(r.state).hp<unit(s).hp);assert.equal(unit(r.state).ap,unit(s).ap-6);assert.equal(unit(r.state,'e').hp,100);
 assert.equal(r.frames.some(f=>f.type==='contact'&&f.unitId==='p'),false);assert.equal(r.frames.some(f=>f.contactComplete&&f.unitId==='p'),false);
 assert.ok(r.frames.some(f=>f.unitId==='p'&&f.performed===false));assert.equal(getMeleeAttackResult(s,r.state,'p'),false);
});

test('a paid braced interception can stop a charge and shows no strike from the incapacitated mover',()=>{
 const s=field({hp:50},{x:7,weapon:1800,weaponFittings:socket(),activeSlot:'primary',ap:100});unit(s,'e').braced=true;
 const r=present(s,{...order,type:'charge'}),guard=r.frames.find(f=>f.type==='contact'&&f.unitId==='e');assert.ok(guard);assert.equal(unit(guard.state).hp,50);
 assert.equal(unit(r.state).unconscious,true);assert.equal(unit(r.state,'e').hp,100);
 assert.equal(r.frames.some(f=>f.type==='contact'&&f.unitId==='p'),false);assert.equal(getMeleeAttackResult(s,r.state,'p'),false);
 assert.ok(r.frames.some(f=>f.action==='charge'&&f.performed===false));
});

test('a deliberate coordinate swing does not invent an impact on an unknown occupant',()=>{
 const s=field(),r=present(s,{type:'meleePoint',unitId:'p',x:3,y:3});
 assert.ok(r.frames.some(f=>f.type==='contact'&&f.action==='meleePoint'));assert.ok(r.frames.every(f=>f.impacts.length===0&&!f.targetPoint));
 assert.equal(unit(r.state,'e').hp,100);assert.equal(unit(r.state).ap,88);
});

test('an admitted civilian sharing a soldier ID retains its own contact target and one actual impact',()=>{
 // Saved scenes reject duplicate body IDs. Presentation still keeps their
 // collections distinct if a live unvalidated reducer caller supplies one.
 const s=field({}, {x:15},{npcs:[{id:'e',name:'Habitante',x:3,y:3,hp:100}]}),before=structuredClone(s),a={...order,targetKind:'npc'},r=presentedActBattle(s,a);
 assert.equal(r.state.lastError,null);assert.deepEqual(r.state,actBattle(s,a));assert.deepEqual(s,before);assert.throws(()=>validateBattleSnapshot(r.state),/personajes/);
 const contact=r.frames.find(f=>f.type==='contact'),hits=r.frames.flatMap(f=>f.impacts);
 assert.equal(contact.targetPoint.x,3);assert.equal(unit(r.state,'e').hp,100);assert.equal(hits.length,1);
 assert.equal(hits[0].victimKind,'npc');assert.equal(hits[0].x,3);assert.equal(hits[0].damage,100-r.state.npcs[0].hp);
});

test('ordinary civilian contact and its injury survive a valid tactical save without substituting a soldier',()=>{
 const s=field({}, {x:15},{npcs:[{id:'civilian',name:'Habitante',x:3,y:3,hp:100}]}),r=present(s,{...order,targetId:'civilian',targetKind:'npc'});
 assert.equal(r.frames.find(f=>f.type==='contact').targetPoint.id,'civilian');assert.equal(unit(r.state,'e').hp,100);
 assert.equal(r.frames.flatMap(f=>f.impacts)[0].victimKind,'npc');assert.ok(r.state.npcs[0].hp<100);
});

test('an ordinary stale charge toward a concealed body cannot expose its real injury or position',()=>{
 const tiles=floor();Object.assign(tiles[3*24+7],{type:'forest',cover:100,concealment:100});
 const s=field({}, {x:7,stance:'prone',movementMode:'prone'}, {tiles,night:true}),r=present(s,{...order,type:'charge'});
 assert.equal(teamCanSee(s,'player',unit(s,'e')),false);assert.ok(unit(r.state,'e').hp<100);
 assert.ok(r.frames.some(f=>f.type==='contact'&&f.unitId==='p'));
 for(const frame of r.frames){assert.equal(frame.visibleIds.includes('e'),false);assert.equal(frame.targetPoint,undefined);assert.deepEqual(frame.impacts,[]);}
});

test('unknown attackers and victims cannot be exposed by contact frames or known injury reactions',()=>{
 const s=field({}, {x:20}),known=(s,u)=>teamCanSee(s,'player',u);
 assert.equal(known(s,unit(s,'e')),false);
 const hiddenAttack=captureBattlePresentation(s,()=>{const n=structuredClone(s);unit(n,'e').ap-=12;recordBattleFrame(n,{type:'contact',unitId:'e',targetId:'p',action:'melee'});unit(n).hp-=5;recordBattleFrame(n,{type:'impact',unitId:'e',targetId:'p',action:'melee'});return n;},known);
 assert.equal(hiddenAttack.frames.length,1);assert.equal(hiddenAttack.frames[0].type,'impact');assert.equal(hiddenAttack.frames[0].unitId,null);
 assert.deepEqual(hiddenAttack.frames[0].impacts.map(i=>i.unitId),['p']);assert.equal(battleFrameFocus(hiddenAttack.frames[0]).x,unit(s).x);
 const hiddenVictim=captureBattlePresentation(s,()=>{const n=structuredClone(s);recordBattleFrame(n,{type:'contact',unitId:'p',targetId:'e',action:'melee'});unit(n,'e').hp-=5;recordBattleFrame(n,{type:'impact',unitId:'p',targetId:'e',action:'melee'});return n;},known);
 for(const frame of hiddenVictim.frames){assert.equal(frame.targetPoint,undefined);assert.deepEqual(frame.impacts,[]);assert.equal(frame.visibleIds.includes('e'),false);}
});

test('visible enemy melee uses the same contact-before-impact stages and preserves its ordinary turn',()=>{
 const s=field({weapon:0,activeSlot:'unarmed',ap:0,agility:0,wisdom:0,experienceLevel:1},{weapon:1809,activeSlot:'primary',ap:18,agility:100,wisdom:100,experienceLevel:10}),r=presentedEndTurn(s);
 assert.deepEqual(r.state,endTurn(s));const contact=r.frames.find(f=>f.type==='contact'&&f.unitId==='e'),impact=r.frames.find(f=>f.type==='impact'&&f.unitId==='e');
 assert.ok(contact&&impact);assert.equal(unit(contact.state).hp,unit(s).hp);assert.ok(unit(impact.state).hp<unit(s).hp);assert.equal(battleFramePose(contact),'strike');
});

for(const reducedMotion of [false,true])test(`mounted Battlefield holds input through strike and impact, then commits once${reducedMotion?' with reduced motion enabled':''}`,async t=>{
 const s=field(),expected=presentedActBattle(s,order),commits=[];
 const mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 window.matchMedia=()=>({matches:reducedMotion,addEventListener(){},removeEventListener(){}});
 const strip=()=>nodes(mounted.tree()).find(n=>n.props?.onOrder&&n.props?.onEndTurn),scene=()=>nodes(mounted.tree()).find(n=>n.type===TacticalScene);
 await mounted.act(async()=>strip().props.onOrder(order));let sawContact=false,sawImpact=false;
 for(const frame of expected.frames){
  assert.deepEqual(commits,[]);assert.equal(strip().props.busy,true);
  if(frame.type==='contact'){
   sawContact=true;assert.equal(scene().props.poses.p,'strike');assert.equal(unit(scene().props.state,'e').hp,100);
   assert.equal(nodes(mounted.tree()).some(n=>n.props?.['data-hit-reaction']),false);
   await mounted.act(async()=>{strip().props.onOrder(order);strip().props.onEndTurn();});assert.deepEqual(commits,[]);assert.equal(mounted.jobs().length,0);
  }
  if(frame.type==='impact'){sawImpact=true;assert.equal(scene().props.poses.p,'idle');assert.equal(unit(scene().props.state,'e').hp,unit(expected.state,'e').hp);assert.ok(nodes(mounted.tree()).some(n=>n.props?.['data-hit-reaction']==='e'));}
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.ok(sawContact&&sawImpact);assert.deepEqual(commits,[expected.state]);assert.equal(strip().props.busy,false);
 assert.equal(nodes(mounted.tree()).some(n=>n.props?.['data-hit-reaction']),false);
});
