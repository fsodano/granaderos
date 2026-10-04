import {rayHeightIntersection} from './sight-geometry.js';

const epsilon=1e-10;

// All dimensions are Granaderos tactical tuning. The original aim slope is
// unchanged through two effective ranges. This pure shape reads no world data.
export function projectileTrajectory(source,destination,{range,dropIncrement=0,travelledDistance=0}={}){
 const horizontalDistance=Math.hypot(destination.x-source.x,destination.y-source.y),rise=destination.height-source.height;
 const dropStart=Number.isFinite(range)&&range>0&&horizontalDistance?Math.max(0,(2*range-travelledDistance)/horizontalDistance):1;
 const curvature=dropStart<1&&dropIncrement>0?dropIncrement*horizontalDistance**2/(4*range):0;
 return {source,destination,horizontalDistance,rise,dropStart,curvature};
}

// Vertical slope at a physical point, per horizontal tactical unit. A vertical
// face changes XY direction only; the next leg retains this exact derivative.
export function projectileTrajectorySlope(model,fraction){
 return model.horizontalDistance?(model.rise-2*model.curvature*Math.max(0,fraction-model.dropStart))/model.horizontalDistance:0;
}

export function projectileTrajectoryPoint(model,fraction,level=model?.destination?.tacticalLevel){
 if(!model?.source||!model.destination||![model.source.x,model.source.y,model.source.height,model.destination.x,model.destination.y,model.destination.height,model.rise,model.dropStart,model.curvature,fraction].every(Number.isFinite)||fraction<0||fraction>1||model.curvature<0)return null;
 const {source,destination,rise,dropStart,curvature}=model,beyond=Math.max(0,fraction-dropStart);
 return {x:source.x+(destination.x-source.x)*fraction,y:source.y+(destination.y-source.y)*fraction,height:source.height+rise*fraction-curvature*beyond*beyond,tacticalLevel:level};
}

// Clip the exact height curve to a column's vertical volume. Roots and the
// turning point partition it into monotonic spans; tangent contacts are kept
// as zero-depth intervals for hard slabs/ground, never material force loss.
export function projectileTrajectoryIntervals(model,cell,bottom,top,limit=1){
 if(!model.curvature){const hit=rayHeightIntersection(model.source.height,model.destination.height,cell,bottom,top,limit);return hit?[hit]:[];}
 if(![bottom,top,limit].every(Number.isFinite))return [];
 const entry=Math.max(0,cell.entry),exit=Math.min(1,limit,cell.exit);if(exit<entry-epsilon)return [];
 const {rise,dropStart,curvature,source}=model,points=[entry,exit];
 const add=value=>{if(Number.isFinite(value)&&value>=entry-epsilon&&value<=exit+epsilon)points.push(Math.max(entry,Math.min(exit,value)));};
 add(dropStart);add(dropStart+rise/(2*curvature));
 for(const boundary of [bottom,top]){
  if(rise){const root=(boundary-source.height)/rise;if(root<=dropStart+epsilon)add(root);}
  const a=-curvature,b=rise+2*curvature*dropStart,c=source.height-curvature*dropStart**2-boundary,discriminant=b*b-4*a*c;
  if(discriminant<0)continue;
  const root=Math.sqrt(discriminant),q=-.5*(b+(b>=0?root:-root));
  for(const value of q===0?[-b/(2*a)]:[q/a,c/q])if(value>=dropStart-epsilon)add(value);
 }
 points.sort((a,b)=>a-b);const unique=points.filter((point,i)=>!i||point-points[i-1]>Number.EPSILON*8);
 const inside=fraction=>{const z=projectileTrajectoryPoint(model,fraction).height;return z>=bottom-epsilon&&z<=top+epsilon;},spans=[];
 for(let i=0;i<unique.length;i++){
  const start=unique[i],end=unique[i+1];
  if(end!==undefined&&inside((start+end)/2))spans.push({entry:start,exit:end});
  else if(inside(start))spans.push({entry:start,exit:start});
 }
 const merged=[];
 for(const span of spans){const last=merged.at(-1);if(last&&span.entry<=last.exit+epsilon)last.exit=Math.max(last.exit,span.exit);else merged.push({...span});}
 return merged;
}

// Exact three-dimensional arc length, including the original straight part.
// It is used for force loss, so sampling density cannot change penetration.
export function projectileTrajectoryLength(model,from=0,to=1){
 const {horizontalDistance:distance,rise,dropStart,curvature}=model;
 if(!curvature)return Math.max(0,to-from)*Math.hypot(distance,rise);
 let length=0;const straightEnd=Math.min(to,dropStart);
 if(from<straightEnd)length+=(straightEnd-from)*Math.hypot(distance,rise);
 const start=Math.max(from,dropStart);
 if(to>start){
  const primitive=v=>.5*(v*Math.hypot(distance,v)+distance*distance*Math.asinh(v/distance));
  const derivative=t=>rise-2*curvature*(t-dropStart);
  length+=(primitive(derivative(start))-primitive(derivative(to)))/(2*curvature);
 }
 return Math.max(0,length);
}

// Monotonic arc-length inverse. Sixty bisections bound the fraction error at
// double precision and never advance beyond the current physical event.
export function projectileTrajectoryAdvance(model,from,to,distance){
 const length=projectileTrajectoryLength(model,from,to);if(distance>=length)return to;
 if(!model.curvature)return from+distance/Math.hypot(model.horizontalDistance,model.rise);
 let low=from,high=to;
 for(let i=0;i<60;i++){const mid=(low+high)/2;if(projectileTrajectoryLength(model,from,mid)<distance)low=mid;else high=mid;}
 return (low+high)/2;
}

// Inspection metadata only. Actual intersections and near-miss checks use the
// exact model above. Every chord's vertical deviation is bounded by 1e-4.
export function projectileTrajectorySamples(model,terminalFraction=1){
 const points=[projectileTrajectoryPoint(model,0)];points[0].fraction=0;
 const start=Math.min(terminalFraction,Math.max(0,model.dropStart));
 if(start>0)points.push({...projectileTrajectoryPoint(model,start),fraction:start});
 const count=model.curvature?Math.ceil((terminalFraction-start)*Math.sqrt(model.curvature/(4e-4))):0;
 for(let i=1;i<=count;i++){const fraction=start+(terminalFraction-start)*i/count;points.push({...projectileTrajectoryPoint(model,fraction),fraction});}
 if(points.at(-1).fraction!==terminalFraction)points.push({...projectileTrajectoryPoint(model,terminalFraction),fraction:terminalFraction});
 return points;
}
