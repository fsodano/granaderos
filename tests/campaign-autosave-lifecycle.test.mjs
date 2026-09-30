import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,StrictMode,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
const {useCampaignAutosave}=await import('../web/lib/useCampaignAutosave.ts');

function deployed(seed){
 let campaign=dispatchCampaign(initialCampaign(seed),{type:'recruitCivic',id:110,term:'week'});
 assert.equal(campaign.lastError,null);
 campaign=dispatchCampaign(campaign,{type:'visitSector'});assert.equal(campaign.lastError,null);
 const result=prepareCampaignBattle(campaign);assert.equal(result.error,null);
 return {campaign:result.campaign,battle:result.battle};
}

async function mountAutosave(t,snapshot,{strict=false,workerAvailable=true}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const workers=[],jobs=[],writes=[],saved=[],errors=[],listeners={pagehide:new Set(),visibilitychange:new Set()};
 class Worker{
  constructor(){if(!workerAvailable)throw Error('workers unavailable');this.terminations=0;workers.push(this);}
  postMessage(job){jobs.push({worker:this,...structuredClone(job)});}
  terminate(){this.terminations++;}
 }
 for(const [target,name] of [[dom.window,'pagehide'],[dom.window.document,'visibilitychange']]){
  const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);
  target.addEventListener=(type,listener,...rest)=>{if(type===name)listeners[name].add(listener);return add(type,listener,...rest);};
  target.removeEventListener=(type,listener,...rest)=>{if(type===name)listeners[name].delete(listener);return remove(type,listener,...rest);};
 }
 const globals={window:dom.window,document:dom.window.document,Worker,IS_REACT_ACT_ENVIRONMENT:true,
  localStorage:{setItem(key,text){writes.push({key,text});}}};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 function Controller({pair,keyName}){useCampaignAutosave(pair.campaign,pair.battle,()=>keyName,()=>saved.push(keyName),()=>errors.push(keyName));return null;}
 const root=createRoot(dom.window.document.getElementById('root'));let unmounted=false;
 const render=async(pair,keyName='campaign')=>{await act(async()=>root.render(strict?h(StrictMode,null,h(Controller,{pair,keyName})):h(Controller,{pair,keyName})));};
 const unmount=async()=>{if(!unmounted){await act(async()=>root.unmount());unmounted=true;}};
 t.after(async()=>{try{await unmount();}finally{dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await render(snapshot);
 return {workers,jobs,writes,saved,errors,listeners,render,unmount,
  async reply(job){await act(async()=>job.worker.onmessage({data:{id:job.id,text:encodeSave(job.campaign,job.battle)}}));},
  async fail(job,event='onmessageerror'){await act(async()=>job.worker[event]());},
  async pagehide(){await act(async()=>dom.window.dispatchEvent(new dom.window.Event('pagehide')));},
  async visibility(hidden){Object.defineProperty(dom.window.document,'hidden',{configurable:true,value:hidden});await act(async()=>dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')));},
 };
}

test('a loaded battle saves in the background and late replies cannot overwrite an imported campaign',async t=>{
 const original=deployed(8),imported=deployed(17),fresh={campaign:initialCampaign(23),battle:null};
 const m=await mountAutosave(t,original);assert.equal(m.jobs.length,1);assert.deepEqual(m.writes,[]);
 await m.render(imported);await m.render(fresh);assert.equal(m.jobs.length,1);
 await m.reply(m.jobs[0]);assert.deepEqual(m.writes,[]);assert.equal(m.jobs.length,2);
 assert.deepEqual({campaign:m.jobs[1].campaign,battle:m.jobs[1].battle},fresh);
 await m.reply(m.jobs[1]);assert.deepEqual(decodeSave(m.writes[0].text),fresh);
 await m.reply(m.jobs[0]);assert.equal(m.writes.length,1);assert.deepEqual(m.saved,['campaign']);assert.deepEqual(m.errors,[]);
});

for(const trigger of ['pagehide','visibility'])test(`${trigger} flushes the exact latest campaign and active battle before a worker reply`,async t=>{
 const previous={campaign:initialCampaign(4),battle:null},latest=deployed(6);
 const m=await mountAutosave(t,previous);await m.render(latest,'imported');
 await m.visibility(false);assert.deepEqual(m.writes,[],'visible documents do not force a synchronous save');
 if(trigger==='pagehide')await m.pagehide();else await m.visibility(true);
 assert.equal(m.writes.length,1);assert.equal(m.writes[0].key,'imported');
 assert.deepEqual(decodeSave(m.writes[0].text),latest);assert.deepEqual(m.saved,['imported']);
 await m.reply(m.jobs[0]);assert.equal(m.writes.length,1);assert.equal(m.jobs.length,1);
 await m.unmount();assert.equal(m.writes.length,1);assert.equal(m.workers[0].terminations,1);
 assert.equal(m.listeners.pagehide.size,0);assert.equal(m.listeners.visibilitychange.size,0);
});

test('a worker failure saves the newest active battle through the same valid save format',async t=>{
 const original={campaign:initialCampaign(2),battle:null},latest=deployed(3);
 const m=await mountAutosave(t,original);await m.render(latest);await m.fail(m.jobs[0]);
 assert.equal(m.workers[0].terminations,1);assert.deepEqual(decodeSave(m.writes[0].text),latest);
 await m.reply(m.jobs[0]);assert.equal(m.writes.length,1);assert.deepEqual(m.errors,[]);
});

test('without Worker support the mounted hook still saves a restorable campaign',async t=>{
 const latest=deployed(5),m=await mountAutosave(t,latest,{workerAvailable:false});
 assert.deepEqual(m.workers,[]);assert.deepEqual(decodeSave(m.writes[0].text),latest);assert.deepEqual(m.errors,[]);
});

test('unmount flushes once, removes navigation listeners and ignores late worker events',async t=>{
 const first={campaign:initialCampaign(10),battle:null},latest=deployed(11);
 const m=await mountAutosave(t,first);await m.render(latest);await m.unmount();
 assert.equal(m.writes.length,1);assert.deepEqual(decodeSave(m.writes[0].text),latest);
 assert.equal(m.workers[0].terminations,1);assert.equal(m.listeners.pagehide.size,0);assert.equal(m.listeners.visibilitychange.size,0);
 await m.reply(m.jobs[0]);await m.fail(m.jobs[0]);await m.pagehide();await m.visibility(true);
 assert.equal(m.writes.length,1);assert.deepEqual(m.errors,[]);
});

test('StrictMode effect replay closes only the previous worker and retains the current save lifecycle',async t=>{
 const first={campaign:initialCampaign(12),battle:null},latest=deployed(13);
 const m=await mountAutosave(t,first,{strict:true});assert.equal(m.workers.length,2);
 assert.equal(m.workers[0].terminations,1);assert.equal(m.workers[1].terminations,0);
 assert.equal(m.listeners.pagehide.size,1);assert.equal(m.listeners.visibilitychange.size,1);
 assert.equal(m.writes.length,1,'replayed cleanup flushes the prior complete pair');assert.deepEqual(decodeSave(m.writes[0].text),first);
 await m.render(latest);await m.reply(m.jobs[0]);assert.equal(m.writes.length,1);
 await m.reply(m.jobs[1]);assert.equal(m.writes.length,1);assert.equal(m.jobs.length,3);
 await m.reply(m.jobs[2]);assert.equal(m.writes.length,2);assert.deepEqual(decodeSave(m.writes[1].text),latest);
 await m.unmount();assert.equal(m.writes.length,2);assert.equal(m.workers[1].terminations,1);
 assert.equal(m.listeners.pagehide.size,0);assert.equal(m.listeners.visibilitychange.size,0);
});
