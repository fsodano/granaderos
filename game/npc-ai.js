import {propCells} from './props.js';
import {directionTo, approximateHeardPosition} from './npc-perception.js';

// Local, deterministic state machines. No network, hidden enemy positions or RNG.
export const NPC_ACTIVITIES = ['roaming','home','working','socializing','hiding','fleeing'];
export const NPC_ACTIVITY_LABELS = {roaming:'paseando',home:'en casa',working:'trabajando',socializing:'en la pulpería',hiding:'a cubierto',fleeing:'buscando refugio'};
const key = p => `${p.x},${p.y}`;
const point = p => ({x:p.x,y:p.y});
const distance = (a,b) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const hash = value => [...String(value)].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,17);
const mobile = n => (n.hp??100)>0&&!n.unconscious&&!n.departure&&!n.surrendered;
const now = s => s.elapsedSeconds??0;

// Cardinal routes cannot cut corners. Unlocked doors are usable, but opening
// one is a separate paid step. Occupancy is rebuilt for each actor.
export function npcRoutes(s,n) {
  const tiles=new Map(s.tiles.map(t=>[key(t),t]));
  const occupied=new Set([...(s.npcs??[]).filter(v=>v!==n&&v.id!==n.id&&mobile(v)),...s.units.filter(v=>v.id!==n.id&&v.hp>0&&!v.departure&&!v.unconscious)].map(key));
  for(const p of s.props??[])if(p.blocksMovement!==false)for(const cell of propCells(p))occupied.add(key(cell));
  const usable=t=>t&&!occupied.has(key(t))&&(!t.blocked||t.type==='door'&&!t.locked&&!t.jammed);
  const records=new Map([[key(n),{...point(n),path:[]}]]),queue=[point(n)];
  for(let i=0;i<queue.length;i++){
    const from=queue[i],record=records.get(key(from));
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
      const at={x:from.x+dx,y:from.y+dy},id=key(at);
      if(records.has(id)||!usable(tiles.get(id)))continue;
      records.set(id,{...at,path:[...record.path,at]});queue.push(at);
    }
  }
  return {records,tiles};
}

function destinations(s,n,routes) {
  const cells=[...routes.records.values()].filter(p=>routes.tiles.get(key(p))?.type!=='door');
  const inside=id=>cells.filter(p=>routes.tiles.get(key(p))?.buildingId===id&&routes.tiles.get(key(p))?.roomId);
  const houses=(s.buildings??[]).filter(b=>b.purpose!=='bar'&&inside(b.id).length);
  const bars=(s.buildings??[]).filter(b=>b.purpose==='bar'&&inside(b.id).length);
  n.ai.homeId??=houses.length?houses[hash(n.id)%houses.length].id:null;
  const home=inside(n.ai.homeId),bar=bars.flatMap(b=>inside(b.id));
  const work=inside(n.workBuildingId??n.ai.homeId);
  const outside=cells.filter(p=>!routes.tiles.get(key(p))?.buildingId);
  return {home,bar,work,outside,cells};
}

export function hearNpcNoise(s,position,kind,radius,obstructions=()=>0) {
  if(!['fire','explosion','alarm'].includes(kind))return;
  for(const n of s.npcs??[]){
    if(!mobile(n))continue;
    const heard=approximateHeardPosition(n,position,{kind,radius,turn:s.turn,width:s.width,height:s.height,obstructions:obstructions(n),night:s.night});
    if(!heard)continue;
    n.ai??={cycle:0,homeId:null,activity:'roaming',wait:0};
    n.ai.threat=heard;n.ai.safeAfter=now(s)+24+hash(n.id)%19;
    n.ai.activity='hiding';n.ai.wait=0;delete n.ai.destination;
    n.stance=distance(n,position)<=7||kind==='explosion'?'prone':'crouched';
    n.movementMode=n.stance==='prone'?'prone':'crouch';
  }
}

function shelterScore(s,p,threat,tiles) {
  const t=tiles.get(key(p));
  let walls=0;
  // Trace only the remembered sound area, never a shooter's live position.
  const count=Math.max(Math.abs(p.x-threat.x),Math.abs(p.y-threat.y));
  for(let i=1;i<count;i++){
    const cell=tiles.get(`${Math.round(p.x+(threat.x-p.x)*i/count)},${Math.round(p.y+(threat.y-p.y)*i/count)}`);
    if(cell?.blocksSight??cell?.blocked)walls++;
  }
  return Math.min(walls,2)*24+(t?.roomId?14:0)+(t?.cover??0)*.4+Math.min(20,distance(p,threat))*2-p.path.length*1.5;
}

export function advanceNpc(s,n,budget=24,atTime=now(s)) {
  if(!mobile(n))return;
  n.ai??={cycle:0,homeId:null,activity:'roaming',wait:0};
  const ai=n.ai;n.lastMovePath=[];
  const danger=ai.threat&&atTime<ai.safeAfter;
  if(!danger&&s.approachingNpcIds?.includes(n.id))return;
  if(!danger&&ai.threat){delete ai.threat;delete ai.safeAfter;delete ai.destination;ai.wait=0;}
  // Conference speakers remain available at their meeting while it is safe.
  // They still take shelter through the ordinary danger branch.
  if(n.mission&&!danger){
    ai.activity='working';delete ai.destination;n.stance='standing';n.movementMode='walk';
    const visitor=s.units.find(u=>u.side==='player'&&u.hp>0&&!u.departure&&!u.unconscious&&distance(u,n)<=1);
    if(visitor)n.facing=directionTo(n,visitor);
    return;
  }
  const routes=npcRoutes(s,n),places=destinations(s,n,routes);
  if(danger){
    const choices=places.cells.filter(p=>p.path.length<=8).sort((a,b)=>shelterScore(s,b,ai.threat,routes.tiles)-shelterScore(s,a,ai.threat,routes.tiles)||a.y-b.y||a.x-b.x);
    ai.destination=point(choices[0]??n);ai.activity=distance(n,ai.destination)?'fleeing':'hiding';
    n.stance??='crouched';n.movementMode=n.stance==='prone'?'prone':'crouch';
  }else{
    n.stance='standing';n.movementMode='walk';
    const visitor=s.units.find(u=>u.side==='player'&&u.hp>0&&!u.departure&&!u.unconscious&&distance(u,n)<=1);
    if(visitor){n.facing=directionTo(n,visitor);return;}
    if(ai.wait>0){ai.wait--;return;}
    if(!ai.destination||!routes.records.has(key(ai.destination))){
      const hour=((s.startSeconds??43200)+atTime)/3600%24;
      const activity=hour<6||hour>=22?'home':['roaming','working','socializing','home'][(ai.cycle+hash(n.id))%4];
      let choices=activity==='home'?places.home:activity==='socializing'?places.bar:activity==='working'?places.work:places.outside;
      if(!choices.length)choices=places.outside.length?places.outside:places.cells;
      const other=choices.filter(p=>distance(n,p)>0);if(other.length)choices=other;
      const target=choices[(hash(n.id)+ai.cycle*7)%choices.length];
      ai.activity=activity==='socializing'&&!places.bar.length?'roaming':activity;
      if(!target)return;ai.destination=point(target);
    }
  }
  const route=routes.records.get(key(ai.destination));
  if(!route){delete ai.destination;return;}
  for(const p of route.path){
    const t=routes.tiles.get(key(p)),cost=n.stance==='prone'?16:n.stance==='crouched'?10:8;
    if(t.type==='door'&&!t.open){
      if(budget<6)break;
      if(t.trap&&t.trap.armed!==false){
        t.trap.armed=false;
        if(t.trap.type==='alarm')hearNpcNoise(s,t,'alarm',20);
        else {n.hp=Math.max(0,(n.hp??100)-(t.trap.damage??18));n.energy=Math.max(0,(n.energy??100)-(t.trap.breathLoss??25));n.unconscious=n.hp<15||n.energy<=0;}
        // Triggering a trap spends this attempt; it never silently opens a door
        // or discloses the trap to either combat faction.
        break;
      }
      t.open=true;t.blocked=false;t.blocksSight=false;budget-=6;
    }
    if(budget<cost)break;
    budget-=cost;n.facing=directionTo(n,p);Object.assign(n,p);n.lastMovePath.push(point(p));
  }
  if(distance(n,ai.destination)===0){
    if(danger)ai.activity='hiding';
    else {ai.cycle++;ai.wait=2+hash(n.id+ai.cycle)%4;delete ai.destination;}
  }
}

export function runCivilianPhase(s,atTime=now(s)) {
  // Atomic third phase: it cannot grant combat AP or create an interrupt.
  const phase=s.phase;s.phase='civilian';
  s.civilianTurns=(s.civilianTurns??0)+1;
  const npcs=s.npcs??[],offset=s.civilianTurns%Math.max(1,npcs.length);
  for(let i=0;i<npcs.length;i++)advanceNpc(s,npcs[(i+offset)%npcs.length],24,atTime);
  s.phase=phase;
}

export function advanceCivilianTime(s,seconds,beforeCivilians=()=>true) {
  s.civilianSeconds=(s.civilianSeconds??0)+seconds;
  // The same six-second cadence is used for one long walk or separate steps.
  while(s.civilianSeconds>=6){s.civilianSeconds-=6;if(beforeCivilians()===false){s.civilianSeconds=0;break;}runCivilianPhase(s,now(s)-s.civilianSeconds);}
}
