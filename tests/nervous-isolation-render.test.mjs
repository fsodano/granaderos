import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,useState,act} from '../web/node_modules/react/index.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle,endTurn,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {ammoCount} from '../game/ammo-types.js';
import {tacticalFeedback} from '../game/tactical-feedback.js';
import {withCharacterSpeech} from '../game/character-events.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {earnNervousIsolation} from './nervous-isolation-fixture.mjs';
const {default:Inventory}=await import('../web/app/JA2Inventory.tsx');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const noop=()=>{};
const actor=battle=>battle.units.find(unit=>unit.id==='130');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const popup=tree=>nodes(tree).find(node=>node.props?.className==='tactical-feedback-popup')??null;

function preparedIsolation({oldPinned=false}={}){
 const content=defaultContentPackage();
 if(oldPinned){const cejas=content.characters.find(person=>person.id==='person-130');cejas.abilities=cejas.abilities.filter(id=>id!=='nervous_isolation');}
 const roster=rosterFor(initialCampaign(42,content));
 // Prepared low-morale UI context, not an earned campaign injury or opening
 // victory. Native identities/kit and the initial morale/positions are fixed
 // before actions. The passive enemy remains beyond the stone screen.
 return createBattle([130,110].map(id=>({...roster.find(unit=>unit.id===id),x:id===130?1:7,y:3,facing:2,...(id===130?{morale:49,shock:4}:{})})),{
  width:24,height:14,seed:42,
  enemies:[{id:'enemy',x:22,y:12,loaded:0,ammo:0,patrol:false,overwatch:false}],
  tiles:Array.from({length:24*14},(_,i)=>{const x=i%24,y=Math.floor(i/24);return x===14?{x,y,type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}:{x,y,type:'grass',blocked:false,cover:0};}),
 });
}

test('mounted soldier information separates current tension from next-turn fear and real regrouping stops the forecast',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(dom.window.document.getElementById('root'));
 const initial=preparedIsolation();let current=initial,issue,replace;const history=[];
 function Screen(){
  const [battle,setBattle]=useState(initial);current=battle;replace=setBattle;
  issue=action=>setBattle(before=>{const next=actBattle(before,action);assert.equal(next.lastError,null,next.lastError);assert.deepEqual(presentedActBattle(before,action).state,next);history.push(action);return validateBattleSnapshot(JSON.parse(JSON.stringify(next)));});
  return h(Inventory,{battle,unit:actor(battle),units:battle.units,selected:'130',mode:'move',showSight:false,busy:false,missionAllies:[],localMilitia:[],vw:500,vh:400,project:(x,y)=>({x:x*26,y:y*14}),cameraRect:{x:0,y:0,width:200,height:150},zoom:1,onOrder:action=>issue({...action,unitId:'130'}),onMode:noop,onToggleSight:noop,onSelect:noop,onRetreat:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCloseInventory:noop});
 }
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(Screen)));
 const doc=dom.window.document,status=()=>doc.querySelector('[aria-label="Temor al aislamiento"]'),tension=()=>[...doc.querySelectorAll('.ja2-stats>div')].find(div=>div.firstElementChild?.textContent==='Tensión actual').querySelector('b').textContent;
 assert.equal(tension(),'4');assert.match(status().textContent,/Temor al aislamiento.*Si sigue aislado y con moral baja: tensión \+2 al comenzar su turno, tras la recuperación habitual/);assert.deepEqual(current,initial,'inspection does not apply the consequence');
 const crouch=doc.querySelector('[aria-label^="Cambiar a Agachado:"]');assert.ok(crouch);assert.equal(crouch.disabled,false);
 const pa=actor(current).ap;await act(async()=>crouch.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 assert.equal(actor(current).stance,'crouched');assert.ok(actor(current).ap<pa);assert.equal(actor(current).shock,4,'a paid stance action is not a new combat turn');
 await act(async()=>issue({type:'rest'}));
 assert.equal(current.mode,'combat');assert.equal(actor(current).shock,4,'normal recovery halves four, then the real isolated turn adds two');assert.equal(tension(),'4');assert.equal(actor(current).nervousIsolationWarned,true);
 const beforeRegroup=structuredClone(current),moving=actor(current);
 await act(async()=>issue({type:'move',unitId:'130',x:3,y:3}));
 assert.equal(actor(current).x,3);assert.ok(actor(current).ap<moving.ap);assert.ok(actor(current).energy<moving.energy);assert.equal(actor(current).shock,moving.shock);
 assert.equal(tension(),'4');assert.match(status().textContent,/Compañía cercana: sin aumento/);assert.doesNotMatch(status().textContent,/Si sigue aislado/);
 for(const field of ['hp','medkits','condition','loaded'])assert.equal(actor(current)[field],actor(initial)[field]);assert.equal(ammoCount(actor(current)),ammoCount(actor(initial)));
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(current)));await act(async()=>replace(saved));assert.match(status().textContent,/Compañía cercana: sin aumento/);assert.deepEqual(current,saved,'loading a validated tactical snapshot does not apply fear or repeat its notice');
 let replay=preparedIsolation();for(const action of history)replay=actBattle(replay,action);assert.deepEqual(replay,current,'the same finite public orders replay exactly');
 assert.equal(beforeRegroup.units.find(unit=>unit.id==='130').shock,4);
 const older=preparedIsolation({oldPinned:true});await act(async()=>replace(older));assert.equal(status(),null);assert.equal(doc.body.textContent.includes('Tensión actual'),false);
 await act(async()=>issue({type:'rest'}));assert.equal(actor(current).shock,2,'an omitted pinned capability retains normal recovery');assert.equal(actor(current).nervousIsolationWarned,undefined);assert.equal(status(),null);
});

test('a real first isolation turn shows one named temporary popup without estimating net shock or repeating on restore',async t=>{
 const before=preparedIsolation(),action={type:'rest'},after=actBattle(before,action),original=structuredClone(after);
 assert.equal(after.lastError,null);assert.deepEqual(presentedActBattle(before,action).state,after);
 assert.equal(actor(after).nervousIsolationWarned,true);assert.equal(actor(after).shock,actor(before).shock,'recovery plus fear is not the same as a net two-point increase');
 const text=`${actor(after).name} siente temor al quedar sin apoyo.`;
 assert.deepEqual(tacticalFeedback(before,after),[text]);assert.deepEqual(tacticalFeedback(after,after),[]);
 const props=battle=>({battle,onChange:next=>next,onFinish(){}}),mounted=await mountBattlefield(t,Battlefield,props(before),{virtualTimers:true,renderTree:popup});
 assert.equal(popup(mounted.tree()),null);
 await mounted.render(props(after));assert.equal(document.querySelector('[role="status"]').textContent,text);assert.doesNotMatch(popup(mounted.tree()).props.children,/\+2|Tensión/);
 assert.equal(await mounted.nextDelay(),4000);assert.equal(document.querySelector('[role="status"]'),null);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(after)));await mounted.render(props(restored));assert.equal(popup(mounted.tree()),null,'an unchanged restored flag does not replay a notice');
 assert.deepEqual(after,original,'display and timer expiry change no shock, RNG, gear or action cost');
 assert.equal(mounted.jobs().filter(job=>job.job.kind==='action'||job.job.kind==='movement-step').length,0);
 // Display-only malformed-source controls: no new physical outcomes are
 // injected into a played battle. The engine validates these identities.
 for(const change of [unit=>unit.id='unowned',unit=>unit.militia=true,unit=>unit.missionAlly=true,unit=>unit.side='enemy',unit=>delete unit.abilities]){
  const invalidBefore=structuredClone(before),invalidAfter=structuredClone(after);change(actor(invalidBefore));change(actor(invalidAfter));assert.deepEqual(tacticalFeedback(invalidBefore,invalidAfter),[]);
 }
});

test('loading an existing fear flag and old pinned turn recovery never backfill a popup',async t=>{
 const before=preparedIsolation(),received=actBattle(before,{type:'rest'}),props=battle=>({battle,onChange:next=>next,onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(validateBattleSnapshot(JSON.parse(JSON.stringify(received)))),{virtualTimers:true,renderTree:popup});
 assert.equal(popup(mounted.tree()),null,'the initial saved flag is not a new event');await mounted.render(props(structuredClone(received)));assert.equal(popup(mounted.tree()),null);
 const older=preparedIsolation({oldPinned:true}),recovered=actBattle(older,{type:'rest'});assert.equal(actor(recovered).shock,2);assert.equal(actor(recovered).nervousIsolationWarned,undefined);
 await mounted.render(props(older));await mounted.render(props(recovered));assert.equal(popup(mounted.tree()),null,'ordinary shock recovery does not invent a fear receipt');
 assert.deepEqual(tacticalFeedback(older,recovered),[]);
});

test('real Page file imports restore earned fear without backfill and a later actual turn still shows its notice',async t=>{
 const earned=earnNervousIsolation(),before=earned.beforeFear,received=earned.pair;
 assert.equal(actor(before.battle).nervousIsolationWarned,undefined);assert.equal(actor(received.battle).nervousIsolationWarned,true);
 assert.equal(before.battle.battleId,received.battle.battleId,'this is a later save of the same real deployment');
 const mounted=await mountCampaign(t,before),doc=mounted.document,visiblePopup=()=>doc.querySelector('.tactical-feedback-popup');
 assert.equal(visiblePopup(),null);assert.deepEqual(mounted.saved(),before);
 await mounted.click('Menú');
 async function importFile(text){
  await mounted.click('Importar partida');
  const file=new mounted.dom.window.File([text],'campaña.json',{type:'application/json'});let read=false;
  file.text=async()=>{read=true;return text;};
  const input=doc.querySelector('input[type="file"]');assert.ok(input);
  Object.defineProperty(input,'files',{configurable:true,value:[file]});
  await act(async()=>input.dispatchEvent(new mounted.dom.window.Event('change',{bubbles:true})));
  assert.equal(read,true,'the mounted file handler must read and decode the selected file');assert.equal(input.value,'');
 }
 async function closeMenu(){const close=doc.querySelector('.dialog-close');assert.ok(close);await act(async()=>close.dispatchEvent(new mounted.dom.window.MouseEvent('click',{bubbles:true})));}
 await importFile(encodeSave(received.campaign,received.battle));
 assert.deepEqual(mounted.saved(),received,'import restores the exact paid wounds, fear, clock, RNG and finite custody');
 assert.equal(visiblePopup(),null,'imported later receipts are not newly played events');
 await importFile(encodeSave(before.campaign,before.battle));
 assert.deepEqual(mounted.saved(),before);assert.equal(visiblePopup(),null);
 await closeMenu();
 const ordinary=withCharacterSpeech(before.battle,endTurn(before.battle)),synced=syncBattleTime(before.campaign,ordinary);assert.equal(synced.error,null,synced.error);
 const expected=decodeSave(encodeSave(synced.campaign,synced.battle));
 await act(async()=>doc.body.dispatchEvent(new mounted.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true})));
 await mounted.settleUntil(()=>actor(mounted.saved().battle).nervousIsolationWarned===true);
 assert.deepEqual(mounted.saved(),expected,'the accepted keyboard turn still uses the ordinary saved result');
 const text=`${actor(expected.battle).name} siente temor al quedar sin apoyo.`;
 assert.equal(visiblePopup()?.textContent,text);
 await mounted.click('Menú');await importFile('{}');
 assert.deepEqual(mounted.saved(),expected,'failed import cannot replace the campaign or restart the battle');
 assert.equal(visiblePopup()?.textContent,text,'failed import does not reset an accepted transient event');
 await closeMenu();await mounted.settleUntil(()=>visiblePopup()===null);
 assert.deepEqual(mounted.saved(),expected,'temporary notice expiry changes no game state');
});
