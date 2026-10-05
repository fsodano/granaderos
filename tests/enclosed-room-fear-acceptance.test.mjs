import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {act,createElement as h} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {actBattle,pointFirePreview,environmentUsePreview,climbPreview} from '../game/tactical.js';
import {enclosedRoomFearStatus,occupiedEnclosedRoom} from '../game/enclosed-room-fear.js';
import {tacticalFeedback} from '../game/tactical-feedback.js';
import {withCharacterSpeech} from '../game/character-events.js';
import {ammoCount} from '../game/ammo-types.js';
import {encodeSave} from '../game/save.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
import {ROOM_ACTOR,roomActor,roomSaved,roomStamp,roomCrowbar,roomAction,roomStep,roomReplay,preparedRoomArena} from './enclosed-room-fear-fixture.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:Strip}=await import('../web/app/JA2Strip.tsx');
const rounds=unit=>unit.loaded+ammoCount(unit);
const custody=unit=>({hp:unit.hp,bleeding:unit.bleeding,loaded:unit.loaded??unit.carriedLoaded,ammo:Object.values(unit.inventory??{}).filter(item=>item.kind==='ammunition').reduce((sum,item)=>sum+item.count,0),condition:unit.condition,inventory:unit.inventory,
 outfit:unit.outfit,headwear:unit.headwear,legwear:unit.legwear,medkits:unit.medkits,bladeCondition:unit.bladeCondition,toolkitPoints:unit.toolkitPoints});
const fearLines=battle=>battle.log.filter(line=>line.includes('siente temor dentro de una habitación cerrada'));
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const popup=tree=>nodes(tree).find(node=>node.props?.className==='tactical-feedback-popup')??null;

export function enterPaidRoom(options={}){
 const fixture=preparedRoomArena(options),history=[];let pair=fixture.initial;
 pair=roomAction(pair,{type:'door',doorId:'fear-door',open:true},history);
 const outside=roomSaved(pair);
 pair=roomAction(pair,{type:'move',x:6,y:5},history);
 const before=roomSaved(pair);
 pair=roomAction(pair,{type:'rest'},history);
 return {...fixture,pair,before,outside,arenaHistory:history};
}

test('paid Godoy enters an intact room, spends one real shot and her acquired crowbar, then retains rubble and finite custody on saved return',t=>{
 const current=enterPaidRoom(),legacy=enterPaidRoom({oldPinned:true}),privateControl=enterPaidRoom({privateVariant:'barrels'}),history=[...current.arenaHistory];let pair=current.pair;
 assert.equal(current.quote.price,294);assert.equal(current.initial.campaign.resources.treasury,2906);
 assert.equal(current.initial.campaign.contracts[ROOM_ACTOR].paid,294);assert.equal(current.initial.campaign.contracts[ROOM_ACTOR].started,6);
 assert.equal(roomCrowbar(roomActor(current.initial))[1].condition,60);assert.equal(rounds(roomActor(current.initial)),10);
 assert.equal(enclosedRoomFearStatus(current.outside.battle,roomActor(current.outside)).reason,'open');
 assert.equal(occupiedEnclosedRoom(current.before.battle,roomActor(current.before)),true,'an open intact door remains part of a roofed room');
 assert.equal(current.pair.battle.mode,'combat');assert.equal(current.pair.battle.turn,current.before.battle.turn+1);
 assert.equal(roomActor(current.before).shock,0);assert.equal(roomActor(current.pair).shock,2);
 assert.equal(roomActor(legacy.pair).shock,0);assert.equal(roomActor(legacy.pair).enclosedRoomFearWarned,undefined);
 assert.deepEqual(custody(roomActor(current.pair)),custody(roomActor(legacy.pair)));
 assert.equal(current.pair.battle.revealedRooms.includes('undisclosed-room:interior'),false);
 assert.deepEqual(roomActor(current.pair),roomActor(privateControl.pair),'different unrevealed furniture cannot alter own fear, costs or capability');
 assert.deepEqual(tacticalFeedback(current.before.battle,current.pair.battle),tacticalFeedback(privateControl.before.battle,privateControl.pair.battle));
 assert.equal(current.pair.battle.seed,privateControl.pair.battle.seed);assert.equal(current.pair.battle.elapsedSeconds,privateControl.pair.battle.elapsedSeconds);
 assert.equal(current.pair.battle.seed,legacy.pair.battle.seed);assert.equal(current.pair.battle.elapsedSeconds,legacy.pair.battle.elapsedSeconds);
 assert.equal(fearLines(pair.battle).length,1);assert.deepEqual(tacticalFeedback(current.before.battle,pair.battle),[`${roomActor(pair).name} siente temor dentro de una habitación cerrada.`]);
 assert.deepEqual(tacticalFeedback(pair.battle,roomSaved(pair).battle),[],'loading the saved receipt is not another fear event');
 const emptyPoint={x:6,y:1},pointPreview=pointFirePreview(pair.battle,roomActor(pair),emptyPoint,0),legacyPreview=pointFirePreview(legacy.pair.battle,roomActor(legacy.pair),emptyPoint,0);
 assert.equal(pointPreview.valid,true,pointPreview.reason);assert.deepEqual(pointPreview,legacyPreview,'empty-point preflight exposes paid cost, not a body-hit chance');
 const beforeShot=roomSaved(pair),fireCost=pointPreview.pa;
 pair=roomAction(pair,{type:'firePoint',...emptyPoint},history);
 assert.equal(rounds(roomActor(pair)),rounds(roomActor(beforeShot))-1);assert.equal(roomActor(pair).condition,roomActor(beforeShot).condition-1);
 assert.equal(roomActor(pair).ap,roomActor(beforeShot).ap-fireCost);assert.equal(roomActor(pair).hp,63);assert.equal(roomActor(pair).bleeding,0);
 const [toolKey]=roomCrowbar(roomActor(pair));
 pair=roomAction(pair,{type:'weapon',slot:'tool',toolKey:`inventory:${toolKey}`},history);
 pair=roomAction(pair,{type:'move',x:5,y:5},history);
 const beforeBreach=roomSaved(pair),ref={kind:'wall',id:'wall:5:4',x:5,y:4,tacticalLevel:0},preview=environmentUsePreview(pair.battle,roomActor(pair),ref,'breach');
 assert.equal(preview.valid,true,preview.reason);assert.equal(preview.movePa,0);assert.equal(preview.actionPa,45);
 pair=roomAction(pair,{type:'useItem',environment:{...ref,verb:'breach'}},history);
 assert.equal(roomActor(pair).ap,roomActor(beforeBreach).ap-45);assert.equal(roomCrowbar(roomActor(pair))[1].condition,57);
 assert.equal(roomCrowbar(roomActor(pair))[1].count,1);assert.equal(rounds(roomActor(pair)),9);assert.equal(roomActor(pair).shock,2,'the breach does not refund earned shock');
 assert.equal(occupiedEnclosedRoom(pair.battle,roomActor(pair)),false,'real rubble defeats the retained room and building tags');
 const rubble=pair.battle.tiles.find(tile=>tile.x===5&&tile.y===4);assert.equal(rubble.type,'rubble');assert.equal(rubble.blocked,false);
 assert.equal(rubble.buildingId,'fear-room');assert.equal(pair.battle.seed,beforeBreach.battle.seed,'manual work has no random draw');
 const rejected=actBattle(pair.battle,{type:'useItem',unitId:'126',environment:{...ref,verb:'breach'}});
 assert.ok(rejected.lastError);for(const field of ['units','tiles','props','seed','elapsedSeconds'])assert.deepEqual(rejected[field],pair.battle[field],'repeated breach must reject before costs');
 pair=roomAction(pair,{type:'move',x:5,y:4},history);assert.deepEqual([roomActor(pair).x,roomActor(pair).y],[5,4]);
 pair=roomAction(pair,{type:'move',x:5,y:3},history);
 const outsideShock=roomActor(pair).shock;pair=roomAction(pair,{type:'rest'},history);
 assert.equal(roomActor(pair).shock,outsideShock/2);assert.equal(pair.battle.mode,'exploration','the second quiet round also returns to exploration');
 assert.equal(fearLines(pair.battle).length,1);
 pair=roomAction(pair,{type:'move',x:5,y:0},history);
 const exit=pair.battle.exits.find(value=>value.destination==='retiro');assert.ok(exit);
 pair=roomAction(pair,{type:'exit',unitIds:['126'],exitId:exit.id},history);assert.equal(pair.battle.status,'retreat');
 const returnedBattle=roomSaved(pair),report={type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:pair.battle.status,sectorState:pair.battle,survivors:pair.battle.units.filter(unit=>unit.side==='player')};
 pair=roomStep(pair,{kind:'settle'},history);
 assert.equal(pair.campaign.location,'retiro');assert.equal(pair.campaign.resources.treasury,2906);
 assert.deepEqual(custody(pair.campaign.operativeState[ROOM_ACTOR]),custody(roomActor(returnedBattle)));
 const stale=dispatchCampaign(pair.campaign,report);assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},pair.campaign,'stale settlement cannot repeat costs or fear');
 pair=roomStep(pair,{kind:'campaign',action:{type:'attack',sector:'buenos_aires'}},history);
 assert.equal(pair.battle.tiles.find(tile=>tile.x===5&&tile.y===4).type,'rubble');assert.deepEqual(custody(roomActor(pair)),custody(roomActor(returnedBattle)));
 assert.equal(roomActor(pair).shock,0);assert.equal(roomActor(pair).enclosedRoomFearWarned,undefined,'reentry uses ordinary transient shock/notice rules');
 assert.equal(fearLines(pair.battle).length,0);assert.equal(roomCrowbar(roomActor(pair))[1].condition,57);
 assert.equal(pair.campaign.sectorStates['cell-24-27'].props.find(prop=>prop.id==='roadside:cell-24-27:clothing-tools').contents.some(stack=>stack.instanceId==='cache:cell-24-27:crowbar'),false);
 assert.deepEqual(roomReplay(current.initial,history),pair,'all declared-arena orders, retreat and real reentry replay through official saves');
 t.diagnostic(JSON.stringify({scenario:'Native stock126 paid hire, discovery and marches; declared initial28x18 combat room/screen, seed42. Not a conquest/full-campaign proof.',price:current.quote.price,nativePrefixOrders:current.history.length,arrivalHour:6,arenaClock:[current.initial.campaign.hour,current.initial.campaign.secondOfHour],finalClock:[pair.campaign.hour,pair.campaign.secondOfHour],treasury:pair.campaign.resources.treasury,actions:history.length,actionSeconds:returnedBattle.battle.elapsedSeconds,health:{hp:roomActor(pair).hp,bleeding:roomActor(pair).bleeding},rounds:rounds(roomActor(pair)),gunCondition:roomActor(pair).condition,crowbar:{condition:roomCrowbar(roomActor(pair))[1].condition,count:roomCrowbar(roomActor(pair))[1].count},pointFirePA:fireCost,fearShock:roomActor(current.pair).shock,returnedShock:roomActor(pair).shock,playerDeaths:returnedBattle.battle.units.filter(unit=>unit.side==='player'&&unit.hp===0).map(unit=>unit.id),enemyDeaths:returnedBattle.battle.units.filter(unit=>unit.side==='enemy'&&unit.hp===0).map(unit=>unit.id)}));
});

test('paid native Godoy climbs a genuinely roofed upper platform room, then reaches its open-air roof without another fear charge',t=>{
 const fixture=preparedRoomArena({crowbar:false,upper:true}),history=[];let pair=fixture.initial;
 const initialKit=custody(roomActor(pair)),initialEnergy=roomActor(pair).energy;
 pair=roomAction(pair,{type:'door',doorId:'fear-door',open:true},history);
 pair=roomAction(pair,{type:'move',x:5,y:5},history);
 const climbBefore=roomSaved(pair),climb=climbPreview(pair.battle,roomActor(pair),{linkId:'fear:stairs'});assert.equal(climb.valid,true);
 pair=roomAction(pair,{type:'climb',linkId:'fear:stairs'},history);
 assert.equal(roomActor(pair).tacticalLevel,1);assert.equal(roomActor(pair).ap,roomActor(climbBefore).ap-climb.pa);
 assert.ok(roomActor(pair).energy<roomActor(climbBefore).energy);assert.equal(occupiedEnclosedRoom(pair.battle,roomActor(pair)),true);
 const beforeFear=roomSaved(pair);pair=roomAction(pair,{type:'rest'},history);
 assert.equal(pair.battle.mode,'combat');assert.equal(roomActor(pair).shock,2);assert.equal(fearLines(pair.battle).length,1);
 assert.deepEqual(custody(roomActor(pair)),initialKit);
 const roofBefore=roomSaved(pair),roofClimb=climbPreview(pair.battle,roomActor(pair),{linkId:'fear:roof-access'});assert.equal(roofClimb.valid,true);
 pair=roomAction(pair,{type:'climb',linkId:'fear:roof-access'},history);
 assert.equal(roomActor(pair).tacticalLevel,2);assert.equal(roomActor(pair).ap,roomActor(roofBefore).ap-roofClimb.pa);
 assert.equal(enclosedRoomFearStatus(pair.battle,roomActor(pair)).reason,'open','the supporting roof slab is not an occupied room or an overhead ceiling');
 assert.equal(roomActor(pair).shock,2,'physical exit from the upper room does not refund shock');
 pair=roomAction(pair,{type:'rest'},history);assert.equal(roomActor(pair).shock,1);assert.equal(fearLines(pair.battle).length,1);
 pair=roomAction(pair,{type:'climb',linkId:'fear:roof-access'},history);
 pair=roomAction(pair,{type:'climb',linkId:'fear:stairs'},history);
 pair=roomAction(pair,{type:'move',x:6,y:3},history);pair=roomAction(pair,{type:'move',x:6,y:0},history);
 pair=roomAction(pair,{type:'exit',unitIds:['126'],exitId:pair.battle.exits.find(exit=>exit.destination==='retiro').id},history);
 const exited=roomSaved(pair);pair=roomStep(pair,{kind:'settle'},history);
 assert.deepEqual(custody(pair.campaign.operativeState[ROOM_ACTOR]),initialKit);
 assert.deepEqual(roomReplay(fixture.initial,history),pair);
 assert.equal(pair.campaign.resources.treasury,2906);assert.equal(pair.campaign.operativeState[ROOM_ACTOR].hp,63);
 t.diagnostic(JSON.stringify({scenario:'Paid native126; declared upper platform at height3, walls2.8 joining ceiling bottom5.8, roof6. Heights are game units, not metres. No native upper-story conquest claim.',price:fixture.quote.price,treasury:pair.campaign.resources.treasury,climbPA:[climb.pa,roofClimb.pa],initialEnergy,upperFear:roomActor(beforeFear).shock+'→2',roofShock:1,rounds:rounds(roomActor(exited)),actionSeconds:exited.battle.elapsedSeconds,returnSector:pair.campaign.location,clock:[pair.campaign.hour,pair.campaign.secondOfHour]}));
});

test('earned room fear shows one temporary named notice; importing its receipt does not replay it and a later genuine turn still can',async t=>{
 const earned=enterPaidRoom(),before=earned.before,received=earned.pair,text=`${roomActor(received).name} siente temor dentro de una habitación cerrada.`;
 const strip=tree=>nodes(tree).find(node=>node.type===Strip),props=battle=>({battle,onChange:next=>next,onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(before.battle),{virtualTimers:true,renderTree:tree=>h('div',null,strip(tree),popup(tree))});
 await mounted.act(async()=>strip(mounted.tree()).props.onOpenInventory('126'));
 const status=()=>document.querySelector('[aria-label="Temor a lugares cerrados"]'),tension=()=>[...document.querySelectorAll('.ja2-stats>div')].find(node=>node.firstElementChild?.textContent==='Tensión actual').querySelector('b').textContent;
 assert.equal(tension(),'0');assert.match(status().textContent,/Si sigue dentro y puede combatir: tensión \+2 al comenzar su turno, tras la recuperación habitual/);
 assert.equal(roomActor(before).shock,0,'inspection has no immediate effect');
 assert.equal(popup(mounted.tree()),null);await mounted.render(props(received.battle));assert.equal(document.querySelector('.tactical-feedback-popup').textContent,text);
 assert.equal(tension(),'2');assert.match(status().textContent,/Si sigue dentro/);
 assert.equal(await mounted.nextDelay(),4000);assert.equal(document.querySelector('.tactical-feedback-popup'),null);
 await mounted.render(props(roomSaved(received).battle));assert.equal(popup(mounted.tree()),null);
 assert.deepEqual(tacticalFeedback(received.battle,roomSaved(received).battle),[]);
 const privateControl=enterPaidRoom({privateVariant:'barrels'}),publicText=status().textContent;
 await mounted.render(props(privateControl.pair.battle));assert.equal(status().textContent,publicText);assert.equal(tension(),'2');assert.equal(popup(mounted.tree()),null);
 const [key]=roomCrowbar(roomActor(received));let breached=roomAction(received,{type:'weapon',slot:'tool',toolKey:`inventory:${key}`});
 breached=roomAction(breached,{type:'move',x:5,y:5});breached=roomAction(breached,{type:'useItem',environment:{kind:'wall',id:'wall:5:4',verb:'breach'}});
 await mounted.render(props(breached.battle));assert.match(status().textContent,/Fuera de una habitación intacta: sin aumento/);assert.equal(tension(),'2');assert.equal(popup(mounted.tree()),null,'the paid breach does not repeat the old notice or refund shock');
 const older=enterPaidRoom({oldPinned:true,crowbar:false});await mounted.render(props(older.pair.battle));assert.equal(status(),null);
 assert.equal(roomActor(older.pair).shock,0,'the older pinned omission is neutral');
});

test('the real file-import path remounts room fear receipts without a popup and accepts a new ordinary keyboard turn',async t=>{
 const earned=enterPaidRoom({crowbar:false}),before=earned.before,received=earned.pair,mounted=await mountCampaign(t,before),doc=mounted.document,popup=()=>doc.querySelector('.tactical-feedback-popup');
 assert.equal(popup(),null);await mounted.click('Menú');
 async function importPair(pair){
  await mounted.click('Importar partida');const text=encodeSave(pair.campaign,pair.battle),file=new mounted.dom.window.File([text],'partida.json',{type:'application/json'});let read=false;
  file.text=async()=>{read=true;return text;};const input=doc.querySelector('input[type="file"]');assert.ok(input);
  Object.defineProperty(input,'files',{configurable:true,value:[file]});await act(async()=>input.dispatchEvent(new mounted.dom.window.Event('change',{bubbles:true})));
  assert.equal(read,true);assert.equal(input.value,'');
 }
 await importPair(received);assert.deepEqual(mounted.saved(),received);assert.equal(popup(),null,'saved fear is not a new played event');
 await importPair(before);assert.deepEqual(mounted.saved(),before);assert.equal(popup(),null);
 const close=doc.querySelector('.dialog-close');assert.ok(close);await act(async()=>close.dispatchEvent(new mounted.dom.window.MouseEvent('click',{bubbles:true})));
 const expectedBattle=withCharacterSpeech(before.battle,actBattle(before.battle,{type:'rest'})),expected=roomSaved(roomStep(before,{kind:'action',action:{type:'rest',unitId:'126'}}));
 // Speech is an independent production wrapper. The Page applies it after
 // the same ordinary turn; compare the stored result, not a mock callback.
 const {syncBattleTime}=await import('../game/time.js'),synced=syncBattleTime(before.campaign,expectedBattle);assert.equal(synced.error,null);
 const pageExpected=roomSaved(synced);assert.deepEqual(custody(roomActor(pageExpected)),custody(roomActor(expected)));
 await act(async()=>doc.body.dispatchEvent(new mounted.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true})));
 await mounted.settleUntil(()=>roomActor(mounted.saved()).enclosedRoomFearWarned===true);
 assert.deepEqual(mounted.saved(),pageExpected);assert.equal(popup()?.textContent,`${roomActor(pageExpected).name} siente temor dentro de una habitación cerrada.`);
 await mounted.settleUntil(()=>popup()===null);assert.deepEqual(mounted.saved(),pageExpected,'notice expiry changes no paid clock, RNG or finite kit');
});
