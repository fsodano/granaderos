import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignAutosave} from '../web/lib/campaign-autosave.js';

const pair=revision=>({campaign:{revision},battle:{revision,units:[{hp:100-revision}]}});
const serialize=({campaign,battle})=>JSON.stringify({campaign,battle});
function fixture({workerAvailable=true,postError=false,writeError=false}={}){
 const jobs=[],encoded=[],writes=[],saved=[],errors=[];
 const worker={
  terminations:0,
  postMessage(job){if(postError)throw Error('worker unavailable');jobs.push(structuredClone(job));},
  terminate(){this.terminations++;},
 };
 const saver=createCampaignAutosave({
  worker:workerAvailable?worker:null,
  encode(campaign,battle){const snapshot={campaign,battle};encoded.push(snapshot);return serialize(snapshot);},
  write(text){if(writeError)throw Error('storage full');writes.push(text);},
  onSaved:()=>saved.push(true),onError:error=>errors.push(error.message),
 });
 return {saver,worker,jobs,encoded,writes,saved,errors,
  submit(snapshot){saver.submit(snapshot.campaign,snapshot.battle);},
  reply(job,extra={}){worker.onmessage({data:{id:job.id,text:serialize(job),...extra}});},
 };
}

test('submitting a campaign does not serialize or write before its worker reply',()=>{
 const f=fixture(),snapshot=pair(1);f.submit(snapshot);
 assert.equal(f.jobs.length,1);assert.deepEqual(f.encoded,[]);assert.deepEqual(f.writes,[]);
 assert.deepEqual({campaign:f.jobs[0].campaign,battle:f.jobs[0].battle},snapshot);
 f.reply(f.jobs[0]);assert.deepEqual(f.writes,[serialize(snapshot)]);assert.equal(f.saved.length,1);
 f.saver.close();
});

test('rapid saves coalesce to the latest complete campaign and battle pair',()=>{
 const f=fixture();f.submit(pair(1));f.submit(pair(2));f.submit(pair(3));
 assert.equal(f.jobs.length,1,'only one worker job can be in flight');
 f.reply(f.jobs[0]);assert.deepEqual(f.writes,[],'obsolete serialization cannot replace the new campaign');
 assert.deepEqual(f.jobs.map(job=>job.campaign.revision),[1,3]);
 f.reply(f.jobs[1]);assert.deepEqual(f.writes,[serialize(pair(3))]);assert.deepEqual(f.encoded,[]);
 f.reply(f.jobs[0]);f.reply(f.jobs[1]);assert.equal(f.writes.length,1,'late or duplicate replies cannot write again');
 f.saver.close();
});

test('navigation flush persists the newest pair and suppresses the older worker reply',()=>{
 const f=fixture();f.submit(pair(1));f.submit(pair(2));f.saver.flush();
 assert.deepEqual(f.encoded,[pair(2)]);assert.deepEqual(f.writes,[serialize(pair(2))]);
 f.saver.flush();f.reply(f.jobs[0]);assert.equal(f.encoded.length,1);assert.equal(f.writes.length,1);
 assert.equal(f.jobs.length,1,'an already flushed replacement does not need another job');
 f.saver.close();
});

for(const event of ['onerror','onmessageerror'])test(`${event} saves the latest pair through the ordinary encoder`,()=>{
 const f=fixture();f.submit(pair(1));f.submit(pair(2));f.worker[event]();
 assert.equal(f.worker.terminations,1);assert.deepEqual(f.encoded,[pair(2)]);
 assert.deepEqual(f.writes,[serialize(pair(2))]);assert.deepEqual(f.errors,[]);
 f.reply(f.jobs[0]);assert.equal(f.writes.length,1);
 f.submit(pair(3));assert.deepEqual(f.writes,[serialize(pair(2)),serialize(pair(3))]);
 f.saver.close();assert.equal(f.worker.terminations,1);
});

for(const options of [{workerAvailable:false},{postError:true}])test(`unavailable worker still saves the exact pair: ${JSON.stringify(options)}`,()=>{
 const f=fixture(options);f.submit(pair(4));assert.deepEqual(f.encoded,[pair(4)]);
 assert.deepEqual(f.writes,[serialize(pair(4))]);f.saver.close();
});

test('obsolete encode errors start the latest save and current errors remain reportable',()=>{
 const f=fixture();f.submit(pair(1));f.submit(pair(2));
 f.reply(f.jobs[0],{error:'old save too large'});assert.deepEqual(f.errors,[]);assert.equal(f.jobs.length,2);
 f.reply(f.jobs[1],{error:'current save too large'});assert.deepEqual(f.errors,['current save too large']);assert.deepEqual(f.writes,[]);
 f.submit(pair(3));f.reply(f.jobs[2]);assert.deepEqual(f.writes,[serialize(pair(3))]);f.saver.close();
});

test('failed storage is reported without announcing a completed save',()=>{
 const f=fixture({writeError:true});f.submit(pair(1));f.reply(f.jobs[0]);
 assert.deepEqual(f.errors,['storage full']);assert.deepEqual(f.saved,[]);
 f.saver.flush();assert.deepEqual(f.errors,['storage full','storage full']);assert.deepEqual(f.saved,[]);f.saver.close();
});

test('closing a lifecycle cancels pending work and rejects its late callbacks',()=>{
 const f=fixture();f.submit(pair(1));f.submit(pair(2));f.saver.close();f.saver.close();
 f.reply(f.jobs[0]);f.worker.onerror();f.worker.onmessageerror();f.submit(pair(3));f.saver.flush();
 assert.equal(f.worker.terminations,1);assert.equal(f.jobs.length,1);
 assert.deepEqual(f.encoded,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.errors,[]);
});
