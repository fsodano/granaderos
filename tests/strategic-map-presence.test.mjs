import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,CAMPAIGN_SECTORS} from '../game/campaign.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {refreshEnemyIntelligence} from '../game/enemy-intelligence.js';
import {strategicSectorPresence,strategicTravelPresence} from '../game/strategic-presence.js';
import {worldCell,WORLD_CELLS} from '../game/world-cells.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
const {default:StrategicMap}=await import('../web/app/StrategicMap.tsx');
const noop=()=>{};
function map(t,state,props={}){const dom=new JSDOM(render(h(StrategicMap,{state,selected:state.location,onSelect:noop,dispatch:noop,...props})));t.after(()=>dom.window.close());return dom.window.document;}
const row=(s,sector,battle)=>strategicSectorPresence(s,battle).find(r=>r.sector===sector);
const dots=(doc,sector,side)=>doc.querySelectorAll(`[data-sector-presence="${sector}"] [data-presence-dot="${side}"]`);

test('sector dots count physical own actors across squads and place local militia at one anchor',t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'createSquad',name:'Segunda escuadra',ids:[4]});assert.equal(s.lastError,null);
 s.sectors.buenos_aires.militia=[3,2,1];const before=structuredClone(s),doc=map(t,s);
 assert.deepEqual(row(s,'retiro').players.sort((a,b)=>a-b),[3,4,10]);assert.equal(dots(doc,'retiro','player').length,3);
 assert.equal(dots(doc,'buenos_aires','militia').length,6);assert.equal(doc.querySelectorAll('[data-presence-dot="militia"]').length,6);
 assert.equal(doc.querySelectorAll('.atlas-squad-marker').length,0);assert.equal(doc.querySelectorAll('[data-map-cell]').length,WORLD_CELLS.length);
 for(const sector of CAMPAIGN_SECTORS)assert.ok(doc.querySelector(`[data-map-sector="${sector.id}"]`),sector.id);
 assert.match(doc.querySelector('[data-map-sector="buenos_aires"]').getAttribute('aria-label'),/6 milicianos/);
 assert.deepEqual(s,before);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});

test('dead, captured, departed and no-longer-serving records cannot add own dots',()=>{
 const base=initialCampaign();
 for(const patch of [{alive:false,hp:0},{captured:true},{departure:{destination:'buenos_aires'}},{fled:true}]){
  const s=structuredClone(base);Object.assign(s.operativeState[3],patch);assert.deepEqual(row(s,'retiro').players,[4,10]);
 }
 const released=structuredClone(base);released.recruited=released.recruited.filter(id=>id!==3);assert.deepEqual(row(released,'retiro').players,[4,10]);
 const reserve=structuredClone(base);reserve.squad=[3,10];reserve.squads[0].members=[3,10];reserve.operativeState[4].location='cell-26-27';
 assert.deepEqual(row(reserve,'retiro').players,[3,10]);assert.deepEqual(row(reserve,'cell-26-27').players,[4]);
});

test('live own tactical casualties and exits update dots before strategic settlement without exposing enemies',t=>{
 const s=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(s.lastError,null);
 const battle=enterSector(s.pendingBattle),own=battle.units.filter(u=>u.side==='player'&&!u.militia);
 own[0].hp=0;own[1].departure={destination:'buenos_aires'};
 battle.units.push({id:'private-enemy',side:'enemy',hp:100,name:'PRIVATE ENEMY'});
 const before=structuredClone({s,battle}),doc=map(t,s,{battle});assert.equal(dots(doc,'retiro','player').length,1);
 assert.equal(dots(doc,'retiro','enemy').length,0);assert.ok(!doc.body.textContent.includes('PRIVATE ENEMY'));
 const unrelated={...battle,battleId:'another-battle'};assert.equal(row(s,'retiro',unrelated).players.length,3);
 assert.deepEqual({s,battle},before);
});

test('live militia dots remove casualties and exits while retaining the actual local reserve',t=>{
 const base=initialCampaign();base.sectors.retiro.militia=[65,0,0];
 const s=dispatchCampaign(base,{type:'visitSector'});assert.equal(s.lastError,null);assert.equal(s.pendingBattle.garrison.length,60);
 const battle=enterSector(s.pendingBattle),militia=battle.units.filter(u=>u.side==='player'&&u.militia);assert.equal(militia.length,60);
 militia[0].hp=0;militia[1].departure={destination:'buenos_aires'};
 const before=structuredClone({s,battle}),doc=map(t,s,{battle});
 assert.equal(dots(doc,'retiro','militia').length,63,'58 living local deployed actors and five undeployed reserves');
 assert.equal(doc.querySelectorAll('[data-presence-dot="militia"]').length,63);assert.deepEqual({s,battle},before);
});

test('live San Lorenzo actors use the actual San Nicolas map cell without deploying its local militia',t=>{
 let s=initialCampaign();s.phase=1;s.flags.academy=true;s.sectors.san_nicolas.owner='patriot';s.sectors.san_nicolas.militia=[5,0,0];
 s=dispatchCampaign(s,{type:'travel',sector:'san_nicolas'});assert.equal(s.lastError,null);
 s=dispatchCampaign(s,{type:'attack',sector:'san_lorenzo'});assert.equal(s.lastError,null);assert.equal(s.pendingBattle.garrison.length,0);
 const battle=enterSector(s.pendingBattle),own=battle.units.filter(u=>u.side==='player'&&!u.militia);assert.equal(own.length,4,'three serving actors and the actual mission commander');
 const doc=map(t,s,{battle});assert.equal(dots(doc,'san_nicolas','player').length,4);assert.equal(dots(doc,'san_nicolas','militia').length,5);
 own[0].hp=0;own[1].departure={destination:'buenos_aires'};
 const before=structuredClone({s,battle}),updated=map(t,s,{battle});assert.equal(dots(updated,'san_nicolas','player').length,2);assert.equal(dots(updated,'san_nicolas','militia').length,5);
 assert.equal(updated.querySelectorAll('[data-presence-dot="player"]').length,2);assert.deepEqual({s,battle},before);
});

test('existing militia in promotion retain dots beside a casualty-adjusted deployment without counting new recruits',t=>{
 const base=initialCampaign();base.sectors.retiro.militia=[6,0,0];
 let s=dispatchCampaign(base,{type:'militia',sector:'retiro',rank:1,trainerId:3});assert.equal(s.lastError,null);
 s.militiaTraining[0].trainees[0].hp=20;assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);
 assert.equal(dots(map(t,s),'retiro','militia').length,6);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
 s=dispatchCampaign(s,{type:'createSquad',name:'Patrulla local',ids:[4,10]});assert.equal(s.lastError,null);
 s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);assert.equal(s.pendingBattle.garrison.length,3);
 const issued=new Set(s.pendingBattle.garrison.map(u=>String(u.id)));assert.ok(s.militiaTraining[0].trainees.every(u=>!issued.has(String(u.id))));
 const battle=enterSector(s.pendingBattle),militia=battle.units.filter(u=>u.side==='player'&&u.militia);militia[0].hp=0;
 const before=structuredClone({s,battle});assert.equal(dots(map(t,s,{battle}),'retiro','militia').length,5,'three existing trainees and two living deployed soldiers');assert.deepEqual({s,battle},before);
 const novice=dispatchCampaign(initialCampaign(),{type:'militia',sector:'retiro',rank:0,trainerId:3});assert.equal(novice.lastError,null);
 assert.equal(novice.militiaTraining[0].trainees,undefined);assert.equal(dots(map(t,novice),'retiro','militia').length,0);
 const legacy=structuredClone(s);legacy.pendingBattle=null;delete legacy.militiaTraining[0].trainees;assert.equal(row(legacy,'retiro').militia,6,'saved count-only promotion cohorts remain physically present');
});

test('only current admitted intelligence produces enemy count dots; unknown strength gets a question mark',t=>{
 const s=initialCampaign(),g=launchEnemyGroup(s,'coast','retiro',{immediate:true}),before=structuredClone(s),doc=map(t,s);
 assert.equal(dots(doc,'retiro','enemy').length,g.units.length);assert.match(doc.querySelector('[data-map-sector="retiro"]').getAttribute('aria-label'),new RegExp(`${g.units.length} realistas observados`));
 assert.equal(doc.querySelector('[data-sector-presence="retiro"] [data-enemy-unknown]'),null);assert.deepEqual(s,before);
 g.status='stationed';g.resolvedAt=0;const occupied=map(t,s);assert.equal(dots(occupied,'retiro','enemy').length,0);assert.ok(occupied.querySelector('[data-sector-presence="retiro"] [data-enemy-unknown]'));
 assert.ok(occupied.querySelector('[data-sector-presence="jujuy"] [data-enemy-unknown]'),'public royalist control does not reveal garrison size');
});

test('unseen groups and hidden tactical snapshots cannot alter strategic markers',t=>{
 const s=initialCampaign();launchEnemyGroup(s,'north','jujuy',{immediate:true});const a=map(t,s).querySelector('.argentina-atlas').outerHTML;
 s.enemyGroups[0].units.push({...s.enemyGroups[0].units[0],id:'PRIVATE',name:'PRIVATE'});s.enemyGroups[0].units[0].hp=0;
 s.sectorStates.jujuy={units:[{id:'PRIVATE',side:'enemy',hp:100}]};const b=map(t,s).querySelector('.argentina-atlas').outerHTML;
 assert.equal(b,a);assert.equal(row(s,'jujuy').enemies,0);assert.equal(row(s,'jujuy').unknownEnemy,true);
});

test('old reports show uncertainty and expire without following unseen casualties or movement',t=>{
 const s=initialCampaign(),g=launchEnemyGroup(s,'coast','retiro',{immediate:true});refreshEnemyIntelligence(s);
 for(const id of s.recruited)s.operativeState[id].asleep=true;s.hour=1;
 const before=structuredClone(s),doc=map(t,s);assert.equal(dots(doc,'retiro','enemy').length,0);
 assert.ok(doc.querySelector('[data-sector-presence="retiro"][data-enemy-stale="true"] [data-enemy-unknown]'));assert.match(doc.querySelector('[data-map-sector="retiro"]').getAttribute('aria-label'),/Último parte hace 1 h; presencia actual sin confirmar/);
 g.units[0].hp=0;assert.equal(row(s,'retiro').enemies,0);assert.equal(row(s,'retiro').unknownEnemy,true);g.units[0].hp=before.enemyGroups[0].units[0].hp;assert.deepEqual(s,before);
 s.hour=73;assert.equal(row(s,'retiro').unknownEnemy,false);
});

test('moving troops have one dot each on their known route and no stationary duplicate or numbered pin',t=>{
 let s=dispatchCampaign(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});s=dispatchCampaign(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(s.lastError,null);
 const before=structuredClone(s),doc=map(t,s,{onSquad:noop}),travel=doc.querySelector('[data-travel-presence="squad-1"]');
 assert.ok(travel);assert.equal(travel.querySelectorAll('[data-presence-dot="player"]').length,3);assert.equal(dots(doc,'retiro','player').length,0);
 assert.equal(travel.querySelectorAll('text').length,0);assert.match(travel.getAttribute('aria-label'),/3 combatientes en marcha/);assert.ok(doc.querySelector('[data-squad-route]'));
 assert.equal(strategicTravelPresence(s,s.squads[0]).length,3);assert.deepEqual(s,before);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});

test('selected cells remain discoverable without a permanent readout or an unrequested travel route',t=>{
 const s=initialCampaign(),selected='cell-26-27',doc=map(t,s,{selected}),cell=doc.querySelector(`[data-map-cell="${selected}"]`);
 assert.equal(doc.querySelector('.atlas-readout'),null);assert.equal(doc.querySelector('[data-cell-route]'),null);assert.equal(doc.querySelector('[data-route-preview]'),null);
 assert.equal(cell.getAttribute('aria-pressed'),'true');assert.ok(cell.querySelector('title').textContent.includes(worldCell(selected).name));
 const plot=map(t,s,{selected,plotting:true,previewPath:['retiro',selected]});assert.ok(plot.querySelector('[data-route-preview]'));assert.equal(plot.querySelector('.atlas-readout'),null);
});
