import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {advanceSquadTravel,supportedTravelLegHours,travelLegHours,nextSquadTravelBoundarySeconds,cancelSquadTravel,squadTravelStatus} from '../game/squad-travel.js';
import {WORLD_CELLS,worldCell,ROAD_CELLS,cellStepHours,legacyCellStepHours} from '../game/world-cells.js';
import {strategicClockInterrupt} from '../game/strategic-clock.js';
import {enterSector} from '../game/world.js';
import {advanceBattleClock,syncBattleTime} from '../game/time.js';
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,next.lastError);return next;};
const journey=s=>s.squads[0].journey;
const field=s=>{const start=worldCell(s.location);return WORLD_CELLS.find(cell=>cell.land&&!cell.locality&&Math.abs(start.col-cell.col)+Math.abs(start.row-cell.row)===1).location;};

test('saved journeys reject unavailable rural transport before accessing flotilla town metadata',()=>{
 const s=initialCampaign(),queued=order(s,{type:'travel',sector:field(s),queue:true});
 for(const mode of ['posta','carts','flotilla']){
  const invalid=structuredClone(queued);journey(invalid).mode=mode;invalid.routes[mode]=true;
  assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/transporte.*celdas rurales/);
 }
 assert.ok(restoreCampaign(serializeCampaign(queued)));
});

const travelStep=(s,seconds)=>{
 const time=s.hour*3600+(s.secondOfHour??0)+seconds;s.hour=Math.floor(time/3600);s.secondOfHour=time%3600;
 return advanceSquadTravel(s,rosterFor(s),{note:()=>{},releaseAtArrival:()=>{},stopAtEveryArrival:true,seconds});
};
test('fractional travel saves retain real distance and charge movement work only once per full hour',()=>{
 let s=initialCampaign();s.secondOfHour=3570;s=order(s,{type:'travel',sector:'buenos_aires',queue:true});
 const start=s.hour*3600+s.secondOfHour,member=s.squad[0],before=s.operativeState[member].fatigue;
 assert.equal(journey(s).startedSecond,3570);travelStep(s,30);
 assert.equal(journey(s).elapsed,0);assert.equal(journey(s).elapsedSecond,30);assert.equal(journey(s).pendingSeconds,30);assert.equal(s.operativeState[member].fatigue,before);
 assert.equal(nextSquadTravelBoundarySeconds(s),3570);s=restoreCampaign(serializeCampaign(s));
 travelStep(s,3570);assert.equal(journey(s).elapsed,1);assert.equal(journey(s).elapsedSecond,undefined);assert.equal(journey(s).pendingSeconds,undefined);assert.ok(s.operativeState[member].fatigue>before);
 assert.equal(squadTravelStatus(s.squads[0]).elapsedSeconds,3600);
 while(journey(s))travelStep(s,nextSquadTravelBoundarySeconds(s));
 assert.equal(s.hour*3600+s.secondOfHour,start+12*3600);assert.equal(s.location,'buenos_aires');assert.equal(s.travelNotice.secondOfHour,3570);
 assert.ok(restoreCampaign(serializeCampaign(s)));
});
test('canceling a fractionally traveled leg returns through the exact covered distance without teleporting',()=>{
 let s=initialCampaign();s.secondOfHour=3570;s=order(s,{type:'travel',sector:'buenos_aires',queue:true});const start=s.hour*3600+s.secondOfHour;
 travelStep(s,30);cancelSquadTravel(s.squads[0],'return');assert.equal(journey(s).returning,true);assert.equal(nextSquadTravelBoundarySeconds(s),30);
 assert.ok(restoreCampaign(serializeCampaign(s)));travelStep(s,29);assert.ok(journey(s));travelStep(s,1);
 assert.equal(journey(s),undefined);assert.equal(s.location,'retiro');assert.equal(s.hour*3600+s.secondOfHour,start+60);
});
test('saved travel seconds reject impossible fractions and future booking dates',()=>{
 let s=initialCampaign();s.secondOfHour=3570;s=order(s,{type:'travel',sector:'buenos_aires',queue:true});travelStep(s,30);
 for(const mutate of [j=>j.elapsedSecond=3600,j=>j.pendingSeconds=-1,j=>delete j.pendingSeconds,j=>j.startedSecond=3600,j=>{j.startedAt=1;j.startedSecond=1;}]){
  const invalid=structuredClone(s);mutate(journey(invalid));assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/segundos|tiempo recorrido/);
 }
});

test('continuous campaign travel from a fractional departure arrives after all twelve real hours',()=>{
 for(const start of [3570,23*3600+3570]){
  let s=initialCampaign();for(let seconds=start;seconds>0;seconds-=Math.min(seconds,3600))s=order(s,{type:'advanceStrategicTime',seconds:Math.min(seconds,3600)});
  s=order(s,{type:'travel',sector:'buenos_aires',queue:true});const due=start+12*3600;
  for(let step=0;journey(s)&&step<40;step++){
   s=order(s,{type:'advanceStrategicTime',seconds:3600});assert.ok(s.hour*3600+(s.secondOfHour??0)<=due);
   if(step===2)s=restoreCampaign(serializeCampaign(s));
  }
  assert.equal(s.location,'buenos_aires');assert.equal(journey(s),undefined);assert.equal(s.hour*3600+s.secondOfHour,due);
 }
});
test('explicit hourly waits retain their whole-hour travel behavior after fractional departure',()=>{
 let s=initialCampaign();s=order(s,{type:'advanceStrategicTime',seconds:3570});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});
 s=order(s,{type:'wait',hours:12});assert.equal(s.location,'buenos_aires');assert.equal(s.hour,12);assert.equal(s.secondOfHour,3570);
});
test('splitting one posta travel hour pays for one remount and charges one hour of fatigue',()=>{
 let s=initialCampaign();s.routes.posta=true;s.secondOfHour=3570;s=order(s,{type:'travel',sector:'buenos_aires',mode:'posta',queue:true});
 const money=s.resources.treasury,fatigue=s.operativeState[s.squad[0]].fatigue;
 travelStep(s,30);assert.equal(s.resources.treasury,money-10);assert.equal(s.operativeState[s.squad[0]].fatigue,fatigue);
 s=restoreCampaign(serializeCampaign(s));travelStep(s,30);assert.equal(s.resources.treasury,money-10);
 travelStep(s,3540);assert.equal(journey(s).elapsed,1);assert.equal(s.resources.treasury,money-10);assert.ok(s.operativeState[s.squad[0]].fatigue>fatigue);
});
test('another squad receives thirty real travel seconds when tactical time crosses the first hour',()=>{
 let s=initialCampaign();s=order(s,{type:'advanceStrategicTime',seconds:3570});
 s=order(s,{type:'createSquad',name:'Exploradores',ids:[3]});const travelers=s.activeSquadId;
 s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'visitSector'});
 const before=structuredClone(s.pendingBattle.squad),fatigue=s.operativeState[3].fatigue;
 let battle=enterSector(s.pendingBattle,s.sectorStates[s.location]);advanceBattleClock(battle,30);
 let synced=syncBattleTime(s,battle);assert.equal(synced.error,null);s=synced.campaign;battle=synced.battle;const route=s.squads.find(q=>q.id===travelers).journey;
 assert.equal(s.hour,1);assert.equal(s.secondOfHour,0);assert.equal(route.elapsed,0);assert.equal(route.elapsedSecond,30);assert.equal(route.pendingSeconds,30);
 assert.equal(s.operativeState[3].fatigue,fatigue);assert.deepEqual(s.pendingBattle.squad,before);
 for(let step=0;step<2;step++){advanceBattleClock(battle,30);synced=syncBattleTime(s,battle);assert.equal(synced.error,null);s=synced.campaign;battle=synced.battle;assert.equal(s.squads.find(q=>q.id===travelers).journey.elapsedSecond,60+step*30);}
 assert.equal(s.hour,1);assert.equal(s.secondOfHour,60);assert.ok(restoreCampaign(serializeCampaign(s)));
});
test('repeated tactical checkpoints inside one minute retain every queued travel second',()=>{
 let s=initialCampaign();s=order(s,{type:'createSquad',name:'Exploradores',ids:[3]});const travelers=s.activeSquadId;
 s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'visitSector'});
 let battle=enterSector(s.pendingBattle,s.sectorStates[s.location]);
 for(let step=0;step<4;step++){
  advanceBattleClock(battle,5);const synced=syncBattleTime(s,battle);assert.equal(synced.error,null);s=synced.campaign;battle=synced.battle;
  assert.equal(s.squads.find(q=>q.id===travelers).journey.elapsedSecond,(step+1)*5);
 }
 assert.equal(s.secondOfHour,20);assert.ok(restoreCampaign(serializeCampaign(s)));
});

test('saved leg durations accept explicit earlier rules and reject arbitrary speed changes',()=>{
 const s=order(initialCampaign(),{type:'travel',sector:'buenos_aires',queue:true});
 for(const hours of [1,11,13,95]){const invalid=structuredClone(s);journey(invalid).legHours=hours;assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/duración.*etapa/);}
 const base=initialCampaign(),to=field(base),rural=order(base,{type:'travel',sector:to,queue:true});
 const saved=structuredClone(rural);journey(saved).legHours=legacyCellStepHours(to);
 assert.equal(journey(restoreCampaign(serializeCampaign(saved))).legHours,legacyCellStepHours(to),'an already planned old leg retains its accepted duration');
 const supported=supportedTravelLegHours(base.location,to);
 const invalid=structuredClone(rural);journey(invalid).legHours=Array.from({length:10},(_,i)=>i+1).find(hours=>!supported.includes(hours));
 assert.throws(()=>restoreCampaign(serializeCampaign(invalid)),/duración.*etapa/);
});

test('horses are faster on rural roads, open land and mountains with integral hourly progress',()=>{
 for(const cell of [WORLD_CELLS.find(c=>c.land&&c.biome==='plains'&&ROAD_CELLS.has(c.id)),WORLD_CELLS.find(c=>c.land&&c.biome==='plains'&&!ROAD_CELLS.has(c.id)),WORLD_CELLS.find(c=>c.land&&c.biome==='mountain')]){
  assert.ok(cell);const walking=cellStepHours(cell.id),riding=cellStepHours(cell.id,'horse');
  assert.ok(Number.isInteger(walking)&&Number.isInteger(riding)&&riding>=1);assert.ok(riding<walking);
 }
 const road=WORLD_CELLS.find(c=>c.land&&c.biome==='plains'&&ROAD_CELLS.has(c.id)),field=WORLD_CELLS.find(c=>c.land&&c.biome==='plains'&&!ROAD_CELLS.has(c.id));
 assert.ok(cellStepHours(road.id)<cellStepHours(field.id));
});

test('continuous arrival attention stops at an intermediate sector without discarding the remaining route',()=>{
 const before=order(initialCampaign(),{type:'travel',sector:'ensenada',queue:true}),s=structuredClone(before),q=s.squads[0];
 s.hour=q.journey.legHours;q.journey.elapsed=q.journey.legHours-1;
 const events=advanceSquadTravel(s,rosterFor(s),{note:()=>{},releaseAtArrival:()=>{},stopAtEveryArrival:true});
 assert.equal(events,true);assert.equal(q.location,'buenos_aires');assert.equal(q.journey.status,'moving');assert.equal(q.journey.elapsed,0);assert.equal(q.journey.path.at(-1),'ensenada');
 assert.match(strategicClockInterrupt(before,s),/llega a/);assert.ok(restoreCampaign(serializeCampaign(s)));
 const legacy=structuredClone(before);legacy.hour=journey(legacy).legHours;journey(legacy).elapsed=journey(legacy).legHours-1;
 assert.equal(advanceSquadTravel(legacy,rosterFor(legacy),{note:()=>{},releaseAtArrival:()=>{}}),false);assert.equal(legacy.travelNotice,undefined);
});

test('the continuous campaign clock stops at the real intermediate arrival and resumes onward',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'ensenada',queue:true});
 const first=travelLegHours('retiro','buenos_aires');
 for(let hour=0;hour<first-1;hour++)s=order(s,{type:'advanceStrategicTime',seconds:3600});
 s=order(s,{type:'advanceStrategicTime',seconds:3599});const before=s;s=order(s,{type:'advanceStrategicTime',seconds:3600});
 assert.equal(s.hour,first);assert.equal(s.secondOfHour,0);assert.equal(s.location,'buenos_aires');assert.ok(journey(s));assert.match(strategicClockInterrupt(before,s),/llega/);
 s=order(s,{type:'advanceStrategicTime',seconds:60});assert.equal(s.secondOfHour,60);assert.equal(s.location,'buenos_aires');
});
