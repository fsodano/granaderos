import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalClimate,regionalWeatherAt,campaignSeason,regionalConditions,WEATHER_INTERVAL_HOURS} from '../game/regional-weather.js';
import {createBattle,actBattle,getReachable,ignitionRisk,maxActionPoints} from '../game/tactical.js';
import {advanceBattleClock,syncBattleTime} from '../game/time.js';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {enterSector} from '../game/world.js';
import {battleFromRequest,prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {makeOutfit} from '../game/outfits.js';

const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(state,action)=>{const next=actBattle(state,{unitId:'p',...action});assert.equal(next.lastError,null,next.lastError);return next;};
const ground=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
const field=(sector='retiro',hour=0,unit={},extra={})=>createBattle([{id:'p',x:1,y:1,weapon:1800,loaded:1,ammo:3,priming:5,condition:100,outfit:null,...unit}],
 {id:'regional-test',sector,hour,width:12,height:8,tiles:ground(),seed:1,exploration:true,enemies:[],regionalWeather:true,...extra});
const firstHour=(predicate)=>{for(let hour=0;hour<8640;hour+=WEATHER_INTERVAL_HOURS)if(predicate(hour))return hour;throw Error('No matching weather block in the model year.');};
const transitionHour=()=>firstHour(hour=>hour>0&&JSON.stringify(regionalWeatherAt('retiro',hour))!==JSON.stringify(regionalWeatherAt('retiro',hour-1)));
const wetAndDryHour=()=>firstHour(hour=>regionalWeatherAt('tucuman',hour).rain>50&&regionalWeatherAt('mendoza',hour).rain===0);
const geometry=b=>({width:b.width,height:b.height,tiles:b.tiles,buildings:b.buildings,props:b.props,decor:b.decor,exits:b.exits});
const currentWeather=b=>regionalWeatherAt(b.sectorId,(b.startSeconds+b.elapsedSeconds)/3600);
function assertDeployment(campaign,sector,sceneId){
 const request=campaign.pendingBattle;
 assert.equal(request.sector,sector);assert.equal(request.sceneId,sceneId);assert.equal(request.regionalWeather,true);
 assert.deepEqual(request.weather,regionalWeatherAt(sector,request.hour+(request.secondOfHour??0)/3600));
 const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);
 assert.equal(pair.battle.regionalWeather,true);assert.deepEqual(pair.battle.weather,currentWeather(pair.battle));
 assert.deepEqual(restoreCampaign(serializeCampaign(pair.campaign)),pair.campaign);
 assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),{campaign:pair.campaign,battle:pair.battle});
 return pair;
}

test('campaign calendar changes southern seasons at exact model-month boundaries',()=>{
 assert.deepEqual(campaignSeason(0),{index:1,month:3,name:'Otoño'});
 for(const [hour,index,month,name] of [[2160,2,6,'Invierno'],[4320,3,9,'Primavera'],[6480,0,12,'Verano'],[8640,1,3,'Otoño']]){
  assert.notEqual(campaignSeason(hour-1/3600).index,index);
  assert.deepEqual(campaignSeason(hour),{index,month,name});
 }
 for(const hour of [-1,NaN,Infinity,'12',null])assert.throws(()=>campaignSeason(hour));
});

test('regional weather is fixed within its block and shared by neighboring sectors without using the combat seed',()=>{
 const regions=[['retiro','buenos_aires','ensenada'],['san_nicolas','san_lorenzo','santa_fe'],['tucuman','yatasto','salta','jujuy'],['uspallata','los_patos']];
 for(const group of regions)for(const hour of [0,30,2160,4320,6480]){
  const expected=regionalWeatherAt(group[0],hour);
  for(const sector of group){
   assert.deepEqual(regionalWeatherAt(sector,hour),expected);
   assert.deepEqual(regionalWeatherAt(sector,hour+WEATHER_INTERVAL_HOURS-1/3600),expected);
   assert.equal(regionalClimate(sector).id,regionalClimate(group[0]).id);
  }
 }
 const first=field('tucuman',wetAndDryHour(),{},{seed:45}),second=field('tucuman',wetAndDryHour(),{},{seed:123456});
 assert.deepEqual(first.weather,second.weather);assert.equal(first.seed,45);assert.equal(second.seed,123456);
 for(const b of [first,second]){const seed=b.seed;for(let i=0;i<50;i++)regionalWeatherAt(b.sectorId,b.startSeconds/3600);assert.equal(b.seed,seed);}
});

test('north, Cuyo and the Andes have distinct seasonal weather rather than one national rain setting',()=>{
 const sample=(sector,start)=>Array.from({length:360},(_,i)=>regionalWeatherAt(sector,start+i*WEATHER_INTERVAL_HOURS));
 const rainy=rows=>rows.filter(w=>w.rain>0).length;
 const northernSummer=sample('tucuman',6480),northernWinter=sample('tucuman',2160),cuyoSummer=sample('mendoza',6480),andesWinter=sample('uspallata',2160);
 assert.ok(rainy(northernSummer)>rainy(northernWinter));assert.ok(rainy(northernSummer)>rainy(cuyoSummer));
 assert.ok(Math.min(...northernSummer.map(w=>w.humidity))>Math.max(...cuyoSummer.map(w=>w.humidity)));
 assert.ok(andesWinter.every(w=>w.rain===0));
 assert.notEqual(regionalClimate('humahuaca').id,regionalClimate('jujuy').id);
 assert.notEqual(regionalClimate('cordoba').id,regionalClimate('mendoza').id);
 for(const rows of [northernSummer,northernWinter,cuyoSummer,andesWinter])for(const w of rows){
  assert.ok([0,25,40,60].includes(w.rain));assert.ok(Number.isFinite(w.humidity)&&w.humidity>=0&&w.humidity<=100);
 }
});

test('unknown regions and invalid weather times cannot silently fall back to another climate',()=>{
 for(const sector of ['missing','__proto__','constructor','toString',null,undefined]){
  assert.equal(regionalClimate(sector),null);assert.throws(()=>regionalWeatherAt(sector,0));
 }
 for(const hour of [-1,NaN,Infinity,'12',null])assert.throws(()=>regionalWeatherAt('retiro',hour));
});

test('sector visits, assaults and defensive encounters issue regional weather through the campaign reducer',()=>{
 assertDeployment(order(initialCampaign(),{type:'visitSector'}),'retiro');
 let attack=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});
 assertDeployment(order(attack,{type:'attack',sector:'san_nicolas'}),'san_nicolas');
 let defense=initialCampaign();launchEnemyGroup(defense,'coast','retiro',{immediate:true});
 defense=order(defense,{type:'wait',hours:1});
 assertDeployment(order(defense,{type:'respondToEncounter',groupId:defense.pendingEncounter.groupId,choice:'tactical'}),'retiro');
});

test('Yatasto and San Lorenzo retain their regional weather on their real mission deployment paths',()=>{
 let north=initialCampaign();north.phase=2;north.flags.sanLorenzo=true;
 for(const id of ['cordoba','tucuman','salta'])north.sectors[id].owner='patriot';
 north=order(north,{type:'travel',sector:'tucuman'});
 const conference=assertDeployment(order(north,{type:'visitMission',mission:'yatasto'}),'tucuman','yatasto');
 assert.equal(conference.battle.sceneId,'yatasto');assert.equal(regionalClimate(conference.battle.sectorId).id,regionalClimate('yatasto').id);
 let coast=initialCampaign();coast.phase=1;coast.flags.academy=true;coast.sectors.san_nicolas.owner='patriot';
 coast=order(coast,{type:'travel',sector:'san_nicolas'});
 const combat=assertDeployment(order(coast,{type:'attack',sector:'san_lorenzo'}),'san_lorenzo');
 assert.ok(combat.battle.units.some(u=>u.missionAlly&&u.id==='57'));
});

test('weather changes at the exact six-hour boundary without changing RNG, terrain, turn or AP',()=>{
 const hour=transitionHour(),state=field('retiro',hour-1,{}, {secondOfHour:3599}),before=structuredClone(state);
 assert.notDeepEqual(state.weather,regionalWeatherAt('retiro',hour));
 advanceBattleClock(state,0);assert.deepEqual(state,before);
 advanceBattleClock(state,1);assert.deepEqual(state.weather,regionalWeatherAt('retiro',hour));
 assert.equal(state.elapsedSeconds,1);assert.equal(state.turn,before.turn);assert.equal(state.seed,before.seed);
 assert.equal(state.units[0].ap,before.units[0].ap);assert.deepEqual(geometry(state),geometry(before));
 assert.doesNotThrow(()=>validateBattleSnapshot(state));
});

test('large and small clock advances reach identical weather, time, fatigue and light state',()=>{
 const hour=transitionHour(),large=field('retiro',hour-1,{}, {secondOfHour:3599,lights:[{id:'test-light',x:1,y:2,turns:100,type:'torch'}]}),small=structuredClone(large);
 const steps=[1,3600,6*3600,37,11*3600-37];
 advanceBattleClock(large,steps.reduce((sum,n)=>sum+n,0));
 for(const seconds of steps)advanceBattleClock(small,seconds);
 assert.deepEqual(large,small);assert.deepEqual(large.weather,currentWeather(large));
});

test('save, load and suspended battle resume preserve the exact next regional weather transition',()=>{
 const start=initialCampaign();start.hour=transitionHour()-1;start.secondOfHour=3599;
 const pair=assertDeployment(order(start,{type:'visitSector'}),'retiro');
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));
 const resumed=battleFromRequest({resumeSnapshot:saved.battle},{hour:99999});
 assert.deepEqual(resumed,saved.battle);assert.notEqual(resumed,saved.battle);
 const advanced=structuredClone(pair.battle);advanceBattleClock(advanced,1);advanceBattleClock(resumed,1);
 assert.deepEqual(resumed,advanced);assert.deepEqual(resumed.weather,currentWeather(resumed));
 const synced=syncBattleTime(saved.campaign,resumed);assert.equal(synced.error,null);
 assert.deepEqual(decodeSave(encodeSave(synced.campaign,synced.battle)),{campaign:synced.campaign,battle:synced.battle});
});

test('re-entering a saved sector keeps its buildings and breaches but uses the current regional weather',()=>{
 const request={id:'regional-reentry',sector:'retiro',exploration:true,hour:0,seed:45,squad:[{id:'p',weapon:1800}],enemies:[],...regionalConditions('retiro',0)};
 const first=enterSector(request),wall=first.tiles.find(t=>t.type==='wall');
 Object.assign(wall,{type:'rubble',blocked:false,blocksSight:false,cover:0});first.savedHour=0;first.savedSecond=0;
 const before=structuredClone(first),hour=transitionHour();
 const next=enterSector({...request,hour,squad:request.squad.map(u=>({...u,entryReason:'resident'}))},first);
 assert.deepEqual(first,before);assert.deepEqual(geometry(next),geometry(first));
 assert.deepEqual(next.weather,regionalWeatherAt('retiro',hour));assert.notDeepEqual(next.weather,first.weather);
 assert.equal(next.regionalWeather,true);assert.equal(next.elapsedSeconds,0);assert.equal(next.mode,'exploration');
 assert.doesNotThrow(()=>validateBattleSnapshot(next));
});

test('malformed regional markers and numeric weather are rejected in both tactical and pending campaign saves',()=>{
 const battle=field(),campaign=order(initialCampaign(),{type:'visitSector'});
 const changes=[s=>s.regionalWeather='true',s=>s.regionalWeather=null,s=>s.weather.rain=true,s=>s.weather.rain=-1,
  s=>s.weather.rain=101,s=>s.weather.humidity=null,s=>s.weather.humidity='8',s=>delete s.weather];
 for(const change of changes){
  const b=structuredClone(battle);change(b);assert.throws(()=>validateBattleSnapshot(b));
  const c=structuredClone(campaign);change(c.pendingBattle);assert.throws(()=>restoreCampaign(serializeCampaign(c)));
 }
 for(const sectorId of ['missing','__proto__','constructor'])assert.throws(()=>validateBattleSnapshot({...battle,sectorId}));
});

test('unmarked custom encounters keep their explicitly authored weather as the clock advances',()=>{
 for(const regionalWeather of [undefined,false]){
  const state=field('retiro',0,{}, {regionalWeather,weather:{rain:17,humidity:4}});
  assert.deepEqual(state.weather,{rain:17,humidity:4});advanceBattleClock(state,24*3600);
  assert.deepEqual(state.weather,{rain:17,humidity:4});assert.doesNotThrow(()=>validateBattleSnapshot(state));
 }
});

test('failed tactical and campaign orders do not advance weather, clock or combat randomness',()=>{
 const state=field('retiro',transitionHour()-1,{}, {secondOfHour:3599}),before=structuredClone(state);
 const rejected=actBattle(state,{type:'move',unitId:'p',x:-1,y:1});assert.ok(rejected.lastError);
 assert.deepEqual(state,before);
 for(const key of ['weather','seed','elapsedSeconds','startSeconds','units','tiles'])assert.deepEqual(rejected[key],state[key]);
 const c=order(initialCampaign(),{type:'visitSector'}),invalid=dispatchCampaign(c,{type:'attack',sector:'san_nicolas'});
 assert.ok(invalid.lastError);assert.deepEqual({...invalid,lastError:null},c);
});

test('regional rain and humidity change actual flintlock failure while preserving a failed charge',()=>{
 const hour=wetAndDryHour(),extra={exploration:false,enemies:[{id:'e',x:3,y:1,weapon:1813,overwatch:false,patrol:false}]};
 const wet=field('tucuman',hour,{},extra),dry=field('mendoza',hour,{},extra);
 assert.ok(ignitionRisk(wet,wet.units[0])>ignitionRisk(dry,dry.units[0]));
 const rainShot=act(wet,{type:'fire',targetId:'e'}),dryShot=act(dry,{type:'fire',targetId:'e'});
 assert.equal(rainShot.units[0].jammed,true);assert.equal(rainShot.units[0].loaded,1);assert.equal(rainShot.units[0].ammo,3);
 assert.equal(dryShot.units[0].jammed,false);assert.equal(dryShot.units[0].loaded,0);assert.equal(dryShot.units[0].ammo,3);
 assert.ok(rainShot.units[0].ap<wet.units[0].ap);assert.ok(dryShot.units[0].ap<dry.units[0].ap);
});

test('a serviceable poncho prevents the rain AP penalty without granting a dry-weather bonus',()=>{
 const hour=wetAndDryHour(),wet=field('tucuman',hour),dry=field('mendoza',hour),bare=wet.units[0],covered={...bare,outfit:makeOutfit('poncho',100)};
 assert.equal(maxActionPoints(wet,covered)-maxActionPoints(wet,bare),10);
 assert.equal(maxActionPoints(dry,covered),maxActionPoints(dry,bare));
 assert.equal(maxActionPoints(wet,{...covered,outfit:makeOutfit('poncho',0)}),maxActionPoints(wet,bare));
});

test('heavy regional rain shortens a newly used torch and still consumes one real item',()=>{
 const hour=wetAndDryHour(),use=sector=>{
  let state=field(sector,hour,{torches:2});state.units[0].ap=1;
  state=act(state,{type:'weapon',slot:'supply',supplyKey:'torches'});
  return act(state,{type:'useItem',x:2,y:1});
 };
 const wet=use('tucuman'),dry=use('mendoza');
 assert.equal(wet.lights.length,1);assert.equal(dry.lights.length,1);
 assert.equal(dry.lights[0].remainingSeconds-wet.lights[0].remainingSeconds,4*600);
 for(const state of [wet,dry]){assert.equal(state.units[0].torches,1);assert.equal(state.units[0].ap,1);assert.doesNotThrow(()=>validateBattleSnapshot(state));}
});

test('exploration movement through a regional weather transition spends energy but no AP',()=>{
 const state=field('retiro',transitionHour()-1,{}, {secondOfHour:3599});state.units[0].ap=0;
 const moved=act(state,{type:'move',x:4,y:1});
 assert.equal(moved.mode,'exploration');assert.equal(moved.units[0].x,4);assert.equal(moved.units[0].ap,0);
 assert.ok(moved.units[0].energy<state.units[0].energy);assert.ok(moved.elapsedSeconds>0);
 assert.deepEqual(moved.weather,currentWeather(moved));assert.notDeepEqual(moved.weather,state.weather);
 assert.doesNotThrow(()=>validateBattleSnapshot(moved));
 const campaign=order(initialCampaign(),{type:'visitSector'}),entered=prepareCampaignBattle(campaign).battle,unit=entered.units[0];unit.ap=0;
 const destination=getReachable(entered,unit).find(cell=>cell.path.length===1);assert.ok(destination);
 const walked=actBattle(entered,{type:'move',unitId:unit.id,x:destination.x,y:destination.y});
 assert.equal(walked.lastError,null);assert.equal(walked.mode,'exploration');assert.equal(walked.units[0].ap,0);
 assert.ok(walked.units[0].energy<unit.energy);
});
