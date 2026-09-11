// Abstract period-game geometry and resistance, not real ballistic measurements.
const resistance={wood:24,adobe:80,stone:120,hay:3};
const furniture={table:{height:.8,material:'wood'},bench:{height:.45,material:'wood'},bed:{height:.55,material:'wood'},chest:{height:.8,material:'wood'},barrels:{height:1.2,material:'wood'},hay:{height:1.3,material:'hay'}};
const heights={standing:{muzzle:1.4,head:1.6,torso:1.1,legs:.45},crouched:{muzzle:.9,head:1,torso:.7,legs:.3},prone:{muzzle:.25,head:.3,torso:.2,legs:.15},mounted:{muzzle:2,head:2.2,torso:1.8,legs:1.1}};
const height=(unit,part)=>heights[unit.mounted?'mounted':unit.stance??'standing']?.[part]??heights.standing[part];
const cellKey=(x,y)=>`${x},${y}`;

// Traverse every crossed cell, including the two cells touching a diagonal
// corner. Entry/exit fractions let a sloping shot meet a low obstacle correctly.
export function projectileCells(a,b){
  if(a.x===b.x&&a.y===b.y)return [];
  const dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy),tx=dx?1/Math.abs(dx):Infinity,ty=dy?1/Math.abs(dy):Infinity;
  let x=a.x,y=a.y,nx=tx/2,ny=ty/2,entry=0;const result=[];
  while(entry<=1){
    const exit=Math.min(nx,ny,1);
    if(x!==a.x||y!==a.y)result.push({x,y,entry,exit});
    if(exit===1)break;
    if(Math.abs(nx-ny)<1e-10){result.push({x:x+sx,y,entry:exit,exit},{x,y:y+sy,entry:exit,exit});x+=sx;y+=sy;nx+=tx;ny+=ty;}
    else if(nx<ny){x+=sx;nx+=tx;}else{y+=sy;ny+=ty;}
    entry=exit;
  }
  return result;
}

function terrainObstacle(tile){
  if(!tile||tile.type==='door'&&tile.open)return null;
  const explicit=tile.obstacleHeight;
  const low=tile.type==='window'?.8:tile.type==='rubble'?.35:0;
  const solid=tile.blocked&&!['window','water'].includes(tile.type);
  const h=explicit??(low||(solid?2.5:0));if(!h)return null;
  const material=tile.type==='door'?'wood':Object.hasOwn(resistance,tile.material)?tile.material:tile.type==='stone'||tile.type==='cliff'?'stone':'adobe';
  return {height:h,material,resistance:tile.projectileResistance??resistance[material]};
}

export function concealmentAt(state,target){
  const tile=state.tiles.find(tile=>tile.x===target.x&&tile.y===target.y);
  if(!tile)return 0;
  if(tile.concealment!==undefined)return tile.concealment;
  if(['wall','door','window','rubble'].includes(tile.type))return 0;
  return tile.type==='forest'?Math.max(20,tile.cover??0):tile.type==='scrub'?Math.max(15,tile.cover??0):tile.cover??0;
}

export function concealmentSightPenalty(state,target){
  const posture=target.mounted?.25:target.stance==='prone'?1.5:target.stance==='crouched'?1:.5;
  return Math.min(6,concealmentAt(state,target)/10*posture);
}

export function projectilePath(state,attacker,target,weapon,hitLocation='torso',flight={}){
  const power=Math.max(1,weapon.damage??1),muzzle=height(attacker,'muzzle'),destination=height(target,hitLocation);
  let remaining=power;const obstacles=[],tiles=new Map(state.tiles.map(tile=>[cellKey(tile.x,tile.y),tile])),seen=new Set();
  const encounter=(id,point,obstacle)=>{
    if(!obstacle||seen.has(id))return;
    const low=Math.min(muzzle+(destination-muzzle)*point.entry,muzzle+(destination-muzzle)*point.exit);
    if(low>obstacle.height)return;
    seen.add(id);remaining=Math.max(0,remaining-obstacle.resistance);
    obstacles.push({x:point.x,y:point.y,material:obstacle.material,resistance:obstacle.resistance,stopped:remaining===0});
  };
  for(const point of projectileCells(attacker,target)){
    if(point.entry>(flight.stopFraction??1))break;
    encounter(`tile:${point.x},${point.y}`,point,terrainObstacle(tiles.get(cellKey(point.x,point.y))));
    if(!remaining)break;
    for(const prop of state.props??[]){
      const size=prop.footprint??{width:1,height:1};
      if(point.x<prop.x||point.y<prop.y||point.x>=prop.x+size.width||point.y>=prop.y+size.height)continue;
      const spec=furniture[prop.type];if(!spec)continue;
      const material=Object.hasOwn(resistance,prop.material)?prop.material:spec.material;
      encounter(`prop:${prop.id}`,point,{height:prop.obstacleHeight??spec.height,material,resistance:prop.projectileResistance??resistance[material]});
      if(!remaining)break;
    }
    if(!remaining)break;
  }
  return {blocked:remaining===0,damageFactor:remaining/power,obstacles};
}

// A location shot has a fixed standing-torso destination height. It does not
// bend toward the posture or identity of an unseen soldier. Living bodies in
// crossed cells can intercept it, including allies and unconscious soldiers.
// Cell-wide silhouettes and the lack of body penetration are game tuning.
export function pointProjectileFlight(state,attacker,destination,weapon){
  const target={...destination,stance:'standing',mounted:false},muzzle=height(attacker,'muzzle'),end=height(target,'torso');
  for(const cell of projectileCells(attacker,target)){
    if(cell.entry===cell.exit)continue; // A corner touch can strike cover, not a cell-wide body.
    const z=muzzle+(end-muzzle)*(cell.entry+cell.exit)/2;
    const victims=state.units.filter(unit=>unit.id!==attacker.id&&unit.hp>0&&!unit.departure&&!unit.fled&&unit.x===cell.x&&unit.y===cell.y).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    for(const victim of victims){
      const posture=victim.knockedDown||victim.unconscious?{...victim,stance:'prone',mounted:false}:victim;
      if(z>height(posture,'head')+.15)continue;
      const location=z>height(posture,'torso')+.2?'head':z<height(posture,'legs')+.15?'legs':'torso';
      const path=projectilePath(state,attacker,target,weapon,'torso',{stopFraction:cell.entry});
      return {...path,victimId:path.blocked?null:victim.id,hitLocation:location};
    }
  }
  return {...projectilePath(state,attacker,target,weapon),victimId:null,hitLocation:'torso'};
}

export function validateCoverMetadata(value){
  for(const [key,max]of [['obstacleHeight',10],['projectileResistance',1000],['concealment',100]]){
    if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0||value[key]>max))throw Error('La cobertura guardada no es válida.');
  }
}
