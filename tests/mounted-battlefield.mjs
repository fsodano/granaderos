import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {presentedEndTurn} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';

// Mount the real Battlefield controller and provider, including effects and
// cleanup. Child scene markup has separate rendering tests. Worker delivery is
// held until the test releases it; the job itself uses the production reducer.
export async function mountBattlefield(t,Battlefield,props,{clock,virtualTimers=false}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
 const pending=[],timers=new Map();let timerId=0;
 class Worker {
  postMessage(message){pending.push({worker:this,...message});}
  terminate(){this.closed=true;}
 }
 const globals={...(virtualTimers?{setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)}:{}),window:dom.window,document:dom.window.document,Worker,IS_REACT_ACT_ENVIRONMENT:true,
  requestAnimationFrame:clock?.request??dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:clock?.cancel??dom.window.cancelAnimationFrame.bind(dom.window),
  ...(clock?{performance:new Proxy(performance,{get(target,key){if(key==='now')return clock.now;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}})}:{})};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 let tree;
 const wrapper=Battlefield(props),content=wrapper.props.children;let currentProps=content.props;
 function Capture(){tree=content.type(currentProps);return null;}
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{
  try{await act(async()=>root.unmount());}
  finally{dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
 });
 await act(async()=>root.render(h(wrapper.type,null,h(Capture))));
 return {
  tree:()=>tree,
  act,
  jobs:()=>pending.filter(message=>!message.worker.closed),
  async nextDelay(){const entry=timers.entries().next().value;if(!entry)throw Error('No pending timer');timers.delete(entry[0]);await act(async()=>entry[1].fn());return entry[1].ms;},
  async render(nextProps){currentProps=nextProps;await act(async()=>root.render(h(wrapper.type,null,h(Capture))));},
  async fail(kind){
   const message=pending.find(message=>!message.worker.closed&&(message.job?.kind??'presentation')===kind);
   if(!message)throw Error(`No pending ${kind} job`);
   await act(async()=>message.worker.onmessageerror());
  },
  async deliver(kind){
   const index=pending.findIndex(message=>!message.worker.closed&&(message.job?.kind??'presentation')===kind);
   if(index<0)throw Error(`No pending ${kind} job`);
   const {worker,id,job,state}=pending.splice(index,1)[0];
   await act(async()=>worker.onmessage({data:job?{id,battle:runBattleJob(job)}:{id,result:presentedEndTurn(state)}}));
  },
 };
}
