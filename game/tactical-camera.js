// Scene pixels map to an integer number of CSS pixels at each supported zoom.
export function tacticalCamera(world,viewport,focus,offset,zoom){
 const scale=Math.max(1,Math.min(3,Math.round(zoom)));
 const width=viewport.width/scale,height=viewport.height/scale;
 const x=Math.round(Math.max(0,Math.min(Math.max(0,world.width-width),focus.x+offset.x-width/2)));
 const y=Math.round(Math.max(0,Math.min(Math.max(0,world.height-height),focus.y+offset.y-height/2)));
 return {x,y,width,height};
}
