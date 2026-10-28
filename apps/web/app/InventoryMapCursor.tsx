import {projectSurface} from '../lib/tactical-elevation';

export default function InventoryMapCursor({state,preview,target,project}:{state:any;preview:any;target:any;project:(x:number,y:number)=>{x:number;y:number}}){
 if(!preview||!target||![target.x,target.y].every(Number.isFinite))return null;
 const color=preview.valid?'#e8d892':'#e99a83',point=projectSurface(state,project,target);
 const approaching=preview.kind==='gift';
 const steps=preview.path??preview.flight?.path??[],actor=approaching&&state.units.find((unit:any)=>unit.id===preview.action?.unitId);
 const path=(actor&&steps.length?[actor,...steps]:steps).filter((step:any)=>(approaching?[step.x,step.y]:[step.x,step.y,step.height]).every(Number.isFinite)).map((step:any)=>projectSurface(state,project,approaching?step:{...step,renderedHeight:step.height}));
 return <g data-inventory-map-cursor="true" pointerEvents="none" aria-hidden="true">
  {path.length>1&&<polyline data-item-trajectory={approaching?undefined:'true'} data-item-approach={approaching?'true':undefined} points={path.map((step:any)=>`${step.x},${step.y}`).join(' ')} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="3 3"/>}
  <ellipse cx={point.x} cy={point.y} rx="17" ry="8" fill="#18251e88" stroke={color} strokeWidth="1.4"/>
  {preview.valid?<path d={`M${point.x-4} ${point.y}l3 3 6-6`} fill="none" stroke={color} strokeWidth="1.5"/>:<path d={`M${point.x-4} ${point.y-4}l8 8m0-8-8 8`} stroke={color} strokeWidth="1.7"/>}
 </g>;
}
