import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,contractQuote} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle,getReachable,lookPreview,environmentTargetAt,environmentUsePreview,environmentPreview,canSee} from '../game/tactical.js';
import {nearbyEnvironmentModel} from '../game/ja2-hud.js';
import {heldTool} from '../game/environment-interactions.js';
import {repairEquipmentQueue} from '../game/equipment-repair.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {wallEdgeCells} from '../game/wall-geometry.js';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalSceneControls}=await import('../web/app/TacticalSceneControls.tsx');

const actor=p=>p.battle.units.find(u=>u.id==='110');
const at=(s,p)=>p.axis?s.wallEdges.find(t=>t.id===(p.wallEdgeId??p.id)):s.tiles.find(t=>t.x===p.x&&t.y===p.y);
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const stamp=s=>s.hour*3600+(s.secondOfHour??0);
const saved=p=>decodeSave(encodeSave(p.campaign,p.battle));
const campaignOrder=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const chest=p=>p.battle.props.find(prop=>prop.id==='yatasto:building:chest:11:8');

// Declared subsystem scenario: the northern campaign has reached phase 2 and
// controls Tucuman. No route victory is asserted here. Every action after this
// admission uses the ordinary campaign/tactical reducers, finite starting kit,
// a real paid hire, and the unchanged authored Yatasto chest and geometry.
function preparedMission(){
 let campaign=initialCampaign(45);
 campaign.phase=2;campaign.flags.sanLorenzo=true;
 campaign.location='tucuman';campaign.squads[0].location='tucuman';
 campaign.sectors.tucuman.owner='patriot';
 campaign=decodeSave(encodeSave(campaign)).campaign;
 const scenario=structuredClone(campaign),quote=contractQuote(campaign,rosterFor(campaign).find(o=>o.id===110),'week');
 assert.ok(quote.available&&quote.price>0&&quote.price<=campaign.resources.treasury);
 campaign=campaignOrder(campaign,{type:'recruitCivic',id:110,term:'week',destination:'tucuman'});
 assert.equal(campaign.resources.treasury,scenario.resources.treasury-quote.price);
 const arrival=campaign.hiringArrivals.find(a=>a.operativeId===110);
 if(arrival)campaign=campaignOrder(campaign,{type:'wait',hours:arrival.travelHours});
 assert.ok(campaign.recruited.includes(110));
 assert.equal(campaign.contracts[110].paid,quote.price);
 const paid=campaign.resources.treasury;
 campaign=campaignOrder(campaign,{type:'visitMission',mission:'yatasto'});
 let pair=saved({campaign,battle:enterSector(campaign.pendingBattle)});
 assert.equal(pair.campaign.resources.treasury,paid);
 assert.equal(chest(pair).open,false);
 assert.equal(chest(pair).contents.filter(item=>item.toolKey==='crowbar').length,1);
 assert.equal(Object.values(actor(pair).inventory??{}).some(item=>item?.toolKey==='crowbar'),false);
 return {pair,scenario,quote};
}

function issue(pair,action,history){
 const before=structuredClone(pair),ordinary=actBattle(pair.battle,{unitId:'110',...action}),presented=presentedActBattle(pair.battle,{unitId:'110',...action});
 assert.equal(ordinary.lastError,null,`${action.type}: ${ordinary.lastError}`);
 assert.deepEqual(presented.state,ordinary,'presentation must preserve the paid reducer result');
 assert.deepEqual(pair,before,'orders must not mutate their submitted source');
 const result=syncBattleTime(pair.campaign,ordinary);assert.equal(result.error,null,result.error);
 const next={campaign:result.campaign,battle:result.battle};
 assert.equal(next.campaign.resources.treasury,pair.campaign.resources.treasury);
 history?.push({unitId:'110',...action});
 return next;
}

function approach(pair,target,history){
 const inReach=point=>target.axis?wallEdgeCells(target).some(cell=>cell.x===point.x&&cell.y===point.y):distance(point,target)<=1;
 for(let attempts=0;!inReach(actor(pair))&&attempts<20;attempts++){
  const spot=getReachable(pair.battle,actor(pair)).filter(p=>inReach(p)).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  assert.ok(spot,'the authored open doorway must permit a paid approach');
  const old={x:actor(pair).x,y:actor(pair).y};
  pair=issue(pair,{type:'move',x:spot.x,y:spot.y},history);
  assert.notDeepEqual({x:actor(pair).x,y:actor(pair).y},old);
 }
 assert.ok(inReach(actor(pair)));
 const lookTarget=target.axis?wallEdgeCells(target).find(cell=>cell.x!==actor(pair).x||cell.y!==actor(pair).y):target;
 if(lookPreview(pair.battle,actor(pair),lookTarget).valid)pair=issue(pair,{type:'look',x:lookTarget.x,y:lookTarget.y},history);
 return pair;
}

function acquiredCrowbar(){
 const {pair:initial,scenario,quote}=preparedMission(),history=[];
 let pair=approach(initial,chest(initial),history);
 const cacheId=chest(pair).id,contents=structuredClone(chest(pair).contents);
 pair=issue(pair,{type:'useItem',environment:{kind:'container',id:cacheId,verb:'open'}},history);
 const index=chest(pair).contents.findIndex(item=>item.toolKey==='crowbar');
 pair=issue(pair,{type:'containerLoot',kind:'container',id:cacheId,index,count:1},history);
 assert.deepEqual(chest(pair).contents,contents.filter(item=>item.toolKey!=='crowbar'));
 const [key,tool]=Object.entries(actor(pair).inventory).find(([,item])=>item?.toolKey==='crowbar');
 assert.equal(tool.count,1);assert.equal(tool.condition,100);
 pair=issue(pair,{type:'weapon',slot:'tool',toolKey:`inventory:${key}`},history);
 assert.equal(heldTool(actor(pair)).condition,100);
 pair=saved(pair);
 // The nearest usable original adobe wall beside the actual cache. Both sides
 // have ordinary floor/ground cells, so the resulting passage can be traversed.
 const wall=pair.battle.wallEdges.filter(t=>t.type==='wall'&&t.material==='adobe'&&t.buildingId==='yatasto:building')
  .filter(t=>wallEdgeCells(t).every(cell=>{const floor=at(pair.battle,cell);return floor&&!floor.blocked;}))
  .sort((a,b)=>distance(actor(pair),a)-distance(actor(pair),b)||a.y-b.y||a.x-b.x)[0];
 assert.ok(wall);pair=approach(pair,wall,history);
 assert.equal(canSee(pair.battle,actor(pair),wall),true);
 const ref=environmentTargetAt(pair.battle,wall);assert.equal(ref.kind,'wall');
 return {pair,initial,history,wall:{x:wall.x,y:wall.y,axis:wall.axis,id:wall.id,wallEdgeId:wall.id},ref,key,scenario,quote};
}

test('paid Yatasto hire acquires one real crowbar, opens and walks through an adobe breach, and retains depletion on save/return/reentry',t=>{
 const ready=acquiredCrowbar(),history=[...ready.history],before=ready.pair,carrier=actor(before),cash=before.campaign.resources.treasury,seed=before.battle.seed;
 const ammunition={loaded:carrier.loaded,ammo:carrier.ammo,stocks:structuredClone(carrier.ammunition)};
 const preview=environmentUsePreview(before.battle,carrier,ready.ref,'breach');
 assert.equal(preview.valid,true);assert.equal(preview.movePa,0);assert.equal(preview.actionPa,45);
 let pair=issue(before,{type:'useItem',environment:{...ready.ref,verb:'breach'}},history);
 const breached=at(pair.battle,ready.wall);
 const breachSeconds=pair.battle.elapsedSeconds-before.battle.elapsedSeconds;
 assert.equal(breached.type,'rubble');assert.equal(breached.blocked,false);assert.equal(breached.blocksSight,false);
 assert.equal(heldTool(actor(pair)).condition,97);assert.equal(actor(pair).inventory[ready.key].count,1);
 assert.deepEqual({loaded:actor(pair).loaded,ammo:actor(pair).ammo,stocks:actor(pair).ammunition},ammunition);
 assert.equal(pair.battle.seed,seed);assert.equal(pair.campaign.resources.treasury,cash);
 assert.equal(pair.battle.elapsedSeconds-before.battle.elapsedSeconds,3,'45-AP manual work pays its ordinary three exploration seconds');
 assert.equal(actor(pair).ap,carrier.ap,'exploration charges time instead of reducing turn AP');
 assert.equal(stamp(pair.campaign)-stamp(before.campaign),pair.battle.elapsedSeconds-before.battle.elapsedSeconds);
 const spent=pair.battle.elapsedSeconds;
 assert.equal(environmentPreview(pair.battle,actor(pair),ready.ref,'breach').valid,false);
 const repeated=actBattle(pair.battle,{type:'useItem',unitId:'110',environment:{...ready.ref,verb:'breach'}});
 assert.ok(repeated.lastError);for(const key of ['units','tiles','wallEdges','props','seed','elapsedSeconds'])assert.deepEqual(repeated[key],pair.battle[key]);
 const crossed=wallEdgeCells(breached).find(cell=>cell.x!==actor(pair).x||cell.y!==actor(pair).y);
 pair=saved(pair);pair=issue(pair,{type:'move',...crossed},history);
 assert.deepEqual({x:actor(pair).x,y:actor(pair).y},{x:crossed.x,y:crossed.y},'the opened edge must permit crossing to its other incident floor');
 assert.ok(pair.battle.elapsedSeconds>spent);assert.equal(heldTool(actor(pair)).condition,97);
 let replay=ready.initial;for(const action of history)replay=issue(replay,action);
 assert.deepEqual(saved(replay),saved(pair),'the complete finite acquisition and breach must replay through the official save boundary');
 pair=saved(pair);
 let campaign=campaignOrder(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.operativeState[110].inventory[ready.key].condition,97);
 const repair=repairEquipmentQueue(campaign.operativeState[110],rosterFor(campaign).find(o=>o.id===110)).find(item=>item.key===`inventory:${ready.key}`);
 assert.deepEqual(repair,{key:`inventory:${ready.key}`,label:'Barreta',condition:97,count:1,jammed:false},'the owned worn tool must enter the existing finite-material repair queue');
 campaign=decodeSave(encodeSave(campaign)).campaign;
 const scene=campaign.sceneStates.yatasto;
 assert.equal(at(scene,ready.wall).type,'rubble');assert.equal(scene.props.find(prop=>prop.id===chest(pair).id).contents.some(item=>item.toolKey==='crowbar'),false);
 campaign=campaignOrder(campaign,{type:'visitMission',mission:'yatasto'});
 const returned=saved({campaign,battle:enterSector(campaign.pendingBattle,scene)});
 assert.equal(at(returned.battle,ready.wall).blocked,false);assert.equal(at(returned.battle,ready.wall).type,'rubble');
 assert.equal(heldTool(actor(returned)).condition,97);
 assert.equal(Object.values(actor(returned).inventory).filter(item=>item?.toolKey==='crowbar').reduce((n,item)=>n+item.count,0),1);
 assert.equal(chest(returned).contents.some(item=>item.toolKey==='crowbar'),false);assert.equal(returned.campaign.resources.treasury,cash);
 const remainingTools=chest(returned).contents.filter(item=>item.itemType==='tool'||item.kind==='tool').reduce((n,item)=>n+item.count,0);
 const initialTools=chest(ready.initial).contents.filter(item=>item.itemType==='tool'||item.kind==='tool').reduce((n,item)=>n+item.count,0);
 const returnedTool=actor(returned).inventory[ready.key];
 t.diagnostic(`Actual paid hire: ${ready.quote.price} pesos; treasury ${returned.campaign.resources.treasury}; acquisition/breach/passage ${history.length} ordinary orders; scenario action time ${pair.battle.elapsedSeconds-ready.initial.battle.elapsedSeconds} seconds; breach work ${breachSeconds} seconds; crowbar ${heldTool(carrier).condition}→${returnedTool.condition}, count ${returnedTool.count}; cartridges ${actor(returned).loaded} loaded + ${actor(returned).ammo} reserve; chest ${initialTools}→${remainingTools} tools; returned wall ${at(returned.battle,ready.wall).type}, tool condition ${returnedTool.condition}.`);
});

test('mounted ordinary wall input commits the acquired tool breach once with matching public HUD cost',async t=>{
 const ready=acquiredCrowbar(),state=ready.pair.battle,original=structuredClone(state),commits=[];
 const model=nearbyEnvironmentModel(state,actor(ready.pair),{targetKey:`wall:${ready.ref.id}`,verb:'breach'});
 assert.equal(model.target.kind,'wall');assert.equal(model.preview.valid,true);assert.equal(model.preview.pa,45);
 const expected=actBattle(state,{type:'useItem',unitId:'110',environment:{kind:'wall',id:ready.ref.id}});
 assert.equal(expected.lastError,null);
 const mounted=await mountBattlefield(t,Battlefield,{battle:state,onChange:next=>{commits.push(next);return next;},onFinish(){},peacefulVisit:true},{virtualTimers:true});
 const scene=()=>nodes(mounted.tree()).find(node=>node.type===TacticalSceneControls);
 await mounted.act(async()=>scene().props.onTile(ready.wall));
 assert.deepEqual(commits,[expected]);assert.deepEqual(state,original);
 assert.equal(heldTool(commits[0].units.find(u=>u.id==='110')).condition,97);
 await mounted.render({battle:commits[0],onChange:next=>{commits.push(next);return next;},onFinish(){},peacefulVisit:true});
 const openedModel=nearbyEnvironmentModel(commits[0],commits[0].units.find(u=>u.id==='110'));
 assert.equal(openedModel.targets.some(target=>target.id===ready.ref.id),false,'the same rubble must no longer offer a second wall breach');
});
