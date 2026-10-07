// One physical ladder serves world geometry, native authoring and playback.
// Saved link cells remain the ground and roof destinations.
export const LADDER_RUNG_DISTANCE=.29;
export const LADDER_HALF_WIDTH=.23;
export const LADDER_RUNG_RADIUS=.026;
// High-detail clothed skin through the 20 cm slab, across all eight appearances
// in both directions, with clearance. The front lip retains the saved heels.
export const VERTICAL_CLIMB_HATCH=Object.freeze({minAcross:-.57,maxAcross:.57,minForward:-1.04,maxForward:-.16});
const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const phase=(t,a,b)=>ease((t-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;
export function ladderGeometry(lower,upper,tileMetres){
 const dx=upper[0]-lower[0],dz=upper[2]-lower[2],span=Math.hypot(dx,dz),forward=span>1e-6?[dx/span,0,dz/span]:[0,0,1];
 // The nearest square-cell edge is the roof support. Leave room for the
 // boot toe between the final rung and the wall under that edge.
 const inset=.5*tileMetres/Math.max(Math.abs(forward[0]),Math.abs(forward[2]));
 // A same-cell hatch sits behind the saved standing point, so its opening
 // does not remove the roof under the final heels.
 const baseSpan=span<1e-6?-.45:0,edgeSpan=span<1e-6?baseSpan:Math.max(0,span-inset),ladderSpan=span<1e-6?baseSpan:Math.max(0,edgeSpan-.10),height=upper[1]-lower[1];
 const base=[lower[0]+forward[0]*baseSpan,lower[1],lower[2]+forward[2]*baseSpan];
 const top=[lower[0]+forward[0]*ladderSpan,upper[1],lower[2]+forward[2]*ladderSpan];
 return {lower,upper,base,top,forward,span,baseSpan,edgeSpan,ladderSpan,height,hatch:span<1e-6?VERTICAL_CLIMB_HATCH:undefined,steps:Math.max(2,Math.ceil(Math.hypot(ladderSpan-baseSpan,height)/LADDER_RUNG_DISTANCE)),halfWidth:LADDER_HALF_WIDTH,rungRadius:LADDER_RUNG_RADIUS};
}
const defaultFeet={l:[.20,.007,.147],r:[-.20,.007,.147]};
/** Keep the native moving side and within-step phase on another rung count. */
export function referenceClimbFraction(geometry,fraction,reference){
 const t=Math.max(0,Math.min(1,fraction));
 if(t<=.12||t>=.76||geometry.steps===reference.steps)return t;
 const count=geometry.steps-2,nativeCount=reference.steps-2,q=(t-.12)/.64*count,step=Math.min(count-1,Math.floor(q)),within=q-step,parity=step%2;
 const estimate=(t-.12)/.64*nativeCount;
 let nativeStep=parity+2*Math.round((estimate-parity)/2);
 nativeStep=Math.max(parity,Math.min(nativeCount-1,nativeStep));
 if(nativeStep%2!==parity)nativeStep--;
 return .12+.64*(nativeStep+within)/nativeCount;
}
/** Contact coordinates use metres above the lower end and toward the roof. */
export function sampleLadderClimb(geometry,fraction,feetRest=defaultFeet){
 const t=Math.max(0,Math.min(1,fraction)),{height:H,span,ladderSpan:L,edgeSpan:E,steps:N,baseSpan:B=0}=geometry,run=L-B;
 // A less steep ladder puts the upper palms farther in front of the chest.
 // Approach the iron slightly during the supported ascent, within 8 cm.
 const setback=Math.min(.20,Math.max(.12,.33-.75*(H?run/H:0)))+(B!==0?.04*phase(t,.18,.35):0),preparation=B!==0?B:-.16;
 const rung=index=>({height:index===0?.007:H*index/N+(index===N?.022:LADDER_RUNG_RADIUS),forward:index===0?.147:B+run*index/N});
 const q=Math.max(0,Math.min(N-2,(t-.12)/.64*(N-2))),step=Math.min(N-3,Math.floor(q)),u=q-step,moving=step%2===0?'r':'l';
 const indices={l:1+2*Math.floor(step/2),r:2*Math.floor((step+1)/2)};
 const root={height:0,forward:mix(0,preparation,phase(t,0,.08))};
 if(t>=.12){root.height=Math.max(0,H-.85)*Math.min(1,(t-.12)/.64);root.forward=B+run*(H?root.height/H:0)-mix(.20,setback,phase(t,.12,.70));}
 if(t>=.76){root.height=mix(Math.max(0,H-.85),Math.max(0,H-.55),phase(t,.76,.91));root.forward=mix(B+run*(H?Math.max(0,H-.85)/H:0)-setback,E-.20,phase(t,.76,.85));}
 if(t>=.85)root.forward=mix(E-.20,E+.10,phase(t,.85,.91));
 if(t>=.91){root.height=mix(Math.max(0,H-.55),H,phase(t,.91,1));root.forward=mix(E+.10,span,phase(t,.91,1));}
 // Close the short preparation seam without moving a planted ground boot.
 if(t>=.08&&t<.12)root.forward=mix(preparation,B-.20,phase(t,.08,.12));
 /** @type {Record<string,{position:number[],planted:boolean,tilt:number,restWeight:number,roofWeight:number}>} */
 const feet={};
 /** @type {Record<string,{position:number[],planted:boolean,weight:number,roofWeight:number}>} */
 const hands={};
 for(const side of ['l','r']){
  const sign=side==='l'?1:-1,rest=feetRest[side],backStep=side==='r'&&B!==0?phase(t,0,.04):0,start={height:rest[1],forward:rest[2]+B*backStep},index=indices[side],a=index===0?start:rung(index),b=rung(Math.min(N-1,index+2));
  let height=a.height,forward=a.forward,planted=true;
  if(t<.12){
   const enter=side==='l'?phase(t,.04,.12):0;height=mix(start.height,rung(1).height,enter);forward=mix(start.forward,rung(1).forward,enter);planted=side==='r'?backStep===0||backStep===1:t<=.04||t>=.12;
   if(side==='r'&&B!==0)height+=.04*Math.sin(Math.PI*backStep);
   if(side==='l')height+=.08*Math.sin(Math.PI*enter);
  }else if(t<.76&&side===moving){const lift=phase(u,.03,.46);height=mix(a.height,b.height,lift)+.09*Math.sin(Math.PI*lift);forward=mix(a.forward,b.forward,lift);planted=u<=.03||u>=.46;}
  else if(t>=.76){height=rung(side==='l'?N-2:N-1).height;forward=rung(side==='l'?N-2:N-1).forward;}
  const roofForward=E+(B!==0?(side==='l'?.35:.55):(side==='l'?.10:.32));
  if(t>=.76){const lift=phase(t,side==='l'?.76:.85,side==='l'?.82:.91),clear=phase(lift,0,.55),step=phase(lift,.55,1);height=lift<=.55?mix(height,H+.15,clear):mix(H+.15,H+.007,step);forward=mix(forward-.04*Math.sin(Math.PI*clear),roofForward,step);planted=lift===0||lift===1;}
  let spread=phase(t,.04,.12);
  if(side==='r'&&t<.12)spread=0;else if(side==='r'&&step===0&&t<.76)spread=phase(u,.03,.46);
  let footX=mix(rest[0],sign*.13,spread);
  const finish=phase(t,side==='l'?.91:.96,side==='l'?.96:1);
  if(t>=.91){height=H+mix(.007,rest[1],finish)+.10*Math.sin(Math.PI*finish);forward=mix(roofForward,span+rest[2],finish);footX=mix(sign*.13,rest[0],finish);planted=finish===0||finish===1;}
  const lifted=side==='r'&&step===0&&t<.76?phase(u,.03,.46):side==='r'&&t<.12?0:phase(t,.06,.12);
  const entering=side==='l'?phase(t,.04,.12):t<.12?0:step===0?phase(u,.03,.46):1;
  const roofWeight=phase(t,side==='l'?.76:.85,side==='l'?.82:.91);
  feet[side]={position:[footX,height,forward],planted,tilt:10*lifted*(1-roofWeight),restWeight:t>=.91?finish:1-entering,roofWeight};
  const handA=rung(Math.min(N,index+4)),handB=rung(Math.min(N,index+6)),advance=side===moving?phase(u,.55,.94):0;
  let hand={roofWeight:0,position:[sign*.15,mix(handA.height,handB.height,advance),mix(handA.forward,handB.forward,advance)],planted:side!==moving||u<=.55||u>=.94,weight:phase(t,0,.10)*(1-phase(t,.91,.98))};
  if(t>=.76){const reach=phase(t,side==='l'?.82:.84,side==='l'?.84:.86);hand.position=[sign*.15,H+mix(.022,.055,reach)+.10*Math.sin(Math.PI*reach),mix(L,E+.40,reach)];hand.planted=reach===0||reach===1;hand.roofWeight=reach;}
  hands[side]=hand;
 }
 return {fraction:t,root,feet,hands,lean:(.20+.25*phase(t,.76,.83))*phase(t,.02,.12)*(1-phase(t,.91,1)),crouch:.07*phase(t,.70,.83)*(1-phase(t,.91,1)),kneeRise:.70*phase(t,.60,.72)*(1-phase(t,.91,1))};
}
