import test from 'node:test';
import assert from 'node:assert/strict';
import {occupiedEnclosedRoom,enclosedRoomFearStatus,applyEnclosedRoomFear} from '../game/enclosed-room-fear.js';
import {buildBuilding,buildTerrace} from '../game/buildings.js';
import {createBattle,actBattle,endTurn,presentedEndTurn,shotChance} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {runBattleJob} from '../game/battle-job.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {tacticalFeedback} from '../game/tactical-feedback.js';
const actor=b=>b.units.find(u=>u.id==='126');
const ground=(width=18,height=12)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
function geometry({upper=false,roof='tile'}={}){
 const built=buildBuilding({id:'room',x:2,y:1,width:6,height:6,roof,doors:[{x:2,y:3,open:true}],windows:[{x:7,y:3}]});
 const overrides=new Map(built.tiles.map(t=>[`${t.x},${t.y}`,t]));
 const state={width:18,height:12,tiles:ground().map(t=>overrides.get(`${t.x},${t.y}`)??t),buildings:[built.building]};
 if(upper){
  const room={id:'upper',cells:built.building.rooms[0].cells.map(c=>({...c,tacticalLevel:1}))};state.buildings[0].rooms.push(room);
  state.upperSurfaces=built.tiles.flatMap(t=>[
   {id:`floor:${t.x}:${t.y}`,x:t.x,y:t.y,tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:!room.cells.some(c=>c.x===t.x&&c.y===t.y),cover:0,material:'adobe',buildingId:'room',...(room.cells.some(c=>c.x===t.x&&c.y===t.y)?{roomId:'upper'}:{obstacleHeight:2.8})},
   {id:`ceiling:${t.x}:${t.y}`,x:t.x,y:t.y,tacticalLevel:2,elevation:6,type:'floor',kind:'roof',blocked:false,cover:0,material:'adobe',buildingId:'room'},
  ]);
 }
 return state;
}
const person={id:'126',name:'Teresa Godoy',side:'player',abilities:['enclosed_room_fear'],hp:100,energy:100,shock:6,x:5,y:3};
function field({abilities=['enclosed_room_fear'],upper=false,quiet=0,enemyX=12,unit={}}={}){
 // Explicit engine checkpoint. Position, finite stock and first enemy budget
 // are authored before admission; this is not an earned campaign victory.
 const b=createBattle([{...person,abilities,weapon:1800,marksmanship:85,facing:2,...(upper?{tacticalLevel:1}:{}),...unit}],{
  ...geometry({upper}),seed:45,hour:12,deferContact:true,
  enemies:[{id:'e',x:enemyX,y:3,weapon:1800,loaded:0,ammo:0,patrol:false,overwatch:false}],
 });b.units.find(u=>u.id==='e').ap=0;b.quietCombatTurns=quiet;
 return validateBattleSnapshot(b);
}

test('occupied intact ground and supported upper rooms differ from breached walls, open roofs and missing ceilings',()=>{
 const state=geometry(),before=structuredClone(state);assert.equal(occupiedEnclosedRoom(state,person),true,'an open intact door remains part of a room');
 assert.deepEqual(state,before);
 for(const patch of [{type:'rubble',blocked:false},{type:'grass',blocked:false},{obstacleHeight:.45}]){
  const damaged=structuredClone(state);Object.assign(damaged.tiles.find(t=>t.x===7&&t.y===4),patch);assert.equal(occupiedEnclosedRoom(damaged,person),false);
 }
 for(const roof of [undefined,'none','unknown']){const absent=geometry();absent.buildings[0].roof=roof;assert.equal(occupiedEnclosedRoom(absent,person),false);}
 const unrelated=structuredClone(state);unrelated.buildings[0].width=10;unrelated.upperSurfaces=[{id:'porch',x:10,y:3,tacticalLevel:1,elevation:3,type:'floor',kind:'platform',blocked:false,cover:0,buildingId:'room'}];
 const admittedPorch=validateBattleSnapshot(createBattle([person],{...unrelated,seed:45,enemies:[]}));assert.equal(occupiedEnclosedRoom(admittedPorch,admittedPorch.units[0]),true,'a supported platform over an unrelated porch does not remove this room roof');
 assert.equal(occupiedEnclosedRoom(state,{...person,x:1}),false);
 const above=geometry({upper:true}),upper={...person,tacticalLevel:1};assert.equal(occupiedEnclosedRoom(above,upper),true);validateBattleSnapshot(field({upper:true}));
 for(const patch of [{blocked:false},{obstacleHeight:.45},{obstacleHeight:1.4}]){
  const damaged=structuredClone(above);Object.assign(damaged.upperSurfaces.find(s=>s.tacticalLevel===1&&s.x===7&&s.y===4),patch);assert.equal(occupiedEnclosedRoom(damaged,upper),false);
 }
 const groundHole=structuredClone(above);groundHole.upperSurfaces=groundHole.upperSurfaces.filter(s=>!(s.x===5&&s.y===3));assert.equal(occupiedEnclosedRoom(groundHole,person),false,'actual missing ceiling columns override tile-roof metadata');
 for(const elevation of [100,4.7,3.5]){
  const invalid=structuredClone(above);invalid.upperSurfaces.filter(s=>s.tacticalLevel===2).forEach(s=>s.elevation=elevation);
  const admitted=validateBattleSnapshot(createBattle([{...person,tacticalLevel:1,weapon:1800}],{...invalid,seed:45,enemies:[]}));
  assert.equal(occupiedEnclosedRoom(admitted,admitted.units[0]),false,`admitted ceiling elevation${elevation} does not enclose the occupied standing body`);
 }
 const stacked=structuredClone(above);stacked.upperSurfaces.filter(s=>s.tacticalLevel===2).forEach(s=>s.tacticalLevel=3);
 stacked.upperSurfaces.push(...stacked.upperSurfaces.filter(s=>s.tacticalLevel===1&&!s.blocked).map(s=>({...s,id:`intermediate:${s.id}`,tacticalLevel:2,elevation:3.5,roomId:undefined})));
 const admittedStack=validateBattleSnapshot(createBattle([{...person,tacticalLevel:1,weapon:1800}],{...stacked,seed:45,enemies:[]}));assert.equal(occupiedEnclosedRoom(admittedStack,admittedStack.units[0]),false,'a valid farther roof cannot hide a too-low nearer slab');
 for(const owner of [undefined,'other']){
  const anonymous=structuredClone(stacked);anonymous.buildings.push({id:'other',x:2,y:1,width:6,height:6,rooms:[]});anonymous.upperSurfaces.filter(s=>s.tacticalLevel===2).forEach(s=>s.buildingId=owner);
  const admitted=validateBattleSnapshot(createBattle([{...person,tacticalLevel:1,weapon:1800}],{...anonymous,seed:45,enemies:[]}));assert.equal(occupiedEnclosedRoom(admitted,admitted.units[0]),false,'missing or different ownership cannot exempt a nearer physical obstruction');
 }
 const house=geometry({roof:'terrace'});Object.assign(house,buildTerrace(house.buildings[0]));assert.equal(occupiedEnclosedRoom(house,person),true,'canonical ground terrace preserves the established story extent');
 const floating=structuredClone(house);floating.upperSurfaces.forEach(s=>s.elevation=100);assert.equal(occupiedEnclosedRoom(floating,person),false);
 const low=structuredClone(house);low.tiles.find(t=>t.x===7&&t.y===4).obstacleHeight=1.7;assert.equal(occupiedEnclosedRoom(low,person),false,'an explicit lowered wall cannot use the default story exception');
 const hole=structuredClone(above);hole.upperSurfaces=hole.upperSurfaces.filter(s=>!(s.tacticalLevel===2&&s.x===5&&s.y===3));assert.equal(occupiedEnclosedRoom(hole,upper),false);
 const terrace=structuredClone(above);terrace.upperSurfaces.filter(s=>s.tacticalLevel===1).forEach(s=>s.kind='roof');assert.equal(occupiedEnclosedRoom(terrace,upper),false);
 const noTerrace=geometry({roof:'terrace'});assert.equal(occupiedEnclosedRoom(noTerrace,person),false,'terrace metadata without its physical roof does not supply an intact ceiling');
});

test('fear reads occupied structure only, clips existing shock and rejects incapable or unauthored sources',()=>{
 const state=geometry(),before=structuredClone(state);
 Object.defineProperties(state,{units:{get(){throw Error('private units read');}},npcs:{get(){throw Error('private NPCs read');}},props:{get(){throw Error('private contents read');}}});
 assert.deepEqual(enclosedRoomFearStatus(state,person),{eligible:true,active:true,reason:'enclosed',addedShock:2});
 const capped={...person,shock:19.75},active={...before,mode:'combat',status:'active',seed:45,units:[capped]},copy=structuredClone(active);
 assert.equal(applyEnclosedRoomFear(active,capped),.25);copy.units[0].shock=20;assert.deepEqual(active,copy);assert.equal(applyEnclosedRoomFear(active,capped),0);
 for(const change of [{hp:14},{energy:0},{unconscious:true},{asleep:true},{knockedDown:true},{routed:true},{fled:true},{captured:true},{captive:true},{surrendered:true},{departure:{}},{militia:true},{missionAlly:true},{side:'enemy'},{id:'unowned'},{abilities:undefined},{abilities:[]},{shock:21}])assert.equal(enclosedRoomFearStatus(before,{...person,...change}).active,false,JSON.stringify(change));
 for(const context of [{mode:'exploration',status:'active'},{mode:'combat',status:'victory'}]){const s={...before,...context,units:[{...person}]},saved=structuredClone(s);assert.equal(applyEnclosedRoomFear(s,s.units[0]),0);assert.deepEqual(s,saved);}
});

test('actual new player turn applies ordinary shock after recovery, changes real aim and replays exactly without extra resources or RNG',()=>{
 const before=field(),neutral=field({abilities:[]}),original=structuredClone(before);
 const next=endTurn(before),plain=endTurn(neutral);assert.equal(next.lastError,null);assert.equal(next.turn,before.turn+1);assert.equal(actor(next).shock,5);assert.equal(actor(plain).shock,3);
 assert.equal(actor(next).enclosedRoomFearWarned,true);assert.deepEqual(presentedEndTurn(before).state,next);assert.deepEqual(runBattleJob({kind:'turn',battle:before}),next);
 assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(before)))),next);assert.deepEqual(before,original);
 assert.ok(shotChance(next,actor(next),next.units.find(u=>u.id==='e'))<shotChance(plain,actor(plain),plain.units.find(u=>u.id==='e')));
 const comparable=structuredClone(next);actor(comparable).abilities=[];actor(comparable).shock=actor(plain).shock;delete actor(comparable).enclosedRoomFearWarned;comparable.log=comparable.log.filter(l=>!l.includes('siente temor dentro de una habitación cerrada.'));
 assert.deepEqual(comparable,plain,'paid time, AP, HP, kit, ammunition and RNG are unchanged by this authored shock consequence');
 let again=endTurn(next),resumes=0;
 while(again.phase==='interrupt'&&resumes++<12){assert.equal(again.turn,next.turn);assert.equal(actor(again).shock,actor(next).shock,'interrupt resumes do not charge another fear turn');again=endTurn(again);}
 assert.equal(again.lastError,null);assert.equal(again.turn,next.turn+1);assert.equal(again.log.filter(l=>l.includes('siente temor dentro de una habitación cerrada.')).length,1);
 assert.deepEqual(tacticalFeedback(next,again),[]);
 const noRound=actBattle(before,{type:'stance',unitId:'126',stance:'crouched'});assert.equal(noRound.lastError,null);assert.equal(actor(noRound).shock,6);assert.equal(actor(noRound).enclosedRoomFearWarned,undefined);
});

test('quiet exploration and restored turns cannot issue another fear charge or notice',()=>{
 const quiet=field({quiet:1,enemyX:17});quiet.units.find(u=>u.id==='e').y=11;quiet.units[0].facing=6;
 const after=endTurn(quiet);assert.equal(after.lastError,null);assert.equal(after.mode,'exploration');assert.equal(actor(after).shock,3);assert.equal(actor(after).enclosedRoomFearWarned,undefined);
 const actual=field(),received=endTurn(actual);assert.deepEqual(tacticalFeedback(received,validateBattleSnapshot(received)),[]);
 assert.deepEqual(tacticalFeedback(received,received),[]);assert.equal(actor(validateBattleSnapshot(received)).shock,5);
 // An ordinary paid stance is not itself a new turn.
 assert.equal(actor(actBattle(received,{type:'stance',unitId:'126',stance:'crouched'})).shock,5);
});

test('fresh fictional Godoy opts in while old omitted packages remain neutral and malformed saved notices reject',()=>{
 const fresh=defaultContentPackage();assert.deepEqual(fresh.characters.filter(c=>c.abilities.includes('enclosed_room_fear')).map(c=>c.id),['person-126']);
 const old=structuredClone(fresh);delete old.characters.find(c=>c.id==='person-126').abilities;
 assert.equal(rosterFor(initialCampaign(42,old)).find(c=>c.id===126).abilities,undefined);
 assert.equal(rosterFor(initialCampaign(42)).find(c=>c.id===126).abilities,undefined);
 assert.equal(actor(endTurn(field({unit:{abilities:undefined}}))).enclosedRoomFearWarned,undefined);
 const received=endTurn(field());assert.ok(validateBattleSnapshot(received));
 for(const change of [u=>u.enclosedRoomFearWarned=false,u=>u.enclosedRoomFearWarned=1,u=>u.abilities=[],u=>u.side='enemy',u=>u.militia=true,u=>u.missionAlly=true]){const invalid=structuredClone(received);change(actor(invalid));assert.throws(()=>validateBattleSnapshot(invalid),/aviso de temor/);}
 const npc=structuredClone(received);npc.npcs=[{id:'notice-npc',enclosedRoomFearWarned:true}];assert.throws(()=>validateBattleSnapshot(npc),/aviso de temor de civiles/);
});

test('authors can combine both fears with one normal recovery and bounded deterministic additions',()=>{
 const before=field({abilities:['nervous_isolation','enclosed_room_fear'],unit:{morale:49,shock:20}}),next=endTurn(before);
 assert.equal(next.lastError,null);assert.equal(next.turn,before.turn+1);assert.equal(actor(next).shock,14,'one half recovery, then two points for each eligible authored fear');
 assert.equal(actor(next).nervousIsolationWarned,true);assert.equal(actor(next).enclosedRoomFearWarned,true);
 assert.deepEqual(presentedEndTurn(before).state,next);assert.equal(next.seed,before.seed);
 const plain=endTurn(field({abilities:[],unit:{morale:49,shock:20}}));assert.equal(actor(plain).shock,10);
 for(const key of ['hp','ap','energy','loaded','ammo','condition','medkits'])assert.equal(actor(next)[key],actor(plain)[key]);
});
