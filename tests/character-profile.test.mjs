import test from 'node:test';import assert from 'node:assert/strict';
import {createOfficerRecord,defaultProfile,rosterFor} from '../game/recruitment.js';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {CRITICAL_HEALTH,isUnconscious} from '../game/actor-condition.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const answers={origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue',specialty:'night',temperament:'optimistic'};
const order=(campaign,action)=>{const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,next.lastError);return next;};
const healthProfile=health=>({...defaultProfile(),attributes:{...defaultProfile().attributes,maxHp:health,strength:85,agility:80-health}});
test('manual allocation is exact and preserves portrait, class and derived questionnaire abilities',()=>{const profile=defaultProfile();profile.attributes.marksmanship=75;profile.attributes.mechanical=35;const op=createOfficerRecord('Juan Testigo',answers,profile);assert.equal(op.marksmanship,75);assert.equal(op.mechanical,35);assert.equal(op.monthlyPay,0);assert.ok(op.traits.includes('night_vision'));assert.equal(op.portrait,'/art/avatar-man-gaucho.webp');assert.equal(createBattle([op],{exploration:true}).units[0].morale,90);assert.deepEqual(rosterFor({officer:{name:op.name,answers,profile}}).find(u=>u.id===1000).marksmanship,75);});
test('invalid allocation cannot create extra attributes or points',()=>{const p=defaultProfile();p.attributes.strength++;assert.throws(()=>createOfficerRecord('Juan Testigo',answers,p));p.attributes.strength--;p.attributes.cheat=0;assert.throws(()=>createOfficerRecord('Juan Testigo',answers,p));});
test('legacy saved officers retain their original generated profile and valid low-health allocations without a buff',()=>{
 const legacyAnswers={origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue'},op=createOfficerRecord('Juan Antiguo',legacyAnswers);assert.equal(op.strength,85);assert.equal(op.maxHp,78);assert.equal(op.monthlyPay,300);
 const starting=initialCampaign(8),legacy=order(starting,{type:'createOfficer',name:'Juan Antiguo',answers:legacyAnswers});assert.equal(legacy.resources.treasury,starting.resources.treasury-300);assert.equal(legacy.contracts[1000].paid,300);assert.equal(legacy.operativeState[1000].hp,78);assert.equal(decodeSave(encodeSave(legacy)).campaign.officer.profile,undefined);
 for(const health of [1,CRITICAL_HEALTH-1]){
  // Declare an earlier valid saved allocation, which allowed positive health
  // below the conscious threshold. This is reconstruction, not a new order.
  const profile=healthProfile(health),old=order(initialCampaign(8),{type:'createOfficer',name:'Juan Antiguo',answers,profile:defaultProfile()});
  old.officer.profile=profile;Object.assign(old.operativeState[1000],{hp:health,maxHp:health});
  const before=structuredClone(old),loaded=decodeSave(encodeSave(old)).campaign,officer=rosterFor(loaded).find(o=>o.id===1000);
  assert.deepEqual(old,before);assert.deepEqual(loaded.officer.profile,profile);assert.equal(officer.maxHp,health);assert.equal(loaded.operativeState[1000].hp,health);assert.equal(loaded.operativeState[1000].alive,true);
  const rounds=state=>carriedAmmunition(rosterFor(state).find(o=>o.id===1000),state.operativeState[1000]);assert.deepEqual(rounds(loaded),rounds(before));assert.deepEqual(decodeSave(encodeSave(loaded)).campaign,loaded);
 }
});

test('new public creation rejects unconscious health atomically before issuing any service equipment',()=>{
 const starting=initialCampaign(8),untouched=structuredClone(starting);
 for(const health of [0,CRITICAL_HEALTH-1]){
  const profile=healthProfile(health),original=structuredClone(profile),rejected=dispatchCampaign(starting,{type:'createOfficer',name:'Juan Testigo',answers,profile});
  assert.match(rejected.lastError,/salud inicial.*15.*consciente/);
  assert.deepEqual({...rejected,lastError:starting.lastError},starting,'rejection changes no treasury, contracts, issue markers, inventory, squad, clock or seed');assert.deepEqual(starting,untouched);assert.deepEqual(profile,original);
 }
});

test('the lowest conscious health allocation with a zero technical skill can save, move and return with its finite initial equipment',()=>{
 const profile=healthProfile(CRITICAL_HEALTH);Object.assign(profile.attributes,{medical:0,dexterity:85,leadership:80});
 assert.equal(Object.values(profile.attributes).reduce((a,b)=>a+b,0),550);
 const starting=initialCampaign(8);let campaign=order(starting,{type:'createOfficer',name:'Juan Testigo',answers,profile});
 assert.equal(campaign.resources.treasury,starting.resources.treasury);assert.equal(campaign.contracts[1000].paid,0);assert.equal(campaign.operativeState[1000].hp,CRITICAL_HEALTH);assert.equal(campaign.operativeState[1000].startingCartridgesIssued,true);
 const personal=state=>carriedAmmunition(rosterFor(state).find(o=>o.id===1000),state.operativeState[1000]),issued=personal(campaign);
 assert.equal(issued.loaded,1);assert.equal(issued.ammo,9);const carriedOutfit=structuredClone(campaign.operativeState[1000].outfit);
 campaign=decodeSave(encodeSave(campaign)).campaign;assert.deepEqual(campaign.officer.profile,profile);assert.deepEqual(personal(campaign),issued);
 campaign=order(campaign,{type:'visitSector'});let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 ({campaign,battle}=decodeSave(encodeSave(campaign,battle)));const unit=battle.units.find(u=>u.id==='1000');assert.equal(isUnconscious(unit),false);assert.equal(unit.medical,0);
 const reachable=getReachable(battle,unit.id),destination=[...reachable.values()].find(cell=>cell.cost>0&&Math.hypot(cell.x-unit.x,cell.y-unit.y)<=1.5);assert.ok(destination);
 const move={type:'move',unitId:unit.id,x:destination.x,y:destination.y},moved=actBattle(battle,move);assert.equal(moved.lastError,null);assert.ok(moved.elapsedSeconds>battle.elapsedSeconds);assert.ok(moved.units.find(u=>u.id===unit.id).energy<unit.energy);assert.deepEqual(actBattle(structuredClone(battle),move),moved,'ordinary paid movement replays exactly');
 const synced=syncBattleTime(campaign,moved);assert.equal(synced.error,null);({campaign,battle}=decodeSave(encodeSave(synced.campaign,synced.battle)));
 campaign=order(campaign,{type:'leaveSector',battleId:campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});campaign=decodeSave(encodeSave(campaign)).campaign;
 assert.deepEqual(campaign.officer.profile,profile);assert.equal(campaign.operativeState[1000].hp,CRITICAL_HEALTH);assert.equal(rosterFor(campaign).find(o=>o.id===1000).maxHp,CRITICAL_HEALTH);assert.equal(campaign.resources.treasury,starting.resources.treasury);assert.equal(campaign.operativeState[1000].carriedAmmo,10);assert.deepEqual(campaign.operativeState[1000].outfit,carriedOutfit);
 campaign=order(campaign,{type:'visitSector'});battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);const returned=battle.units.find(u=>u.id==='1000');assert.equal(returned.hp,CRITICAL_HEALTH);assert.deepEqual([returned.loaded,returned.ammo],[issued.loaded,issued.ammo]);assert.doesNotThrow(()=>decodeSave(encodeSave(campaign,battle)));
});

test('questionnaire effects survive tactical creation and change actual movement and vision',async()=>{
 const {actBattle,canSee}=await import('../game/tactical.js');
 const make=specialty=>createOfficerRecord('Juan Testigo',{...answers,specialty},defaultProfile());
 const night=createBattle([make('night')],{night:true,exploration:true,width:20,height:16,enemies:[]});
 assert.ok(night.units[0].traits.includes('night_vision'));
 assert.equal(canSee(night,night.units[0],{x:night.units[0].x+8,y:night.units[0].y}),true);
 const rider=createBattle([{...make('rider'),x:1,y:1,mounted:true}],{exploration:true,width:20,height:16,enemies:[]});
 const novice=createBattle([{...make('teacher'),x:1,y:1,mounted:true}],{exploration:true,width:20,height:16,enemies:[]});
 const move={type:'move',unitId:1000,x:4,y:1,movement:'run'};
 const r=actBattle(rider,move),n=actBattle(novice,move);assert.equal(r.lastError,null);assert.equal(n.lastError,null);assert.ok(r.units[0].energy>n.units[0].energy);
 assert.equal(createBattle([createOfficerRecord('Juan Testigo',{...answers,temperament:'pessimistic'},defaultProfile())],{exploration:true}).units[0].morale,70);
});
test('teacher questionnaire shortens actual militia instruction and personal speech follows temperament',async()=>{
 const {militiaCourse}=await import('../game/militia.js');const {characterProfile,speechFor}=await import('../game/characters.js');
 const teacher=createOfficerRecord('Juan Testigo',{...answers,specialty:'teacher'},defaultProfile());
 const rider=createOfficerRecord('Juan Testigo',{...answers,specialty:'rider'},defaultProfile());
 assert.ok(militiaCourse(teacher,0).hours<militiaCourse(rider,0).hours);
 assert.ok(characterProfile(teacher).skills.includes('Enseñanza'));
 assert.notEqual(speechFor(teacher,'contact'),speechFor({...teacher,personality:'pessimistic'},'contact'));
  const p=defaultProfile();p.attributes.medical=86;p.attributes.strength=24;assert.throws(()=>createOfficerRecord('Juan Testigo',answers,p));
});
test('origin and crisis answers affect real actions without changing allocated attributes',async()=>{
 const {actBattle}=await import('../game/tactical.js');const profile=defaultProfile();
 const op=(origin,crisis)=>createOfficerRecord('Juan Testigo',{...answers,origin,crisis,specialty:'night'},profile);
 assert.equal(op('estancia','rescue').ridingSkill,55);assert.equal(op('workshop','rescue').ridingSkill,20);
 const battle=o=>createBattle([{...o,hp:30,bleeding:2,condition:50}],{enemies:[{id:'distant',x:18,y:14}],width:20,height:16});
 let workshop=actBattle(battle(op('workshop','rescue')),{type:'repair',unitId:1000});let field=actBattle(battle(op('estancia','rescue')),{type:'repair',unitId:1000});assert.equal(workshop.units[0].condition,90);assert.equal(field.units[0].condition,80);
 // Both treatment fixtures already hold the kit, so the comparison isolates the crisis trait.
 const rescue=actBattle(battle({...op('estancia','rescue'),activeSlot:'medical'}),{type:'heal',unitId:1000});const rally=actBattle(battle({...op('estancia','rally'),activeSlot:'medical'}),{type:'heal',unitId:1000});assert.equal(rescue.lastError,null);assert.equal(rally.lastError,null);assert.equal(rescue.units[0].ap-rally.units[0].ap,5);assert.equal(rally.units[0].morale,100);
 assert.ok(op('cabildo','flank').traits.includes('teacher'));assert.ok(op('cabildo','flank').traits.includes('guerrilla_tactician'));
 for(const [key,value]of Object.entries(profile.attributes))assert.equal(op('workshop','rally')[key],value);
});

test('chosen nickname is retained and unsafe or excessive nicknames are rejected',()=>{const p={...defaultProfile(),nickname:'Luz'};const op=createOfficerRecord('Elena Aguirre',answers,p);assert.equal(op.nickname,'Luz');assert.throws(()=>createOfficerRecord('Elena Aguirre',answers,{...p,nickname:'x'.repeat(17)}));assert.throws(()=>createOfficerRecord('Elena Aguirre',answers,{...p,nickname:'<img>'}));});
