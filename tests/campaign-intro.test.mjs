import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act,StrictMode} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {encodeSave} from '../game/save.js';

// Keep the real Home, introduction and autosave behavior. Only the heavy game
// screens and dialog presentation are replaced with observable controls.
const reactUrl=new URL('../web/node_modules/react/index.js',import.meta.url).href;
const start=`import {createElement as h} from ${JSON.stringify(reactUrl)};`;
const views={
 './Desk':`${start}export default function Desk({state,dispatch,initialTab='overview'}){return h('section',{'data-screen':'desk','data-campaign':JSON.stringify(state),'data-tab':initialTab},h('button',{onClick:()=>dispatch({type:'recruitCivic',id:110,term:'week'})},'Hire 110'),h('button',{onClick:()=>dispatch({type:'visitSector'})},'Visit Retiro'));}`,
 './Campaign':`${start}export default function Campaign({state}){return h('section',{'data-screen':'campaign','data-campaign':JSON.stringify(state)});}`,
 './SectorDeployment':`${start}export default function Deployment({battle}){return h('section',{'data-screen':'battle','data-battle':JSON.stringify(battle)});}`,
 './Battlefield':`${start}export default function Battlefield({battle}){return h('section',{'data-screen':'battle','data-battle':JSON.stringify(battle)});}`,
 './CampaignPerformance':'export default function CampaignPerformance(){return null;}',
 '@/components/ui/dialog':`${start}export function Dialog({open,children}){return open?h('div',null,children):null;}export function DialogContent({children}){return h('div',null,children);}export function DialogTitle({children}){return h('h2',null,children);}export function DialogDescription({children}){return h('p',null,children);}`,
};
const homeUrl=new URL('../web/app/page.tsx',import.meta.url).href;
register('./tactical-render-loader.mjs',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`const views=${JSON.stringify(views)};export function resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(homeUrl)}&&Object.hasOwn(views,specifier))return {url:'data:text/javascript,'+encodeURIComponent(views[specifier]),shortCircuit:true};return next(specifier,context);}`)}`,import.meta.url);
const {default:Home}=await import('../web/app/page.tsx');
const {default:CampaignIntro}=await import('../web/app/CampaignIntro.tsx');

async function mount(t,element,{stored=null,reducedMotion=false,controlledTime=false}={}){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 dom.window.scrollTo=()=>{};
 dom.window.matchMedia=()=>({matches:reducedMotion,addEventListener(){},removeEventListener(){}});
 const timers=new Map();let time=0,nextTimer=0;
 if(controlledTime){dom.window.setTimeout=(callback,delay=0)=>{const id=++nextTimer;timers.set(id,{callback,due:time+delay});return id;};dom.window.clearTimeout=id=>timers.delete(id);}
 const jobs=[],writes=[],reads=[];
 class Worker{postMessage(job){jobs.push(structuredClone(job));}terminate(){this.closed=true;}}
 const globals={window:dom.window,document:dom.window.document,Worker,IS_REACT_ACT_ENVIRONMENT:true,
  localStorage:{getItem(key){reads.push(key);return stored;},setItem(key,text){writes.push({key,text});stored=text;}}};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(element));
 const button=text=>{
  const buttons=[...dom.window.document.querySelectorAll('button')];
  return buttons.find(button=>button.textContent.trim()===text||button.getAttribute('aria-label')===text)??buttons.find(button=>button.textContent.includes(text));
 };
 return {dom,jobs,writes,reads,button,timers,
  intro:()=>dom.window.document.querySelector('[data-campaign-intro]'),
  scene:()=>dom.window.document.querySelector('[data-intro-scene]')?.getAttribute('data-intro-scene'),
  screen:()=>dom.window.document.querySelector('[data-screen]'),
  stored:()=>stored,
  async click(text){const target=button(text);assert.ok(target,`missing button ${text}`);await act(async()=>target.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async lastScene(){const scenes=[...dom.window.document.querySelectorAll('button[aria-label^="Ver escena "]')];assert.ok(scenes.length>1);await act(async()=>scenes.at(-1).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async advance(ms){const until=time+ms;for(;;){const [id,timer]=[...timers.entries()].sort((a,b)=>a[1].due-b[1].due)[0]??[];if(!timer||timer.due>until)break;time=timer.due;timers.delete(id);await act(async()=>timer.callback());}time=until;},
  async hidden(hidden){Object.defineProperty(dom.window.document,'hidden',{configurable:true,value:hidden});await act(async()=>dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')));},
  async key(key){await act(async()=>dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true})));},
  async clear(){await act(async()=>root.render(null));},
 };
}

function callbacks(){const completed=[],back=[];return {completed,back,props:{onComplete:destination=>completed.push(destination),onBack:()=>back.push(true)}};}
const editableContent={id:'test-intro',version:1,title:'An edited opening',scenes:['arrival','orders','muster'].map(id=>({id,eyebrow:'1812',title:`Edited ${id}`,text:`Editable story text: ${id}`,visual:'route',durationMs:1000}))};

test('edited content advances on its own timing, pauses while hidden, and stops at the final choice',async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,{...c.props,content:editableContent}),{controlledTime:true});
 assert.equal(m.intro().getAttribute('aria-label'),'An edited opening');assert.ok(m.dom.window.document.body.textContent.includes('Editable story text: arrival'));
 await m.advance(999);assert.equal(m.scene(),'arrival');await m.advance(1);assert.equal(m.scene(),'orders');
 await m.click('Pausar');assert.equal(m.timers.size,0);await m.advance(5000);assert.equal(m.scene(),'orders');
 await m.click('Reproducir');await m.hidden(true);assert.equal(m.timers.size,0);await m.advance(5000);assert.equal(m.scene(),'orders');
 await m.hidden(false);await m.advance(1000);assert.equal(m.scene(),'muster');assert.equal(m.timers.size,0);assert.deepEqual(c.completed,[],'the final choice must wait for the player');
 await m.advance(5000);assert.equal(m.scene(),'muster');assert.deepEqual(c.completed,[]);
});

test('reduced motion requires manual advance and Escape returns without completion',async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,{...c.props,content:editableContent}),{controlledTime:true,reducedMotion:true});
 assert.equal(m.intro().dataset.reducedMotion,'true');assert.equal(m.timers.size,0);await m.advance(5000);assert.equal(m.scene(),'arrival');
 await m.click('Siguiente');assert.equal(m.scene(),'orders');await m.key('Escape');assert.deepEqual(c.back,[true]);assert.deepEqual(c.completed,[]);
});

for(const automatic of [false,true])test(`${automatic?'automatic replay':'manual introduction'} preserves focused Next and the live region, then focuses the final choice`,async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,{...c.props,content:editableContent,replay:automatic}),{controlledTime:true});
 const document=m.dom.window.document,live=document.querySelector('[aria-live="polite"]'),stage=document.querySelector('[data-intro-scene]'),next=m.button('Siguiente');
 next.focus();assert.equal(document.activeElement,next);assert.ok(live.textContent.includes('Edited arrival'));
 if(automatic)await m.advance(1000);else await m.click('Siguiente');
 assert.equal(m.scene(),'orders');assert.equal(document.activeElement,next,'the existing Next button retains keyboard focus');
 assert.equal(document.querySelector('[aria-live="polite"]'),live,'update the existing live region so assistive technology can announce the scene');
 assert.equal(document.querySelector('[data-intro-scene]'),stage);assert.ok(live.textContent.includes('Edited orders'));
 if(automatic)await m.advance(1000);else await m.click('Siguiente');
 assert.equal(m.scene(),'muster');assert.equal(next.isConnected,false);
 assert.equal(document.activeElement,m.button(automatic?'Volver al juego':'Contratar combatientes'),'focus moves to the final primary choice when Next disappears');
 assert.equal(document.querySelector('[aria-live="polite"]'),live);assert.ok(live.textContent.includes('Edited muster'));
 await m.key('Escape');assert.deepEqual(c.back,[true],'Escape still bubbles from the focused final button');assert.deepEqual(c.completed,[]);
});

test('StrictMode retains one scene timer and unmount cancels it',async t=>{
 const c=callbacks(),m=await mount(t,h(StrictMode,null,h(CampaignIntro,{...c.props,content:editableContent})),{controlledTime:true});
 assert.equal(m.timers.size,1);await m.clear();assert.equal(m.timers.size,0);await m.advance(5000);assert.deepEqual(c.completed,[]);
});

test('introduction scene controls, pause and back preserve the campaign decision',async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,c.props));
 assert.ok(m.intro());const first=m.scene();assert.ok(first);
 await m.click('Pausar');assert.ok(m.button('Reproducir'));
 await m.click('Siguiente');assert.notEqual(m.scene(),first);
 await m.click('Ver escena 1');assert.equal(m.scene(),first);
 await m.click('Reproducir');assert.ok(m.button('Pausar'));
 await m.click('Volver');assert.deepEqual(c.back,[true]);assert.deepEqual(c.completed,[]);
});

for(const [button,destination]of [['Contratar combatientes','hire'],['Crear mi granadero','create']])test(`the final scene selects ${destination} without creating state inside the introduction`,async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,c.props));
 await m.lastScene();assert.ok(m.button('Contratar combatientes'));assert.ok(m.button('Crear mi granadero'));
 await m.click(button);assert.deepEqual(c.completed,[destination]);assert.deepEqual(c.back,[]);assert.equal(m.jobs.length,0);assert.equal(m.writes.length,0);
});

test('skipping the introduction chooses recruitment',async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,c.props));
 await m.click('Omitir introducción');assert.deepEqual(c.completed,['hire']);
});

test('replay closes or finishes through its return callback without recruitment controls',async t=>{
 const c=callbacks(),m=await mount(t,h(CampaignIntro,{...c.props,replay:true}));
 assert.ok(m.button('Cerrar introducción'));assert.equal(m.button('Omitir introducción'),undefined);
 await m.lastScene();assert.ok(m.button('Volver al juego'));assert.equal(m.button('Crear mi granadero'),undefined);assert.equal(m.button('Contratar combatientes'),undefined);
 await m.click('Volver al juego');assert.equal(c.completed.length,1);assert.deepEqual(c.back,[]);
});

test('new campaign waits for the introduction, can go back, and then opens recruitment',async t=>{
 const m=await mount(t,h(Home));
 await m.click('Nueva campaña');assert.ok(m.intro());assert.equal(m.screen(),null);assert.equal(m.jobs.length,0);assert.equal(m.writes.length,0);
 await m.click('Volver');assert.equal(m.intro(),null);assert.equal(m.screen(),null);assert.equal(m.button('Continuar campaña'),undefined);assert.equal(m.jobs.length,0);
 await m.click('Nueva campaña');await m.click('Omitir introducción');
 assert.equal(m.intro(),null);assert.equal(m.screen().dataset.screen,'desk');assert.equal(m.screen().dataset.tab,'hire');assert.deepEqual(JSON.parse(m.screen().dataset.campaign).recruited,[]);assert.equal(m.jobs.length,1);
});

test('finishing the introduction at character creation opens that desk tab',async t=>{
 const m=await mount(t,h(Home));await m.click('Nueva campaña');await m.lastScene();await m.click('Crear mi granadero');
 assert.equal(m.screen().dataset.screen,'desk');assert.equal(m.screen().dataset.tab,'create');assert.deepEqual(JSON.parse(m.screen().dataset.campaign).recruited,[]);
});

test('backing out of a replacement introduction preserves the previous save and Continue skips the introduction',async t=>{
 const previous=dispatchCampaign(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'}),stored=encodeSave(previous);
 const m=await mount(t,h(Home),{stored});await m.click('Nueva campaña');await m.click('Comenzar campaña');assert.ok(m.intro());assert.equal(m.jobs.length,0);assert.equal(m.stored(),stored);
 await m.click('Volver');assert.equal(m.intro(),null);assert.equal(m.writes.length,0);assert.equal(m.stored(),stored);
 await m.click('Continuar campaña');assert.equal(m.intro(),null);assert.equal(m.screen().dataset.screen,'campaign');assert.deepEqual(JSON.parse(m.screen().dataset.campaign),previous);
});

for(const activeBattle of [false,true])test(`in-game replay preserves the current ${activeBattle?'battle':'campaign'} and returns to the same screen`,async t=>{
 const m=await mount(t,h(Home));await m.click('Nueva campaña');await m.click('Omitir introducción');await m.click('Hire 110');if(activeBattle)await m.click('Visit Retiro');
 const before=m.screen().outerHTML,jobs=m.jobs.length;await m.click('Menú');await m.click('Ver introducción');assert.ok(m.intro());assert.equal(m.screen(),null);
 await m.click('Cerrar introducción');assert.equal(m.intro(),null);assert.equal(m.screen().outerHTML,before);assert.equal(m.jobs.length,jobs,'replay must not submit a different campaign or battle');
});

test('title replay is available before creating a campaign and does not create a save',async t=>{
 const m=await mount(t,h(Home));await m.click('Ver introducción');assert.ok(m.intro());await m.click('Cerrar introducción');
 assert.equal(m.intro(),null);assert.equal(m.screen(),null);assert.equal(m.jobs.length,0);assert.equal(m.writes.length,0);assert.equal(m.button('Continuar campaña'),undefined);
});
