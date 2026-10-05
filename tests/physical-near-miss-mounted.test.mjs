import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {preparedPhysicalNearMiss,performPhysicalNearMiss,physicalNearMissActor,physicalNearMissSaved} from './physical-near-miss-fixture.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {JA2Speech}=await import('../web/app/JA2Conversation.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const speech=tree=>nodes(tree).find(node=>node.type===JA2Speech)??null;
const endTurn=tree=>nodes(tree).find(node=>node.props?.onEndTurn).props.onEndTurn;

test('the real paid near passage speaks after flight, expires and does not repeat on commit or official reload',async t=>{
 const prepared=preparedPhysicalNearMiss(),result=performPhysicalNearMiss(prepared),source=prepared.pair.battle,original=structuredClone(prepared.pair),commits=[];
 const text=physicalNearMissActor(source).storyProfile.speech.near;
 assert.ok(text&&result.shown.frames.some(frame=>frame.nearMissIds?.includes('110')));
 const props=battle=>({battle,onChange:next=>{commits.push(next);return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(source),{virtualTimers:true,renderTree:speech});
 assert.equal(speech(mounted.tree()),null);
 await mounted.act(async()=>{void endTurn(mounted.tree())();});
 await mounted.deliver('presentation');
 let observedFlight=false,observedNear=false;
 for(let count=0;nodes(mounted.tree()).some(node=>node.props?.['data-enemy-frame']);count++){
  assert.ok(count<200,'the admitted firing sequence finishes');
  const tag=nodes(mounted.tree()).find(node=>node.props?.['data-enemy-frame']).props['data-enemy-frame'];
  if(tag.includes(':projectile:'))observedFlight=true;
  if(speech(mounted.tree())){
   observedNear=true;assert.ok(observedFlight,'a reaction cannot precede the visible fired passage');
   assert.equal(speech(mounted.tree()).props.text,text);
   assert.equal(document.querySelector('.ja2-speech').textContent.includes(text),true);
   assert.equal(commits.length,0,'playback holds input and the final result until all frames finish');
  }
  await mounted.nextDelay();
 }
 assert.ok(observedNear,'the zero-duration near frame still flushes the actual speech effect');
 assert.deepEqual(commits,[result.ordinary]);
 await mounted.render(props(result.pair.battle));
 assert.equal(speech(mounted.tree()).props.text,text);
 await mounted.act(async()=>nodes(mounted.tree()).find(node=>node.props?.onEndTurn).props.onSelect('107'));
 assert.equal(speech(mounted.tree()).props.text,text,'a selection change cannot discard an unfinished timed reaction');
 assert.equal(await mounted.nextDelay(),10000);
 assert.equal(document.querySelector('.ja2-speech'),null);
 await mounted.render(props(physicalNearMissSaved(result.pair).battle));
 assert.equal(speech(mounted.tree()),null,'a saved result cannot recreate a transient passage');
 assert.deepEqual(prepared.pair,original,'speech display and expiry preserve the paid input and finite kit');
 assert.equal(mounted.jobs().filter(job=>job.job?.kind==='action'||job.job?.kind==='movement-step').length,0);
});

test('actual cover stops, ignition failure, injury and old omitted lines produce no near-spotted fallback',async t=>{
 for(const options of [{control:'stop'},{control:'misfire'},{control:'hit'},{omittedSpeech:true}])await t.test(JSON.stringify(options),async t=>{
  const prepared=preparedPhysicalNearMiss(options),result=performPhysicalNearMiss(prepared),commits=[];
  const props=battle=>({battle,onChange:next=>{commits.push(next);return next;},onFinish(){}});
  const mounted=await mountBattlefield(t,Battlefield,props(prepared.pair.battle),{virtualTimers:true,renderTree:speech});
  await mounted.act(async()=>{void endTurn(mounted.tree())();});await mounted.deliver('presentation');
  for(let count=0;nodes(mounted.tree()).some(node=>node.props?.['data-enemy-frame']);count++){
   assert.ok(count<200);const line=speech(mounted.tree());
   if(line){assert.notEqual(line.props.text,physicalNearMissActor(prepared.pair.battle).storyProfile.speech.near);assert.notEqual(line.props.text,physicalNearMissActor(prepared.pair.battle).storyProfile.speech.contact);}
   await mounted.nextDelay();
  }
  assert.deepEqual(commits,[result.ordinary]);
  if(options.omittedSpeech)assert.equal(speech(mounted.tree()),null);
 });
});

test('replacement before the near frame discards the pending passage and final commit',async t=>{
 const prepared=preparedPhysicalNearMiss(),commits=[],props=battle=>({battle,onChange:next=>{commits.push(next);return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(prepared.pair.battle),{virtualTimers:true,renderTree:speech});
 await mounted.act(async()=>{void endTurn(mounted.tree())();});await mounted.deliver('presentation');
 assert.equal(speech(mounted.tree()),null);
 await mounted.render(props(physicalNearMissSaved(prepared.pair).battle));
 await mounted.nextDelay();
 assert.deepEqual(commits,[]);assert.equal(speech(mounted.tree()),null);
 assert.equal(nodes(mounted.tree()).some(node=>node.props?.['data-enemy-frame']),false);
});
