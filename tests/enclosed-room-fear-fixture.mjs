import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,endTurn,presentedActBattle,presentedEndTurn,getReachable,lookPreview,containerLootPreview} from '../game/tactical.js';
import {placeBuilding} from '../game/buildings.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {ROADSIDE_DISCOVERY_CHEST,ROADSIDE_CROWBAR_ID} from '../game/roadside-discoveries.js';

export const ROOM_ACTOR=126;
export const roomActor=pair=>pair.battle.units.find(unit=>unit.id===String(ROOM_ACTOR));
export const roomSaved=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
export const roomStamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
export const roomCrowbar=unit=>Object.entries(unit.inventory??{}).find(([,record])=>record.instanceId===ROADSIDE_CROWBAR_ID);

export function roomCampaignOrder(campaign,action){
 const next=dispatchCampaign(campaign,action);assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);return next;
}
export function roomStep(pair,event,history){
 const original=structuredClone(pair);let next;
 if(event.kind==='campaign'){
  const campaign=roomCampaignOrder(pair.campaign,event.action);
  next={campaign,...(campaign.pendingBattle?{battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector])}:{})};
 }
 else if(event.kind==='visit'){
  const campaign=roomCampaignOrder(pair.campaign,{type:'visitSector'});
  next={campaign,battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.location])};
 }else if(event.kind==='enter')next={campaign:pair.campaign,battle:enterSector(pair.campaign.pendingBattle,pair.campaign.sectorStates[pair.campaign.pendingBattle.sector])};
 else if(event.kind==='leave'||event.kind==='settle'){
  const battle=pair.battle;
  next={campaign:roomCampaignOrder(pair.campaign,{type:event.kind==='leave'?'leaveSector':'battleResult',battleId:pair.campaign.pendingBattle.id,
   ...(event.kind==='settle'?{outcome:battle.status}:{}),sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')})};
 }else{
  const turn=event.kind==='turn',battle=turn?endTurn(pair.battle):actBattle(pair.battle,event.action),presented=turn?presentedEndTurn(pair.battle):presentedActBattle(pair.battle,event.action);
  assert.equal(battle.lastError,null,`${JSON.stringify(event)}: ${battle.lastError}`);
  assert.deepEqual(presented.state,battle,'presentation preserves the complete authoritative result');
  const synced=syncBattleTime(pair.campaign,battle);assert.equal(synced.error,null,synced.error);next=synced;
 }
 assert.deepEqual(pair,original,'ordinary orders preserve their submitted source');
 history?.push(structuredClone(event));return roomSaved(next);
}
export const roomAction=(pair,action,history)=>roomStep(pair,{kind:'action',action:{unitId:String(ROOM_ACTOR),...action}},history);
export function roomReplay(start,history){let pair=roomSaved(start);for(const event of history)pair=roomStep(pair,event);return pair;}

// Real stock hire, delayed arrival, marches and discovery. Only the later
// combat arena is prepared; this acquisition has no assigned gear or outcomes.
export function paidRoomArrival({oldPinned=false,crowbar=true}={}){
 const content=defaultContentPackage();
 if(oldPinned){const godoy=content.characters.find(person=>person.id==='person-126');godoy.abilities=godoy.abilities.filter(id=>id!=='enclosed_room_fear');}
 const start=roomSaved({campaign:initialCampaign(42,content)}),history=[];
 const quote=contractQuote(start.campaign,rosterFor(start.campaign).find(person=>person.id===ROOM_ACTOR),'week');
 let pair=roomStep(start,{kind:'campaign',action:{type:'recruitCivic',id:ROOM_ACTOR,term:'week'}},history);
 assert.equal(pair.campaign.recruited.includes(ROOM_ACTOR),false);
 pair=roomStep(pair,{kind:'campaign',action:{type:'wait',hours:6}},history);
 assert.ok(pair.campaign.recruited.includes(ROOM_ACTOR));assert.equal(pair.campaign.resources.treasury,3200-quote.price);
 assert.equal(pair.campaign.contracts[ROOM_ACTOR].started,6);
 if(crowbar){
  pair=roomStep(pair,{kind:'campaign',action:{type:'travel',sector:'cell-24-27'}},history);
  pair=roomStep(pair,{kind:'visit'},history);
  const chest=()=>pair.battle.props.find(prop=>prop.id===ROADSIDE_DISCOVERY_CHEST);
  for(let attempt=0;Math.abs(roomActor(pair).x-chest().x)+Math.abs(roomActor(pair).y-chest().y)>1&&attempt<8;attempt++){
   const point=getReachable(pair.battle,roomActor(pair)).filter(point=>Math.abs(point.x-chest().x)+Math.abs(point.y-chest().y)===1).sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
   assert.ok(point,'the actual roadside chest has a reachable adjacent cell');
   pair=roomAction(pair,{type:'move',x:point.x,y:point.y},history);
  }
  if(lookPreview(pair.battle,roomActor(pair),chest()).valid)pair=roomAction(pair,{type:'look',x:chest().x,y:chest().y},history);
  pair=roomAction(pair,{type:'useItem',environment:{kind:'container',id:chest().id,verb:'open'}},history);
  const index=chest().contents.findIndex(stack=>stack.instanceId===ROADSIDE_CROWBAR_ID);assert.ok(index>=0);
  pair=roomAction(pair,containerLootPreview(pair.battle,roomActor(pair),{id:chest().id},index,1).action,history);
  assert.equal(roomCrowbar(roomActor(pair))[1].condition,60);
  assert.equal(chest().contents.some(stack=>stack.instanceId===ROADSIDE_CROWBAR_ID),false);
  pair=roomStep(pair,{kind:'leave'},history);
  pair=roomStep(pair,{kind:'campaign',action:{type:'travel',sector:'retiro'}},history);
  if(pair.campaign.operativeState[ROOM_ACTOR].fatigue>0){
   pair=roomStep(pair,{kind:'campaign',action:{type:'setSleep',operativeId:ROOM_ACTOR,asleep:true}},history);
   for(let hour=0;pair.campaign.operativeState[ROOM_ACTOR].asleep&&hour<16;hour++)pair=roomStep(pair,{kind:'campaign',action:{type:'wait',hours:1}},history);
   assert.equal(pair.campaign.operativeState[ROOM_ACTOR].asleep,false);
  }
 }
 assert.deepEqual(roomReplay(start,history),pair,'native paid arrival and finite acquisition replay through official saves');
 return {start,pair,history,quote,oldPinned};
}

export function preparedRoomArena(options={}){
 const paid=paidRoomArrival(options),campaign=roomCampaignOrder(paid.pair.campaign,{type:'attack',sector:'buenos_aires'}),request=campaign.pendingBattle,width=28,height=18;
 const ground=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 const built=placeBuilding(ground,{id:'fear-room',x:4,y:4,width:6,height:6,roof:'tile',doors:[{id:'fear-door',x:6,y:4}],windows:[{x:9,y:6}]});
 // Declared initial geometry. A full-height screen separates the unchanged
 // native hostile force. No victory, injury or fresh campaign conquest is
 // prepared. Both content controls share seed42, native health and finite kit.
 const hidden=placeBuilding(built.tiles,{id:'undisclosed-room',x:19,y:3,width:5,height:5,roof:'tile',doors:[{id:'undisclosed-door',x:21,y:7}]});
 const tiles=hidden.tiles;
 const wallEdges=[...built.wallEdges,...hidden.wallEdges,...Array.from({length:height},(_,y)=>({id:`screen:${y}`,x:17,y,axis:'y',type:'wall',material:'stone',blocked:true,blocksSight:true,cover:100}))];
 const buildings=[built.building,hidden.building],upperSurfaces=[],climbLinks=[];
 if(options.upper){
  const upperRoom={id:'fear-upper-room',tacticalLevel:1,cells:built.building.rooms[0].cells.map(cell=>({...cell,tacticalLevel:1}))};
  built.building.rooms.push(upperRoom);
  for(let y=4;y<10;y++)for(let x=4;x<10;x++){
   const edge=false;
   upperSurfaces.push({id:`fear-floor:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,slabThickness:.2,type:'floor',kind:'platform',blocked:edge,cover:edge?40:0,
    material:'adobe',buildingId:'fear-room',...(edge?{obstacleHeight:2.8,blocksSight:true}:{roomId:upperRoom.id})});
   upperSurfaces.push({id:`fear-roof:${x}:${y}`,x,y,tacticalLevel:2,elevation:6,slabThickness:.2,type:'floor',kind:'roof',blocked:false,cover:0,material:'adobe',buildingId:'fear-room'});
  }
  wallEdges.push(...built.wallEdges.map(edge=>({...edge,id:`${edge.id}:upper`,...(edge.doorId?{doorId:`${edge.doorId}:upper`}:{}),tacticalLevel:1,elevation:3,obstacleHeight:2.8})));
  climbLinks.push({id:'fear:stairs',kind:'climb',from:{x:5,y:5,tacticalLevel:0},to:{x:5,y:5,tacticalLevel:1}},
   {id:'fear:roof-access',kind:'climb',from:{x:5,y:5,tacticalLevel:1},to:{x:5,y:5,tacticalLevel:2}});
 }
 const battle=createBattle(request.squad.map(unit=>({...unit,x:6,y:3,facing:4})),{...request,width,height,tiles,wallEdges,buildings,upperSurfaces,climbLinks,
  seed:42,exploration:false,props:[{id:'undisclosed-furniture',type:options.privateVariant??'bed',x:20,y:4,buildingId:hidden.building.id,roomId:hidden.building.rooms[0].id}],
  enemies:request.enemies.map((unit,index)=>({...unit,x:24+index%3,y:11+Math.floor(index/3),patrol:false,overwatch:false})),
  npcs:request.npcs.map((npc,index)=>({...npc,x:20+index%3,y:16,roomId:undefined,buildingId:undefined})),
 });
 const initial=roomSaved({campaign,battle});return {...paid,initial};
}
