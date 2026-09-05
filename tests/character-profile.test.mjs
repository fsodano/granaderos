import test from 'node:test';import assert from 'node:assert/strict';
import {createOfficerRecord,defaultProfile,rosterFor} from '../game/recruitment.js';
import {createBattle} from '../game/tactical.js';
const answers={origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue',specialty:'night',temperament:'optimistic'};
test('manual allocation is exact and preserves portrait, class and derived questionnaire abilities',()=>{const profile=defaultProfile();profile.attributes.marksmanship=75;profile.attributes.mechanical=35;const op=createOfficerRecord('Juan Testigo',answers,profile);assert.equal(op.marksmanship,75);assert.equal(op.mechanical,35);assert.equal(op.monthlyPay,0);assert.ok(op.traits.includes('night_vision'));assert.equal(op.portrait,'/art/avatar-man-gaucho.webp');assert.equal(createBattle([op],{exploration:true}).units[0].morale,90);assert.deepEqual(rosterFor({officer:{name:op.name,answers,profile}}).find(u=>u.id===1000).marksmanship,75);});
test('invalid allocation cannot create extra attributes or points',()=>{const p=defaultProfile();p.attributes.strength++;assert.throws(()=>createOfficerRecord('Juan Testigo',answers,p));p.attributes.strength--;p.attributes.cheat=0;assert.throws(()=>createOfficerRecord('Juan Testigo',answers,p));});
test('legacy saved officers retain their original generated profile',()=>{const op=createOfficerRecord('Juan Antiguo',{origin:'estancia',doctrine:'cavalry_commander',crisis:'rescue'});assert.equal(op.strength,85);assert.equal(op.maxHp,78);assert.equal(op.monthlyPay,300);});

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
 const p=defaultProfile();p.attributes.medical=34;p.attributes.strength+=21;assert.throws(()=>createOfficerRecord('Juan Testigo',answers,p));
});
test('origin and crisis answers affect real actions without changing allocated attributes',async()=>{
 const {actBattle}=await import('../game/tactical.js');const profile=defaultProfile();
 const op=(origin,crisis)=>createOfficerRecord('Juan Testigo',{...answers,origin,crisis,specialty:'night'},profile);
 assert.equal(op('estancia','rescue').ridingSkill,55);assert.equal(op('workshop','rescue').ridingSkill,20);
 const battle=o=>createBattle([{...o,hp:30,condition:50}],{enemies:[{id:'distant',x:18,y:14}],width:20,height:16});
 let workshop=actBattle(battle(op('workshop','rescue')),{type:'repair',unitId:1000});let field=actBattle(battle(op('estancia','rescue')),{type:'repair',unitId:1000});assert.equal(workshop.units[0].condition,90);assert.equal(field.units[0].condition,80);
 const rescue=actBattle(battle(op('estancia','rescue')),{type:'heal',unitId:1000});const rally=actBattle(battle(op('estancia','rally')),{type:'heal',unitId:1000});assert.equal(rescue.units[0].ap-rally.units[0].ap,5);assert.equal(rally.units[0].morale,100);
 assert.ok(op('cabildo','flank').traits.includes('teacher'));assert.ok(op('cabildo','flank').traits.includes('guerrilla_tactician'));
 for(const [key,value]of Object.entries(profile.attributes))assert.equal(op('workshop','rally')[key],value);
});

test('chosen nickname is retained and unsafe or excessive nicknames are rejected',()=>{const p={...defaultProfile(),nickname:'Luz'};const op=createOfficerRecord('Elena Aguirre',answers,p);assert.equal(op.nickname,'Luz');assert.throws(()=>createOfficerRecord('Elena Aguirre',answers,{...p,nickname:'x'.repeat(17)}));assert.throws(()=>createOfficerRecord('Elena Aguirre',answers,{...p,nickname:'<img>'}));});
