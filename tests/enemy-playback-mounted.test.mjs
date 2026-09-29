import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,presentedEndTurn} from '../game/tactical.js';
const {useEnemyPlayback}=await import('../web/lib/useEnemyPlayback.ts');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const hosts=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(hosts):[n,...hosts(n.props?.children)];
const field=()=>createBattle([{id:'p',name:'Patriota',x:1,y:1,weapon:1801,marksmanship:70}],{width:24,height:12,seed:45,tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Realista',x:7,y:1,weapon:1801,marksmanship:15,morale:100},{id:'sword',name:'Sable',x:7,y:4,weapon:1809,morale:100}]});
async function mount(t,render){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'}),workers=[],timers=new Map();let serial=0;
 class Worker{constructor(){workers.push(this);}postMessage(message){this.message=message;}terminate(){this.terminated=true;}reply(result){this.onmessage({data:{id:this.message.id,result}});}}
 const globals={window:dom.window,document:dom.window.document,location:dom.window.location,Worker,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:()=>++serial,cancelAnimationFrame:()=>{},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 const old=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const rerender=()=>act(async()=>root.render(render()));await rerender();
 return {workers,root,rerender,async step(){const entry=timers.entries().next().value;assert.ok(entry,'a presentation delay is pending');timers.delete(entry[0]);await act(async()=>entry[1].fn());return entry[1].ms;}};
}
test('mounted enemy playback waits for each frame, prevents duplicate turns and commits once after the visible sequence',async t=>{
 let api,commits=[],busy=[],source=field();const result=presentedEndTurn(source);
 function Capture(){api=useEnemyPlayback(source,s=>commits.push(s),b=>busy.push(b));return null;}
 const env=await mount(t,()=>h(Capture));let done;
 await act(async()=>{done=api.run();void api.run();});assert.equal(env.workers.length,1);assert.equal(api.busy,true);assert.equal(commits.length,0);
 await act(async()=>env.workers[0].reply(result));
 let sawPrepare=false,sawStep=false;
 for(let i=0;i<result.frames.length;i++){
  assert.equal(api.frame.index,i);assert.equal(commits.length,0);assert.deepEqual(api.state.units,result.frames[i].state.units);
  if(api.frame.type==='prepare')sawPrepare=true;if(api.frame.type==='step')sawStep=true;
  await env.step();
 }
 await done;assert.ok(sawPrepare&&sawStep);assert.deepEqual(commits,[result.state]);assert.equal(api.busy,false);assert.equal(api.frame,null);assert.deepEqual(busy,[true,false]);assert.equal(commits[0].presentationVisibleIds,undefined);
});
test('replaced battles and unmounted views discard worker results and never commit stale turns',async t=>{
 for(const unmount of [false,true])await t.test(String(unmount),async t=>{
  let api,source=field(),commits=[];const original=source;
  function Capture(){api=useEnemyPlayback(source,s=>commits.push(s));return null;}
  const env=await mount(t,()=>h(Capture));let done;await act(async()=>{done=api.run();});
  if(unmount)await act(async()=>env.root.unmount());else{source=structuredClone(source);await env.rerender();}
  await act(async()=>env.workers[0].reply(presentedEndTurn(original)));await done;assert.deepEqual(commits,[]);if(unmount)assert.equal(env.workers[0].terminated,true);
 });
});
test('worker failure releases input and fallback errors do not leave a pending turn',async t=>{
 let api,source=field(),commits=[];
 function Capture(){api=useEnemyPlayback(source,s=>commits.push(s));return null;}
 const env=await mount(t,()=>h(Capture));let done;await act(async()=>{done=api.run();});await act(async()=>env.workers[0].onerror());await done;assert.equal(api.busy,false);assert.match(commits[0].lastError,/completar el turno/);
 source={units:null};await env.rerender();await act(async()=>{done=api.run();});await env.step();await done;assert.equal(api.busy,false);assert.equal(commits.length,2);assert.ok(commits[1].lastError);
});
test('mounted Battlefield shows steps and rejects invalid campaign transitions before playback',async t=>{
 for(const accepted of [true,false])await t.test(String(accepted),async t=>{
  const source=field(),result=presentedEndTurn(source);let tree,commits=[];
  function Capture(){tree=Battlefield({battle:source,onChange:s=>commits.push(s),onFinish(){},onRetreat(){},onPlaybackValidate:()=>accepted});return null;}
  const env=await mount(t,()=>h(Capture));
  await act(async()=>hosts(tree).find(n=>n.props?.onEndTurn).props.onEndTurn());await act(async()=>env.workers[0].reply(result));
  if(!accepted){assert.deepEqual(commits,[]);assert.ok(!hosts(tree).some(n=>n.props?.['data-enemy-frame']));return;}
  for(let i=0;i<result.frames.length;i++){assert.ok(hosts(tree).some(n=>n.props?.['data-enemy-frame']?.startsWith(`${i}:`)));await env.step();}
  assert.deepEqual(commits,[result.state]);assert.ok(!hosts(tree).some(n=>n.props?.['data-enemy-frame']));
 });
});
