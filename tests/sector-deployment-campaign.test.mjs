import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {initialCampaign as establishedCampaign} from './legacy-campaign-fixture.mjs';
import {prepareCampaignBattle,battleFromRequest} from '../game/battle-handoff.js';
import {sectorDeploymentModel} from '../game/sector-deployment.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {boundaryMatches} from '../game/tactical-exits.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const act=(s,a)=>{const n=actBattle(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const officer=()=>order(initialCampaign(8),{type:'createOfficer',name:'Vigía de Retiro',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
const attack=()=>order(officer(),{type:'attack',sector:'buenos_aires'});
const prepare=c=>{const p=prepareCampaignBattle(c,{placement:true});assert.equal(p.error,null,p.error);return p;};
const saved=p=>decodeSave(encodeSave(p.campaign,p.battle));

test('a fresh Retiro-only assault saves before placement, retains a chosen cell and starts the actual encounter once',()=>{
 const campaign=attack(),before=structuredClone(campaign);let p=prepare(campaign);
 assert.ok(p.battle.deployment);assert.equal(p.battle.elapsedSeconds,0);assert.equal(p.campaign.hour,campaign.hour);assert.deepEqual(p.campaign.resources,campaign.resources);assert.deepEqual(campaign,before);
 p=saved(p);const model=sectorDeploymentModel(p.battle),u=model.units[0],cell=model.entryCells[u.edge].at(-3);
 assert.equal(u.edge,'N');assert.equal(u.position,null);const started=p.battle.units[0],costs={ap:started.ap,ammo:started.ammo,loaded:started.loaded,energy:started.energy};
 p.battle=act(p.battle,{type:'placeDeployment',unitIds:[u.id],...cell});p=saved(p);assert.deepEqual(p.battle.deployment.placements[u.id],cell);
 p.battle=act(p.battle,{type:'confirmDeployment'});assert.equal(p.battle.deployment,undefined);assert.equal(p.battle.deploymentComplete,true);assert.ok(boundaryMatches(p.battle,p.battle.units[0],u.edge));
 assert.deepEqual({x:p.battle.units[0].x,y:p.battle.units[0].y},cell);for(const [key,value]of Object.entries(costs))assert.equal(p.battle.units[0][key],value);
 let pair=syncBattleTime(p.campaign,p.battle);assert.equal(pair.error,null);p=saved(pair);assert.equal(p.battle.deploymentComplete,true);assert.equal(p.battle.mode,'exploration');
 const step=getReachable(p.battle,p.battle.units[0]).find(q=>q.path.length===1);assert.ok(step);p.battle=act(p.battle,{type:'move',unitId:u.id,x:step.x,y:step.y});assert.ok(p.battle.elapsedSeconds>0);assert.equal(p.battle.units[0].ap,costs.ap);
 pair=syncBattleTime(p.campaign,p.battle);assert.equal(pair.error,null);saved(pair);
});

test('peaceful visits, resident defenders and exact resumed battles bypass a new placement screen',()=>{
 const c=order(officer(),{type:'visitSector'}),plain=prepareCampaignBattle(c),interactive=prepare(c);assert.equal(interactive.battle.deployment,undefined);assert.deepEqual(interactive,plain);
 const assault=attack(),request=structuredClone(assault.pendingBattle);for(const u of request.squad){u.entryReason='resident';delete u.entryEdge;delete u.entryAnchor;}
 const residents=enterSector(request,null,{placement:true});assert.equal(residents.deployment,undefined);
 const source=battleFromRequest(assault.pendingBattle,assault);const resumed=battleFromRequest({...assault.pendingBattle,resumeSnapshot:source},assault,{placement:true});assert.deepEqual(resumed,source);
});

test('saved placement is bound to the actual campaign unit, source edge and squad manifest',()=>{
 const p=prepare(attack());
 for(const alter of [raw=>{raw.battle.units[0].entryEdge='S';raw.battle.units[0].entryAnchor={x:8,y:15};raw.battle.deployment.units[0].edge='S';},raw=>raw.battle.deployment.units[0].squadId='fake',raw=>raw.battle.deployment.units[0].squadName='Otra fuerza',raw=>raw.campaign.pendingBattle.exploration=true,raw=>raw.battle.deployment.units[0].id=raw.battle.units.find(u=>u.side==='enemy').id]){
  const raw=JSON.parse(encodeSave(p.campaign,p.battle));alter(raw);assert.throws(()=>decodeSave(JSON.stringify(raw)));
 }
 const raw=JSON.parse(encodeSave(p.campaign,p.battle));raw.battle=null;assert.throws(()=>decodeSave(JSON.stringify(raw)),/no coincide/);
});

test('two real queued squads keep their separate approach edges through group placement and full saves',()=>{
 let c=establishedCampaign(8);const ids=[3,4,10,100,101,102,103,104,105,106,107,108];c.recruited=ids;c.contracts=Object.fromEntries(ids.map(id=>[id,{kind:'legacy',term:'month',started:0,expiresAt:null,paid:0}]));
 c.squads=[{id:'squad-1',name:'Columna sur',location:'buenos_aires',members:ids.slice(0,6)},{id:'squad-2',name:'Columna oeste',location:'cordoba',members:ids.slice(6)}];c.squad=ids.slice(0,6);c.location='buenos_aires';c.sectors.cordoba.owner='patriot';for(const q of c.squads)for(const id of q.members)c.operativeState[id].location=q.location;
 c=order(c,{type:'selectSquad',id:'squad-1'});c=order(c,{type:'attack',sector:'san_nicolas',queue:true});c=order(c,{type:'selectSquad',id:'squad-2'});c=order(c,{type:'attack',sector:'san_nicolas',queue:true});c=order(c,{type:'wait',hours:24});c=order(c,{type:'beginAssault',sector:'san_nicolas'});
 let p=prepare(c),model=sectorDeploymentModel(p.battle);assert.equal(model.units.length,12);assert.equal(new Set(model.units.map(u=>u.squadId)).size,2);assert.deepEqual([...new Set(model.units.map(u=>u.squadName))],['Columna sur','Columna oeste']);
 const old=JSON.parse(encodeSave(p.campaign,p.battle));for(const group of old.campaign.pendingBattle.assaultSquads)delete group.name;const migrated=decodeSave(JSON.stringify(old));assert.deepEqual(migrated.campaign.pendingBattle.assaultSquads.map(q=>q.name),['Columna sur','Columna oeste']);
 const bad=JSON.parse(encodeSave(p.campaign,p.battle));bad.campaign.pendingBattle.assaultSquads[0].name='Otra escuadra';assert.throws(()=>decodeSave(JSON.stringify(bad)),/nombre de la escuadra/);
 for(const group of c.pendingBattle.assaultSquads){const rows=model.units.filter(u=>u.squadId===group.id),edge=rows[0].edge;assert.equal(rows.length,6);const cell=model.entryCells[edge][5];p.battle=act(p.battle,{type:'placeDeployment',unitIds:rows.map(u=>u.id),...cell});}
 p=saved(p);const placed=structuredClone(p.battle.deployment);p.battle=act(p.battle,{type:'confirmDeployment'});p=syncBattleTime(p.campaign,p.battle);assert.equal(p.error,null);p=saved(p);
 for(const row of placed.units)assert.ok(boundaryMatches(p.battle,p.battle.units.find(u=>u.id===row.id),row.edge));assert.deepEqual(p.campaign.squads.map(q=>q.members),c.squads.map(q=>q.members));
 assert.equal(new Set(p.battle.units.filter(u=>u.side==='player').map(u=>`${u.x},${u.y}`)).size,12);
});

test('confirming a selected arrival resolves enemy-only initiative and publishes a loadable synchronized clock',()=>{
 const c=order(order(officer(),{type:'wait',hours:12}),{type:'attack',sector:'buenos_aires'}),r=c.pendingBattle,width=32,height=16;
 const source=createBattle(r.squad,{id:r.id,sector:r.sector,width,height,hour:r.hour,secondOfHour:r.secondOfHour,exploration:true,deferContact:true,
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),
  enemies:r.enemies.map((u,i)=>({...u,x:i?28:5,y:i?9+i:0,traits:['night_vision'],facing:2,loaded:0,ammo:0,patrol:false,overwatch:false}))});
 source.savedHour=c.hour;source.savedSecond=c.secondOfHour;c.sectorStates[r.sector]=source;
 let p=prepare(c);const id=p.battle.deployment.units[0].id;p.battle=act(p.battle,{type:'placeDeployment',unitIds:[id],x:12,y:0});
 assert.equal(p.battle.elapsedSeconds,0);assert.equal(p.battle.contactThisRound,false);p=saved(p);
 p.battle=act(p.battle,{type:'confirmDeployment'});assert.equal(p.battle.roundFirstSide,'enemy');assert.equal(p.battle.elapsedSeconds,6);
 const pair=syncBattleTime(p.campaign,p.battle);assert.equal(pair.error,null);assert.equal(pair.battle.syncedSeconds,6);assert.equal(pair.campaign.pendingBattle.syncedSeconds,6);
 const restored=saved(pair);assert.deepEqual(restored.battle,pair.battle);assert.equal(prepareCampaignBattle({...restored.campaign,pendingBattle:{...restored.campaign.pendingBattle,resumeSnapshot:restored.battle}},{placement:true}).battle.deployment,undefined);
});
