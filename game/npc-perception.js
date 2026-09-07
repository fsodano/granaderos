// Pure civilian perception helpers; reports never retain a live shooter ID.
export function directionTo(from,to){
 if(from.x===to.x&&from.y===to.y)return from.facing??0;
 return (Math.round(Math.atan2(to.x-from.x,from.y-to.y)/(Math.PI/4))+8)%8;
}
export function approximateHeardPosition(listener,source,{kind,radius,turn,width,height,obstructions=0}){
 if(Math.hypot(source.x-listener.x,source.y-listener.y)>Math.max(0,radius-obstructions*3)||radius<=0)return null;
 const size=radius<=8?3:5,half=(size-1)/2;
 return {x:Math.max(0,Math.min(width-1,Math.floor(source.x/size)*size+half)),y:Math.max(0,Math.min(height-1,Math.floor(source.y/size)*size+half)),turn,kind,uncertainty:Math.ceil(Math.SQRT2*half)};
}
