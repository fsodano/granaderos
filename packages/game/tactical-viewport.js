// Quantized overscan keeps camera motion smooth without rebuilding scenery every pixel.
export function tacticalViewport({x,y,width,height},margin=120){
 const left=Math.floor((x-margin)/128)*128,top=Math.floor((y-margin)/128)*128;
 return {x:left,y:top,width:Math.ceil((x+width+margin)/128)*128-left,height:Math.ceil((y+height+margin)/128)*128-top};
}
export function pointInViewport(view,point,padding=0){return !view||point.x+padding>=view.x&&point.x-padding<=view.x+view.width&&point.y+padding>=view.y&&point.y-padding<=view.y+view.height;}
export function buildingInViewport(view,building,project){
 if(!view)return true;
 const points=[[building.x-.5,building.y-.5],[building.x+building.width,building.y-.5],[building.x-.5,building.y+building.height],[building.x+building.width,building.y+building.height]].map(([x,y])=>project(x,y));
 const left=Math.min(...points.map(p=>p.x))-80,right=Math.max(...points.map(p=>p.x))+80,top=Math.min(...points.map(p=>p.y))-180,bottom=Math.max(...points.map(p=>p.y))+80;
 return right>=view.x&&left<=view.x+view.width&&bottom>=view.y&&top<=view.y+view.height;
}
