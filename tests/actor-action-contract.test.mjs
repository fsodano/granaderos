import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTOR_ACTION_CAPABILITIES,ACTOR_CLIP_SPECS,ACTOR_EQUIPMENT,ACTOR_ITEM_CLIP_OVERRIDES,ACTOR_POSTURES,actorActionKey,resolveActorAction,validateActorActionCapabilities} from '../game/actor-action-contract.js';

function validBank(){return {clips:ACTOR_CLIP_SPECS.map(spec=>({...spec,duration:2,locomotionSpeed:1.2,markers:{shot:.5,contact:.8,release:.7}}))};}
test('every legal posture has motion and life capabilities, with distinct posture poses',()=>{
  for(const posture of ACTOR_POSTURES){
    for(const equipment of ACTOR_EQUIPMENT){
      for(const action of ['idle',posture==='prone'?'crawl':'walk'])assert.ok(resolveActorAction({action,posture,equipment}),`${posture}/${equipment}/${action}`);
      for(const action of ['die','dead','collapse','unconscious','recover','hit','knockdown']){
        const capability=resolveActorAction({action,posture,equipment});
        assert.ok(capability,`${posture}/${action}`);assert.equal(capability.posture,posture);
      }
    }
  }
  assert.notEqual(resolveActorAction({action:'collapse',posture:'prone'}).clip,resolveActorAction({action:'collapse',posture:'standing'}).clip);
});
test('illegal combinations remain explicit instead of falling back to idle',()=>{
  for(const request of [{action:'fire',equipment:'unarmed'},{action:'run',posture:'prone'},{action:'strike',posture:'prone'},{action:'climbUp',mounted:true},{action:'throwGrenade',mounted:true},{action:'unknown'}])assert.equal(resolveActorAction(request),null);
  assert.equal(resolveActorAction({action:'dismount',mounted:true}).clip,'life.dismount');
});
test('all equipment actions and interaction gestures resolve without duplicate semantics',()=>{
  assert.equal(new Set(ACTOR_ACTION_CAPABILITIES.map(actorActionKey)).size,ACTOR_ACTION_CAPABILITIES.length);
  assert.equal(new Set(ACTOR_CLIP_SPECS.map(s=>s.name)).size,ACTOR_CLIP_SPECS.length);
  for(const posture of ACTOR_POSTURES)for(const equipment of ['long-gun','short-gun'])for(const action of ['aim','fire','reload','reprime','repair','unload'])assert.ok(resolveActorAction({action,posture,equipment}));
  for(const action of ['heal','loot','containerLoot','equip','drop','transfer','giveItem','steal','door','environment','breach','free','ration','prisonerEscort','fitBayonet','removeBayonet','attachment','throwTorch','boleadoras'])for(const posture of ACTOR_POSTURES)assert.ok(resolveActorAction({action,posture}));
});
test('complete bank validates actual clips, timing, markers, and gait speed',()=>{
  const bank=validBank();assert.deepEqual(validateActorActionCapabilities(bank),[]);
  bank.clips.splice(0,1);assert.match(validateActorActionCapabilities(bank).join('\n'),/Missing clip/);
  const broken=validBank();const fire=broken.clips.find(c=>c.gesture==='fire');fire.duration=0;fire.markers={};
  const gait=broken.clips.find(c=>c.gesture==='walk');gait.locomotionSpeed=0;gait.loop=false;gait.markers={bad:3};
  const errors=validateActorActionCapabilities(broken).join('\n');
  for(const text of ['Invalid duration','Missing shot marker','Missing stride speed','Wrong loop mode','Invalid bad marker'])assert.ok(errors.includes(text),errors);
});
test('a model swap changes asset bindings while retaining semantic requests and rules',()=>{
  // Models can rename native clips through their binding map. The semantic
  // contract and the simulation action identity stay byte-for-byte equal.
  const request=Object.freeze({actorId:'merc:1',action:'fire',posture:'crouched',equipment:'long-gun',actionId:'order:17:attack:0'});
  const capability=resolveActorAction(request);
  const original={assetId:'human-a',bindings:{[capability.clip]:'CrouchShoot'}};
  const replacement={assetId:'human-b',bindings:{[capability.clip]:'Rifle_Kneel_Fire'}};
  assert.notEqual(original.bindings[capability.clip],replacement.bindings[capability.clip]);
  assert.equal(resolveActorAction(request),capability);assert.equal(request.actionId,'order:17:attack:0');
  assert.equal(capability.action,'fire');assert.equal(capability.equipment,'long-gun');
});

test('preserved-facing lateral movement has distinct left and right source clips',()=>{
  for(const posture of ['standing','crouched'])for(const equipment of ACTOR_EQUIPMENT){
    const left=resolveActorAction({action:'strafeLeft',posture,equipment});
    const right=resolveActorAction({action:'strafeRight',posture,equipment});
    assert.ok(left?.loop);assert.ok(right?.loop);assert.notEqual(left.clip,right.clip);
    assert.notEqual(left.clip,resolveActorAction({action:'walk',posture,equipment}).clip);
  }
  for(const posture of ['prone','mounted'])assert.equal(resolveActorAction({action:'strafeLeft',posture}),null);
  const bank=validBank();bank.clips.find(c=>c.gesture==='strafeLeft').locomotionSpeed=0;
  assert.match(validateActorActionCapabilities(bank).join('\n'),/Missing stride speed/);
});

test('lance item overrides preserve gameplay blade semantics and bind complete poses',()=>{
  const overrides=ACTOR_ITEM_CLIP_OVERRIDES['1812'];
  const specs=new Map(ACTOR_CLIP_SPECS.map(spec=>[spec.name,spec]));
  assert.ok(Object.keys(overrides).length>=20);
  for(const [base,binding]of Object.entries(overrides)){
    assert.equal(specs.get(base)?.equipment,'blade');assert.equal(specs.get(binding)?.equipment,'lance');
    assert.equal(specs.get(base).posture,specs.get(binding).posture);
    assert.equal(specs.get(base).loop,specs.get(binding).loop);
  }
  for(const posture of ['standing','crouched','mounted']){
    const strike=resolveActorAction({action:'strike',posture,equipment:'blade'});
    assert.equal(specs.get(overrides[strike.clip]).gesture,'thrust');
    assert.equal(strike.action,'strike');assert.equal(strike.equipment,'blade');
    assert.ok(overrides[resolveActorAction({action:'brace',posture,equipment:'blade'}).clip]);
  }
  assert.equal(ACTOR_EQUIPMENT.includes('lance'),false);
});

test('motion sources have pinned identities and matching file hashes', async()=>{
  const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');
  const base=new URL('../assets/source/characters-3d/authoring/vendor/motion/',import.meta.url);
  const source=JSON.parse(await readFile(new URL('source-manifest.json',base),'utf8'));
  assert.match(source.license,/CMU custom/);assert.ok(source.terms_summary.includes('does not allow selling the motion data'));
  for(const file of source.files){const data=await readFile(new URL(file.file,base));assert.equal(data.length,file.bytes,file.file);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.file);assert.match(file.url,/09a07f54f3bbb58797325f009282d0b2048a2871/);}
  for(const clip of Object.values(source.clips))assert.ok(source.files.some(f=>f.file===clip.file));
});
