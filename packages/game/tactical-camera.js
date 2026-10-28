// Keep fractional zoom and translation so a pinch retains its pointer anchor.
export function tacticalCamera(world,viewport,focus,offset,zoom){
 const scale=Math.max(1,Math.min(3,zoom));
 const width=viewport.width/scale,height=viewport.height/scale;
 const x=Math.max(0,Math.min(Math.max(0,world.width-width),focus.x+offset.x-width/2));
 const y=Math.max(0,Math.min(Math.max(0,world.height-height),focus.y+offset.y-height/2));
 return {x,y,width,height};
}
