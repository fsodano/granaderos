// Multi-tile buildings with walkable interiors and independently operated door leaves.
export function buildBuilding({id,x,y,width,height,name=id,doors=[],windows=[],material='adobe',roof='tile'}){
  if(!id||![x,y,width,height].every(Number.isInteger)||width<3||height<3)throw Error('Building needs an ID and an integer footprint of at least 3×3.');
  const roomId=`${id}:interior`,tiles=[],cells=[];
  for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){
    const edge=col===x||col===x+width-1||row===y||row===y+height-1;
    tiles.push({x:col,y:row,type:edge?'wall':'floor',blocked:edge,blocksSight:edge,cover:edge?40:0,material,buildingId:id,roomId:edge?null:roomId});
    if(!edge)cells.push({x:col,y:row});
  }
  function opening(item,type){const tile=tiles.find(t=>t.x===item.x&&t.y===item.y);if(!tile||tile.type!=='wall')throw Error('Doors and windows must occupy distinct perimeter cells.');Object.assign(tile,{type,blocked:type==='window'||!item.open,blocksSight:type==='window'?false:!item.open,cover:type==='window'?25:0,...(type==='door'?{doorId:item.id||`${id}:door:${item.x}:${item.y}`,open:Boolean(item.open),locked:Boolean(item.locked)}:{})});}
  for(const door of doors)opening(door,'door');for(const window of windows)opening(window,'window');
  return {tiles,building:{id,name,x,y,width,height,roof,material,rooms:[{id:roomId,cells}]}};
}
export function placeBuilding(ground,options){const result=buildBuilding(options),overrides=new Map(result.tiles.map(t=>[`${t.x},${t.y}`,t]));if(result.tiles.some(t=>!ground.some(g=>g.x===t.x&&g.y===t.y)))throw Error('Building footprint is outside the sector.');return{tiles:ground.map(t=>overrides.get(`${t.x},${t.y}`)||{...t}),building:result.building};}
