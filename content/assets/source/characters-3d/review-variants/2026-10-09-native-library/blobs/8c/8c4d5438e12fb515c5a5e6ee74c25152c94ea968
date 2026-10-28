import assert from 'node:assert/strict';
import {Box3,Ray,Vector3} from '../web/node_modules/three/build/three.module.js';

const directions=[[1,.173,.311],[-1,.237,.131],[.217,1,.413],[.367,-1,.113],[.113,.233,1],[.431,.157,-1]].map(v=>new Vector3(...v).normalize());

export function openSurfaceProbe(triangles){
 function build(items){
  const box=new Box3();for(const triangle of items)box.expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
  if(items.length<=12)return {box,triangles:items};
  const extent=box.getSize(new Vector3()),axis=extent.x>extent.y?(extent.x>extent.z?'x':'z'):(extent.y>extent.z?'y':'z');
  items.sort((a,b)=>(a.a[axis]+a.b[axis]+a.c[axis])-(b.a[axis]+b.b[axis]+b.c[axis]));const middle=items.length>>1;
  return {box,left:build(items.slice(0,middle)),right:build(items.slice(middle))};
 }
 assert.ok(triangles.length>0);const tree=build(triangles),scratch=new Vector3();
 function inside(point){
  // A nearest triangle normal is not a signed distance for an open head/
  // neck patch. Bounds reject distant hands; several oblique rays avoid
  // treating a single neck or eye opening as the entire volume boundary.
  if(!tree.box.containsPoint(point))return false;
  let votes=0;
  for(const direction of directions){
   const ray=new Ray(point,direction),hits=[];
   function visit(node){
    if(!ray.intersectBox(node.box,scratch))return;
    if(node.triangles){for(const t of node.triangles){const hit=ray.intersectTriangle(t.a,t.b,t.c,false,scratch);if(hit)hits.push(hit.distanceTo(point));}}
    else{visit(node.left);visit(node.right);}
   }
   visit(tree);hits.sort((a,b)=>a-b);let count=0,last=-Infinity;
   for(const distance of hits)if(distance-last>1e-6){count++;last=distance;}
   votes+=count%2;
  }
  return votes>=4;
 }
 function depth(point){
  if(!inside(point))return 0;let nearest=Infinity;
  function visit(node){
   if(node.box.distanceToPoint(point)>=nearest)return;
   if(node.triangles){for(const t of node.triangles)nearest=Math.min(nearest,t.closestPointToPoint(point,scratch).distanceTo(point));}
   else{visit(node.left);visit(node.right);}
  }
  visit(tree);return nearest;
 }
 return {inside,depth};
}
