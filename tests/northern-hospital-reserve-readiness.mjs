import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../packages/game/campaign.js';
import {operativeLocation,operativeInTransit} from '../packages/game/squads.js';
import {careAssignmentIssue} from '../packages/game/medical-care.js';
import {contractRenewalQuote,contractExpiresSeconds} from '../packages/game/contracts.js';
import {sectorInventoryModel,sectorInventorySites} from '../packages/game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../packages/game/tactical-inventory.js';
import {WEAPONS} from '../packages/game/data.js';
import {enterSector} from '../packages/game/world.js';
import {actBattle,getReachable} from '../packages/game/tactical.js';
import {sameCell,sameSurface,spacePoint} from '../packages/game/tactical-space.js';
import {syncBattleTime} from '../packages/game/time.js';

const clock=c=>c.hour*3600+(c.secondOfHour??0);

// Finish the actual local reserve inside the hospital's EXISTING absolute
// recovery deadline. No arrival threat, new service, discovery or remote stock
// is assumed. A quoted source remains finite and must accept its Native take.
export function prepareNorthernHospitalReserveReadiness(start,{sector,ids,deadlineSeconds,resolveEncounter,report=()=>{}}){
 assert.ok(typeof sector==='string'&&Array.isArray(ids)&&ids.length&&new Set(ids).size===ids.length);
 assert.ok(Number.isSafeInteger(deadlineSeconds));
 const before=structuredClone(start),selected=start.activeSquadId,orders=[],renewals=[],ticks=[],dressings=[],firearms=[],visits=[],encounters=[];
 let c=start,battle=null;
 const local=id=>c.recruited.includes(id)&&c.operativeState[id]?.alive&&!c.operativeState[id].captured&&!operativeInTransit(c,id)&&operativeLocation(c,id)===sector;
 const present=()=>ids.filter(local),injured=()=>present().filter(id=>c.operativeState[id].bleeding||c.operativeState[id].hp<c.operativeState[id].maxHp);
 const check=()=>{assert.equal(c.defeated,false);assert.equal(c.sectors[sector]?.owner,'patriot');assert.ok(clock(c)<=deadlineSeconds,'Local reserve readiness exhausted the existing hospital recovery deadline.');};
 const settle=()=>{
  assert.equal(c.pendingBattle,null,'Finish the actual open reserve visit before another strategic order.');
  if(!c.pendingEncounter)return;
  assert.equal(typeof resolveEncounter,'function','Resolve the actual hospital return interruption before reserve care continues.');
  const pending=structuredClone(c.pendingEncounter);c=resolveEncounter(c);encounters.push(pending);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);check();
 };
 const order=action=>{
  settle();check();if(action.type==='wait')assert.ok(clock(c)+action.hours*3600<=deadlineSeconds,'The next actual care hour exceeds the existing hospital deadline.');
  const from=clock(c),cash=c.resources.treasury;c=dispatchCampaign(c,action);orders.push({kind:'campaign',action:structuredClone(action),from,to:clock(c),cost:cash-c.resources.treasury});assert.equal(c.lastError,null,JSON.stringify(action)+': '+c.lastError);check();if(action.type!=='visitSector')settle();
 };
 const retain=until=>{
  for(const id of c.recruited){const r=c.operativeState[id];if(!r.alive||r.captured)continue;let expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)),'Preserve actual serving hospital and field duties before local preparation.');
   for(let n=0;expiry!==null&&expiry<=until;n++){
    assert.ok(n<2,'A bounded readiness step cannot require an unbounded renewal loop.');const op=rosterFor(c).find(op=>op.id===id),quote=contractRenewalQuote(c,op,'day'),contract=c.contracts[id];assert.equal(quote.available,true,quote.reason);assert.ok(c.resources.treasury>=quote.price,'Actual reserve readiness needs funded existing service.');
    order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(contractExpiresSeconds(c.contracts[id]),expiry+quote.hours*3600);renewals.push({id,quote:structuredClone(quote)});expiry=contractExpiresSeconds(c.contracts[id]);
   }
  }
 };
 const model=(id,site=sector)=>sectorInventoryModel(c,site,rosterFor(c),id);
 const sources=(id,predicate)=>sectorInventorySites(c,sector).flatMap(site=>{const view=model(id,site.id);return view.operativeId===id&&!view.reason?view.entries.filter(row=>row.reachable&&row.count>0&&predicate(JSON.parse(row.expected))).map(row=>({site:site.id,row})):[];});
 const supply=(id,protectedDoctors)=>{
  if(c.operativeState[id].medkits>0)return;
  const recipient=model(id);assert.equal(recipient.operativeId,id);assert.equal(recipient.reason,null,recipient.reason);applyItemQuantity(recipient.personal,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight});
  let source=sources(id,stack=>stack.item==='medkits')[0];
  if(!source){
   const donor=present().find(other=>other!==id&&c.operativeState[other].medkits>(protectedDoctors.includes(other)?1:0)&&model(other).operativeId===other&&!model(other).reason);
   if(donor!==undefined){
    const known=new Set(model(id).entries.map(row=>row.key));order({type:'sectorInventory',sector,operativeId:donor,direction:'drop',item:'medkits',count:1});
    const row=model(id).entries.find(row=>!known.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits');assert.ok(row,'The local physician must actually reach the finite donated dressing.');source={site:sector,row};dressings.push({kind:'donation',donor,recipient:id,count:1,sourceKey:row.key});
   }
  }
  assert.ok(source,'No admitted reachable finite local dressing is available for hospital reserve readiness.');
  const stock=c.operativeState[id].medkits;order({type:'sectorInventory',sector:source.site,operativeId:id,direction:'take',sourceKey:source.row.key,expected:source.row.expected,count:1});assert.equal(c.operativeState[id].medkits,stock+1);assert.equal(model(id,source.site).entries.find(row=>row.key===source.row.key)?.count??0,source.row.count-1);dressings.push({kind:'take',recipient:id,site:source.site,count:1,sourceKey:source.row.key});
 };
 try{
  settle();check();assert.ok(ids.every(local),'Only actual serving local reserve members enter this preparation.');assert.ok(ids.every(id=>c.operativeState[id].hp>=15&&!c.operativeState[id].bleeding),'Stop actual acute wounds before local hospital readiness.');
  const required=[...ids],maximumCareAttempts=Math.max(1,Math.ceil((deadlineSeconds-clock(start))/3600)*3),field=Object.fromEntries(start.squads.filter(q=>q.members.length&&q.location!==sector).map(q=>[q.id,{members:[...q.members],location:q.location,traveling:Boolean(q.journey)}]));
  let zeroTime=0;
  for(let pass=0;injured().length;pass++){
   assert.ok(pass<maximumCareAttempts,'Local readiness has only its remaining hospital hours and bounded Native attention retries.');settle();check();assert.ok(required.every(local),'Every actual reserve survivor remains living and serving.');
   const patients=injured(),roster=rosterFor(c),doctors=roster.filter(op=>present().includes(op.id)&&patients.some(id=>id!==op.id)&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>Number(patients.includes(a.id))-Number(patients.includes(b.id))||b.medical-a.medical||a.id-b.id).slice(0,patients.length).map(op=>op.id);
   if(patients.every(id=>doctors.includes(id)))doctors.splice(doctors.indexOf(patients.at(-1)),1);
   if(!doctors.length)assert.ok(roster.some(op=>present().includes(op.id)&&patients.some(id=>id!==op.id)&&careAssignmentIssue(c,op,'doctor')?.code==='sleeping'),'Actual local reserve patients need an admitted stable serving colleague.');
   for(const id of doctors)supply(id,doctors);
   for(const id of present())order({type:'assignCare',operativeId:id,assignment:doctors.includes(id)?'doctor':doctors.length&&patients.includes(id)?'patient':'rest'});
   retain(clock(c)+2*3600);const from=clock(c),stock=doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0),hp=patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding}));
   order({type:'wait',hours:1});const used=stock-doctors.reduce((n,id)=>n+c.operativeState[id].medkits,0);assert.ok(used>=0&&used<=doctors.length);zeroTime=clock(c)===from?zeroTime+1:0;assert.ok(zeroTime<3,'Actual reserve care cannot loop on unchanged zero-time attention.');
   ticks.push({from,to:clock(c),doctors,before:hp,after:patients.map(id=>({id,hp:c.operativeState[id].hp,bleeding:c.operativeState[id].bleeding})),usedDressings:used});
  }
  // Keep one real dressing on each current qualified colleague for later aid.
  const reserveDoctors=rosterFor(c).filter(op=>present().includes(op.id)&&[undefined,'no_medkits'].includes(careAssignmentIssue(c,op,'doctor')?.code)).sort((a,b)=>b.medical-a.medical||a.id-b.id).slice(0,2).map(op=>op.id);
  for(const id of reserveDoctors)supply(id,reserveDoctors);
  for(const id of present())order({type:'assignCare',operativeId:id,assignment:'rest'});
  for(const id of present().filter(id=>c.operativeState[id].weaponDropped)){
   const view=model(id);assert.equal(view.operativeId,id);assert.equal(view.reason,null,view.reason);
   const matches=row=>row.expected&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0;
   let carried=view.carried.find(row=>matches(row)&&row.equip?.some(option=>option.slot==='primary'&&option.valid));
   if(!carried){const source=sources(id,stack=>WEAPONS[stack.weapon]?.capacity>0).find(({row})=>{try{applyItemQuantity(view.personal,{...JSON.parse(row.expected),count:1});return true;}catch{return false;}});
    if(source){const keys=new Set(Object.keys(view.personal.inventory??{}));order({type:'sectorInventory',sector:source.site,operativeId:id,direction:'take',sourceKey:source.row.key,expected:source.row.expected,count:1});carried=model(id).carried.find(row=>matches(row)&&!keys.has(row.inventoryKey)&&row.equip?.some(option=>option.slot==='primary'&&option.valid));assert.ok(carried);}
   }
   if(carried){const stock=JSON.parse(carried.expected);order({type:'sectorInventory',sector,operativeId:id,direction:'equip',slot:'primary',inventoryKey:carried.inventoryKey,expected:carried.expected});assert.equal(Boolean(c.operativeState[id].weaponDropped),false);firearms.push({id,recovered:true,stock});}
   else firearms.push({id,recovered:false,reason:'no-known-reachable-finite-primary'});
  }
  const ground=present().filter(id=>(c.operativeState[id].residentPosition?.tacticalLevel??0)===0&&!c.operativeState[id].asleep&&c.operativeState[id].energy>10),posts=c.recruited.filter(id=>local(id)&&!ground.includes(id)&&c.operativeState[id].residentPosition).map(id=>({id,position:structuredClone(c.operativeState[id].residentPosition)}));
  if(ground.length){
   const groups=[...new Set(ground.map(id=>c.squads.find(q=>q.members.includes(id))?.id))];assert.ok(groups.every(Boolean),'Every ground guard needs its actual local reserve squad.');
   for(const squadId of groups){
   const members=c.squads.find(q=>q.id===squadId).members,staged=ground.filter(id=>members.includes(id));assert.ok(members.length<=6&&members.every(id=>required.includes(id)),'Only the actual bounded local reserve enters its existing squad visit.');retain(clock(c)+3600);const until=Math.min(deadlineSeconds,clock(c)+3600);
   if(c.activeSquadId!==squadId)order({type:'selectSquad',id:squadId});for(const id of members)order({type:'assignCare',operativeId:id,assignment:'active'});order({type:'visitSector'});battle=enterSector(c.pendingBattle,c.sectorStates[sector]);const initial=structuredClone(battle),steps=[],positions=[];
   const act=action=>{
    const actor=battle.units.find(u=>u.id===action.unitId),path=action.type==='move'?getReachable(battle,actor,{stopAt:p=>sameCell(p,action)})[0]?.path:null;if(action.type==='move')assert.ok(path);
    assert.ok(clock(c)+(path?path.length*6:6)<=until,'Actual roof preparation must fit the existing paid hospital deadline.');battle=actBattle(battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);steps.push(structuredClone(action));orders.push({kind:'battle',action:structuredClone(action)});
    const synced=syncBattleTime(c,battle);assert.equal(synced.error,null);c=synced.campaign;battle=synced.battle;check();assert.equal(c.pendingEncounter,null,'A real raid stops the actual open reserve visit.');assert.equal(battle.status,'active');assert.equal(battle.phase,'player');assert.equal(battle.mode,'exploration');
   };
   for(const id of staged){
    const unitId=String(id),actor=()=>battle.units.find(u=>u.id===unitId),roof=posts.filter(row=>row.position.tacticalLevel>0).map(row=>row.position);
    const destination=getReachable(battle,actor()).filter(p=>p.tacticalLevel>0&&![...posts.map(row=>row.position),...positions].some(other=>sameCell(p,other))).map(p=>({...p,near:[...roof,...positions].filter(other=>sameSurface(other,p)&&Math.hypot(other.x-p.x,other.y-p.y)<=1.5).length})).sort((a,b)=>b.near-a.near||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];assert.ok(destination&&(!roof.length||destination.near>0),'Actual ground reserve needs a vacant reachable roof beside its existing posts.');
    act({type:'movement',unitId,movement:'walk'});for(let leg=0;!sameCell(actor(),destination)&&leg<64;leg++){const from=spacePoint(actor());act({type:'move',unitId,...spacePoint(destination)});assert.notDeepEqual(spacePoint(actor()),from);}assert.ok(sameCell(actor(),destination));act({type:'stance',unitId,stance:'crouched'});positions.push({id,...spacePoint(actor())});
   }
   const returned=structuredClone(battle),action={type:'leaveSector',battleId:c.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')};c=dispatchCampaign(c,action);assert.equal(c.lastError,null);orders.push({kind:'campaign',action:structuredClone(action),from:clock(c),to:clock(c),cost:0});battle=null;settle();
   for(const post of posts)assert.deepEqual(c.operativeState[post.id].residentPosition,post.position,'Every prior local roof post remains unchanged.');
   visits.push({initial,steps,returned,positions});for(const id of members)order({type:'assignCare',operativeId:id,assignment:'rest'});
   }
  }
  if(c.activeSquadId!==selected)order({type:'selectSquad',id:selected});
  assert.ok(required.every(local));for(const id of required){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);}
  for(const [squadId,q]of Object.entries(field)){const actual=c.squads.find(row=>row.id===squadId);assert.deepEqual(actual.members,q.members,'Keep the actual recovered field party intact.');if(!q.traveling)assert.equal(actual.location,q.location);}
  for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
  assert.deepEqual(start,before);const receipt={sector,ids:[...ids],deadlineSeconds,startSeconds:clock(start),endSeconds:clock(c),orders,renewals,ticks,dressings,firearms,visits,encounters,reserveDoctors,usedDressings:ticks.reduce((n,row)=>n+row.usedDressings,0)};report({event:'northernHospitalReserveReady',receipt});return {campaign:c,receipt};
 }catch(error){if(error?.campaign)c=error.campaign;if(error&&typeof error==='object'){error.campaign=c;error.hospitalReserveReadiness={sector,ids,deadlineSeconds,orders,renewals,ticks,dressings,firearms,visits,encounters,...(battle?{battle}:{})};}throw error;}
}
