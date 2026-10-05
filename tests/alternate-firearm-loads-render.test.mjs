import test from 'node:test';
import assert from 'node:assert/strict';
import {act,createElement as h} from '../web/node_modules/react/index.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {ammoCount,totalAmmo,changeAmmo} from '../game/ammo-types.js';
import {syncCarriedAmmunition} from '../game/campaign-ammunition.js';
import {mountLegacyArmory} from './mounted-legacy-armory-fixture.mjs';
import {weaponSpecification} from '../game/weapon-definition.js';
import {order,visit} from './local-contract-fixture.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actBattle,presentedActBattle,firearmVolleyPreview,shotChance,weaponFor,actionCosts} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview,chancePercent} from '../game/ja2-hud.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const pair=()=>{const d=defaultContentPackage();d.characters.find(c=>c.id==='person-110').arrivalHours=0;let s=order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});// Explicit finite carried shot in a subsystem save fixture.
 changeAmmo(s.operativeState[110],'ammoShot',3);syncCarriedAmmunition(s.operativeState[110],1800);return visit(s);};
const choose=async(m,family)=>act(async()=>{const select=m.document.querySelector('[aria-label="Carga para esta arma"]');select.value=family;select.dispatchEvent(new m.dom.window.Event('change',{bubbles:true}));});

test('isolated retained ammunition widget unloads, selects a new load and saves the selected family for departure',async t=>{
 const m=await mountLegacyArmory(t,pair());
 assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,true);assert.match(m.document.querySelector('[aria-label="Energía de la carga"]').textContent,/32 g.*265 m\/s.*1\.123,6 J/);await m.click('Descargar arma');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,false);await choose(m,'ammoShot');assert.match(m.document.querySelector('[aria-label="Energía de la carga"]').textContent,/16 g.*265 m\/s.*561,8 J/);const s=m.saved().campaign;assert.equal(s.operativeState[110].ammunitionChoice,'ammoShot');assert.equal(ammoCount(s.operativeState[110],'ammoMusket'),10);assert.equal(ammoCount(s.operativeState[110],'ammoShot'),3);assert.equal(s.operativeState[110].carriedLoaded,0);
});

test('mounted tactical inventory unloads and selects shot through the actual controls and registered reload',async t=>{
 const m=await mountCampaign(t,pair());await m.click('Equipo');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,true);await m.click('Descargar arma');await choose(m,'ammoShot');await act(async()=>m.issue({type:'reload',unitId:'110'}));await m.settle();const u=m.saved().battle.units.find(u=>u.id==='110');assert.equal(u.ammunitionChoice,'ammoShot');assert.equal(u.loaded,1);assert.equal(ammoCount(u,'ammoShot'),2);assert.equal(ammoCount(u,'ammoMusket'),10);assert.equal(weaponSpecification(u).loadPattern,'cone');assert.equal(m.document.querySelector('[aria-label="Carga para esta arma"]').disabled,true);
});

test('mounted inventory load changes apply authored concealment skill to a pistol shot and return to neutral ball fire',async t=>{
 // Prepared UI subsystem: this finite kit and terrain are declared before
 // the first tactical snapshot. No campaign acquisition or victory is claimed.
 const initial=createBattle([{id:'p',name:'Tiradora preparada',x:1,y:4,facing:2,weapon:1805,loaded:1,ammunition:{ammoPistol:2,ammoShot:2},abilities:['scatter_concealment'],marksmanship:55}],{
  width:12,height:9,seed:45,weather:{rain:0,wind:0},
  tiles:Array.from({length:108},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0,...(i%12===4&&Math.floor(i/12)===4?{concealment:60}:{})})),
  enemies:[{id:'e',x:4,y:4,weapon:1813,patrol:false,overwatch:false}],
 });
 let current=validateBattleSnapshot(JSON.parse(JSON.stringify(initial)));const history=[];
 const actor=()=>current.units[0],target=()=>current.units[1],rounds=unit=>unit.loaded+totalAmmo(unit);
 const props=()=>({battle:current,onChange:next=>{assert.equal(next.lastError,null,next.lastError);current=next;return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true,renderTree:tree=>h('div',null,nodes(tree).find(node=>node.type===JA2Strip),nodes(tree).find(node=>node.props?.['aria-label']==='Vista previa de la orden'))});
 const get=type=>nodes(mounted.tree()).find(node=>node.type===type),doc=document;
 async function action(order,dispatch){
  const before=structuredClone(current),expected=actBattle(before,order);assert.equal(expected.lastError,null,expected.lastError);assert.deepEqual(presentedActBattle(before,order).state,expected);
  await mounted.act(async()=>{dispatch();});await mounted.settle();await mounted.act(async()=>{});assert.deepEqual(current,expected,'the mounted callback commits the ordinary finite order');
  current=validateBattleSnapshot(JSON.parse(JSON.stringify(current)));assert.deepEqual(current,expected);history.push(order);await mounted.render(props());
 }
 const withoutSkill=()=>{const plain=structuredClone(current);delete plain.units[0].abilities;return plain;};
 const preview=()=>targetPreview(current,actor(),target(),{mode:'fire',aim:1});
 const chanceWithoutSkill=()=>{const plain=withoutSkill();return shotChance(plain,plain.units[0],plain.units[1],1);};
 await mounted.act(async()=>{get(JA2Strip).props.onOpenInventory('p');get(JA2Strip).props.onMode('fire');get(TacticalScene).props.onHover(target());get(JA2Strip).props.onSetAim(1);});
 assert.equal(weaponFor(actor()).loadPattern,'single');assert.equal(preview().chance,chanceWithoutSkill(),'the loaded pistol ball does not receive the specialty');
 assert.equal(doc.querySelector('[aria-label="Carga para esta arma"]').disabled,true);
 const unload=[...doc.querySelectorAll('button')].find(button=>button.textContent.startsWith('Descargar arma'));assert.ok(unload);assert.equal(unload.disabled,false);
 const loadedBefore=rounds(actor());await action({type:'unloadAmmunition',unitId:'p'},()=>unload.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
 assert.equal(rounds(actor()),loadedBefore);assert.equal(doc.querySelector('[aria-label="Carga para esta arma"]').disabled,false);
 const select=family=>{const control=doc.querySelector('[aria-label="Carga para esta arma"]');assert.equal(control.disabled,false);control.value=family;control.dispatchEvent(new window.Event('change',{bubbles:true}));};
 await action({type:'selectAmmunitionLoad',unitId:'p',family:'ammoShot'},()=>select('ammoShot'));
 const beforeReload=structuredClone(actor()),reloadCost=actionCosts(current,actor()).reload;
 await action({type:'reload',unitId:'p'},()=>get(JA2Strip).props.onOrder({type:'reload'}));
 assert.equal(actor().ap,beforeReload.ap-reloadCost);assert.equal(actor().loaded,1);assert.equal(ammoCount(actor(),'ammoShot'),1);assert.equal(rounds(actor()),loadedBefore);
 assert.equal(weaponFor(actor()).id,1805);assert.equal(weaponFor(actor()).loadPattern,'cone');assert.equal(weaponFor(actor()).damage,14);assert.equal(weaponFor(actor()).range,3);
 await mounted.act(async()=>get(JA2Strip).props.onSetAim(1));
 const forecast=preview();assert.equal(forecast.chance,shotChance(current,actor(),target(),1));assert.ok(forecast.chance>chanceWithoutSkill(),'the same observed concealment now gives a real pellet forecast benefit');
 assert.match(doc.querySelector('[aria-label="Vista previa de la orden"]').textContent,new RegExp(`${chancePercent(forecast.chance)} de al menos un perdigón`));
 assert.equal(doc.querySelector('[aria-label="Carga para esta arma"]').disabled,true);
 const beforeFire=structuredClone(actor()),fireCost=actionCosts(current,actor(),target()).fire+actionCosts(current,actor(),target()).aim;
 await action({type:'fire',unitId:'p',targetId:'e',aim:1,hitLocation:'torso'},()=>get(TacticalScene).props.onTile(target()));
 assert.equal(actor().ap,beforeFire.ap-fireCost);assert.equal(actor().condition,beforeFire.condition-1);assert.equal(actor().loaded,0);assert.equal(rounds(actor()),loadedBefore-1);assert.equal(ammoCount(actor(),'ammoShot'),1);
 await action({type:'selectAmmunitionLoad',unitId:'p',family:'ammoPistol'},()=>select('ammoPistol'));
 const beforeBall=structuredClone(actor()),ballCost=actionCosts(current,actor()).reload;
 await action({type:'reload',unitId:'p'},()=>get(JA2Strip).props.onOrder({type:'reload'}));
 assert.equal(actor().ap,beforeBall.ap-ballCost);assert.equal(actor().loaded,1);assert.equal(weaponFor(actor()).loadPattern,'single');assert.equal(rounds(actor()),loadedBefore-1);assert.equal(ammoCount(actor(),'ammoPistol'),2);
 await mounted.act(async()=>{get(TacticalScene).props.onHover(target());get(JA2Strip).props.onSetAim(1);});
 assert.equal(preview().chance,chanceWithoutSkill(),'returning to a loaded ball removes the benefit without changing authored ability');assert.doesNotMatch(doc.querySelector('[aria-label="Vista previa de la orden"]').textContent,/al menos un perdigón/);
 let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(initial)));for(const order of history)replay=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(replay,order))));assert.deepEqual(replay,current,'all finite load choices, reloads and the real shot survive tactical saved replay');
});

test('mounted alternative shot forecast states at least one pellet contact and keeps only bounded aggregate metadata',async t=>{
 const field=(weapon=1800,ammunitionChoice='ammoShot')=>{const b=createBattle([{id:'p',name:'Tirador',x:1,y:4,facing:2,weapon,ammunitionChoice,loaded:1,ammo:2}],{width:12,height:9,enemies:[{id:'e',x:6,y:4,patrol:false,overwatch:false}]});for(const tile of b.tiles){tile.type='grass';tile.blocked=false;tile.blocksSight=false;tile.cover=0;}return b;};
 const battle=field();
 const [player,target]=battle.units,before=structuredClone(battle),shot=firearmVolleyPreview(battle,player,target).shots[0],preview=targetPreview(battle,player,target,{mode:'fire'});
 assert.equal(weaponFor(player).loadPattern,'cone');assert.equal(shot.shotLoad,true);assert.equal(preview.chance,shotChance(battle,player,target));assert.equal(preview.chance,shot.chance);assert.equal(preview.expectedForce,shot.expectedForce);assert.equal(preview.damageFactor,shot.damageFactor);assert.equal(preview.pelletCount,shot.pelletCount);
 assert.ok(preview.chance>0&&preview.chance<=100);assert.ok(preview.expectedForce>0&&preview.expectedForce<=weaponFor(player).damage);assert.ok(preview.damageFactor>0&&preview.damageFactor<=1);assert.equal(Number.isInteger(preview.pelletCount),true);
 for(const key of ['pellets','bodyImpacts','scatter','forecast'])assert.equal(Object.hasOwn(preview,key),false,'internal paths do not enter the public target preview');
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:state=>state,onFinish(){}}),get=type=>nodes(mounted.tree()).find(node=>node.type===type);
 await mounted.act(async()=>{get(JA2Strip).props.onMode('fire');get(TacticalScene).props.onHover(target);});
 const html=renderToStaticMarkup(nodes(mounted.tree()).find(node=>node.props?.['aria-label']==='Vista previa de la orden'));
 assert.match(html,new RegExp(`${chancePercent(shot.chance)} de al menos un perdigón`));assert.match(html,/Carga de perdigones/);assert.match(html,/no garantiza varios impactos ni la zona del cuerpo/);assert.match(html,/consume una carga/);assert.doesNotMatch(html,/La bala puede atravesarlo|impacto con penetración/);
 assert.equal(mounted.jobs().filter(job=>job.job.kind==='action'||job.job.kind==='movement-step').length,0);assert.deepEqual(battle,before);
 for(const weapon of [1800,1807]){const ball=field(weapon,'ammoMusket'),ballPreview=targetPreview(ball,ball.units[0],ball.units[1],{mode:'fire'});assert.equal(Object.hasOwn(ballPreview,'shotLoad'),false);assert.equal(ballPreview.chanceLabel,undefined);assert.doesNotMatch(ballPreview.coverNote,/perdigones/);}
 const point=targetPreview(battle,player,{x:10,y:8},{mode:'fire'});assert.equal(point.chance,undefined);assert.equal(point.hitLocation,undefined);assert.match(point.coverNote,/Carga de perdigones.*Sin objetivo confirmado/);
});

test('paired mixed loads disclose the pellet probability for its own hand and preserve the other ball forecast',async t=>{
 const battle=createBattle([{id:'p',x:1,y:4,facing:2,weapon:1805,ammunitionChoice:'ammoShot',loaded:1,ammo:2,offHand:{weapon:1806,count:1,loaded:1,condition:100}}],{width:10,height:9,enemies:[{id:'e',x:3,y:4,patrol:false,overwatch:false}]});
 for(const tile of battle.tiles){tile.type='grass';tile.blocked=false;tile.blocksSight=false;tile.cover=0;}
 const [player,target]=battle.units,before=structuredClone(battle),volley=firearmVolleyPreview(battle,player,target);
 assert.equal(volley.paired,true);assert.equal(volley.shots[0].shotLoad,true);assert.equal(Boolean(volley.shots[1].shotLoad),false);
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:state=>state,onFinish(){}}),get=type=>nodes(mounted.tree()).find(node=>node.type===type);
 await mounted.act(async()=>{get(JA2Strip).props.onMode('fire');get(TacticalScene).props.onHover(target);});
 const html=renderToStaticMarkup(nodes(mounted.tree()).find(node=>node.props?.['aria-label']==='Vista previa de la orden'));
 assert.match(html,new RegExp(`${chancePercent(volley.shots[0].chance)} de al menos un perdigón \\(mano principal\\)`));assert.match(html,new RegExp(`Mano principal: ${chancePercent(volley.shots[0].chance)} de al menos un perdigón`));assert.match(html,new RegExp(`Segunda mano: ${chancePercent(volley.shots[1].chance)}`));assert.match(html,/Un disparo por pistola/);
 assert.equal(mounted.jobs().filter(job=>job.job.kind==='action'||job.job.kind==='movement-step').length,0);assert.deepEqual(battle,before);
});
