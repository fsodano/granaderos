// Transient presentation is separate from campaign/save state. Recording never
// changes orders, randomness, AP, visibility or the returned authoritative state.
let recorder=null;
export function recordBattleFrame(state,event){recorder?.(state,event);}
// Reuse unchanged branches between frames. Tiles and buildings normally share
// one copy; a breach still receives its own snapshot at the correct instant.
function snapshot(value,previous){
 if(value===null||typeof value!=='object')return value;
 const keys=Object.keys(value),sameKind=previous&&typeof previous==='object'&&Array.isArray(value)===Array.isArray(previous);
 let same=Boolean(sameKind&&keys.length===Object.keys(previous).length);
 const next=Array.isArray(value)?[]:{};
 for(const key of keys){next[key]=snapshot(value[key],sameKind?previous[key]:undefined);if(!sameKind||next[key]!==previous[key])same=false;}
 return same?previous:next;
}
const bodies=state=>[...state.units,...(state.npcs??[])];
function visibleSignature(state,visible){return JSON.stringify(bodies(state).filter(u=>u.side==='player'||visible.has(u.id)).map(u=>[u.id,u.x,u.y,u.tacticalLevel,u.hp,u.energy,u.loaded,u.stance,u.unconscious,u.departure,u.fled]));}
export function captureBattlePresentation(before,execute,canObserve){
 const frames=[],parent=recorder;let prior=before,lastSignature=null;
 const visibleIn=s=>new Set(s.units.filter(u=>u.side==='player'||canObserve(s,u)).map(u=>u.id));
 const knownIn=s=>new Set(bodies(s).filter(u=>u.side==='player'||canObserve(s,u)).map(u=>u.id));
 lastSignature=visibleSignature(before,knownIn(before));
 recorder=(state,event)=>{
  const visible=visibleIn(state),known=knownIn(state),signature=visibleSignature(state,known),seen=visible.has(event.unitId);
  if(!seen&&signature===lastSignature)return;
  if(event.type==='prepare'&&!seen)return;
  const impacts=bodies(state).filter(u=>known.has(u.id)).flatMap(u=>{const before=bodies(prior).find(old=>old.id===u.id),loss=before?before.hp-u.hp:0;return loss>0?[{unitId:u.id,x:u.x,y:u.y,tacticalLevel:u.tacticalLevel,damage:loss,fatal:u.hp===0}]:[];});
  const target=event.targetId?bodies(state).find(u=>u.id===String(event.targetId)&&known.has(u.id)):null;
  const current=snapshot(state,prior);prior=current;lastSignature=signature;
  frames.push({state:current,visibleIds:[...visible],unitId:seen?event.unitId:null,type:event.type,action:event.action,impacts,...(event.performed===false?{performed:false}:{}),...(target?{targetPoint:{id:target.id,x:target.x,y:target.y,tacticalLevel:target.tacticalLevel}}:{}),...(event.grenadeVisual&&seen?{grenadeVisual:snapshot(event.grenadeVisual)}:{}),...(event.knifeVisual&&seen?{knifeVisual:snapshot(event.knifeVisual)}:{})});
 };
 try{const state=execute();return {state,frames};}finally{recorder=parent;}
}
