import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {initialCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';

// Mount the actual Home state and autosave controller. Replace only its screen
// presentation children so navigation assertions do not depend on map graphics.
const reactUrl=new URL('../web/node_modules/react/index.js',import.meta.url).href;
const start=`import {createElement as h} from ${JSON.stringify(reactUrl)};`;
const screen=`const summary=s=>JSON.stringify({phase:s.phase,recruited:s.recruited,treasury:s.resources.treasury,pendingBattle:s.pendingBattle?.id??null});`;
const views={
 './Desk':`${start}${screen}export default function Desk({state,dispatch}){return h('section',{'data-screen':'desk','data-campaign':summary(state)},h('button',{onClick:()=>dispatch({type:'recruitCivic',id:110,term:'week'})},'Hire 110'),h('button',{onClick:()=>dispatch({type:'visitSector'})},'Visit Retiro'));}`,
 './Campaign':`${start}${screen}export default function Campaign({state}){return h('section',{'data-screen':'campaign','data-campaign':summary(state)});}`,
 './SectorDeployment':`${start}export default function Deployment({battle}){return h('section',{'data-screen':'battle','data-battle':JSON.stringify(battle)});}`,
 './Battlefield':`${start}export default function Battlefield({battle}){return h('section',{'data-screen':'battle','data-battle':JSON.stringify(battle)});}`,
 './CampaignPerformance':'export default function CampaignPerformance(){return null;}',
 '@/components/ui/dialog':`${start}export function Dialog({open,children}){return open?h('div',null,children):null;}export function DialogContent({children}){return h('div',null,children);}export function DialogTitle({children}){return h('h2',null,children);}export function DialogDescription({children}){return h('p',null,children);}`,
};
const homeUrl=new URL('../web/app/page.tsx',import.meta.url).href;
const loader=`const views=${JSON.stringify(views)};export function resolve(specifier,context,next){if(context.parentURL===${JSON.stringify(homeUrl)}&&Object.hasOwn(views,specifier))return {url:'data:text/javascript,'+encodeURIComponent(views[specifier]),shortCircuit:true};return next(specifier,context);}`;
register('./tactical-render-loader.mjs',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(loader)}`,import.meta.url);
const {default:Home}=await import('../web/app/page.tsx');

async function mountHome(t,stored){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 dom.window.scrollTo=()=>{};
 const jobs=[],attempts=[],reads=[];
 class Worker{postMessage(job){jobs.push({worker:this,...structuredClone(job)});}terminate(){this.closed=true;}}
 const globals={window:dom.window,document:dom.window.document,Worker,IS_REACT_ACT_ENVIRONMENT:true,
  localStorage:{getItem(key){reads.push(key);return stored;},setItem(key,text){attempts.push({key,text});throw Error('QuotaExceededError');}}};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Home)));
 return {dom,jobs,attempts,reads,
  async click(text){const button=[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent.includes(text));assert.ok(button,`missing button ${text}`);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async menu(){const button=dom.window.document.querySelector('button[aria-label="Menú"]');assert.ok(button);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
  async fail(){assert.ok(jobs[0]);await act(async()=>jobs[0].worker.onmessageerror());},
  screen(){return dom.window.document.querySelector('[data-screen]');},
  warning(){return dom.window.document.body.textContent.includes('No se pudo guardar en este navegador. Exportá la partida para conservarla.');},
 };
}

for(const visit of [false,true])test(`Continue preserves the current ${visit?'active battle':'campaign'} after autosave storage failure`,async t=>{
 const older={campaign:initialCampaign(8),battle:null};
 const m=await mountHome(t,encodeSave(older.campaign,older.battle));
 await m.click('Continuar campaña');assert.equal(m.screen().dataset.screen,'desk');
 await m.click('Hire 110');if(visit)await m.click('Visit Retiro');
 assert.equal(m.jobs.length,1,'new states wait for the old in-flight save');
 await m.fail();assert.equal(m.attempts.length,1);assert.ok(m.warning());
 const latest=decodeSave(m.attempts[0].text);assert.deepEqual(latest.campaign.recruited,[110]);
 assert.equal(Boolean(latest.battle),visit);
 await m.menu();await m.click('Volver al menú principal');assert.equal(m.screen(),null);assert.ok(m.warning());
 const beforeResumeReads=m.reads.length;
 await m.click('Continuar campaña');
 assert.equal(m.reads.length,beforeResumeReads,'Continue must use the in-memory pair when storage is stale');
 assert.ok(m.warning(),'Continue must retain the save failure warning');
 if(visit){assert.equal(m.screen().dataset.screen,'battle');assert.deepEqual(JSON.parse(m.screen().dataset.battle),latest.battle);}
 else{assert.equal(m.screen().dataset.screen,'campaign');assert.deepEqual(JSON.parse(m.screen().dataset.campaign),{phase:latest.campaign.phase,recruited:latest.campaign.recruited,treasury:latest.campaign.resources.treasury,pendingBattle:null});}
});

test('a new campaign remains resumable and protected from replacement when its first save fails',async t=>{
 const m=await mountHome(t,null),button=text=>[...m.dom.window.document.querySelectorAll('button')].find(button=>button.textContent.includes(text));
 assert.equal(button('Continuar campaña'),undefined);assert.equal(button('Nueva campaña').className,'menu-primary');
 await m.click('Nueva campaña');assert.ok(m.dom.window.document.querySelector('[data-campaign-intro]'));
 await m.click('Omitir introducción');assert.equal(m.screen().dataset.screen,'desk');
 await m.click('Hire 110');
 await m.fail();assert.equal(m.attempts.length,1);assert.ok(m.warning());
 const latest=decodeSave(m.attempts[0].text);assert.deepEqual(latest.campaign.recruited,[110]);assert.equal(latest.battle,null);
 await m.menu();await m.click('Volver al menú principal');assert.equal(m.screen(),null);assert.ok(m.warning());
 assert.ok(button('Continuar campaña'),'a campaign in memory remains resumable before any successful save');
 assert.equal(button('Continuar campaña').className,'menu-primary');assert.equal(button('Nueva campaña').className,'menu-secondary');
 await m.click('Nueva campaña');assert.equal(m.screen(),null);assert.ok(button('Comenzar campaña'),'replacing an unsaved campaign still requires confirmation');assert.ok(m.warning());
 await m.click('Volver');
 const beforeResumeReads=m.reads.length;
 await m.click('Continuar campaña');
 assert.equal(m.reads.length,beforeResumeReads,'Continue must not try to load the empty storage');assert.ok(m.warning());
 assert.equal(m.screen().dataset.screen,'campaign');
 assert.deepEqual(JSON.parse(m.screen().dataset.campaign),{phase:latest.campaign.phase,recruited:latest.campaign.recruited,treasury:latest.campaign.resources.treasury,pendingBattle:null});
});
