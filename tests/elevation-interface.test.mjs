import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {buildBuilding,buildTerrace} from '../game/buildings.js';
import {createBattle,actBattle,getReachable,climbPreview} from '../game/tactical.js';
import {sameCell,spaceKey,tacticalLevel,surfaceHeight} from '../game/tactical-space.js';
import {roomAt,isInteriorVisible} from '../game/tactical-visibility.js';
import {cellOccupant,movementAction,orderAction,heldSupplyAction,movementGroupModel,visibleHover,isGroupGround,toggleMovementGroup} from '../game/ja2-hud.js';
import {executeGroupMove} from '../game/group-movement.js';
import {tacticalShortcut} from '../game/hotkeys.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const {default:Inventory}=await import('../web/app/JA2Inventory.tsx');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const {BuildingRoof}=await import('../web/app/BuildingRoof.tsx');
const {movementRoute,sampleMovementSegment}=await import('../web/app/useUnitMotion.ts');
const {projectSurface,ELEVATION_PIXELS_PER_METRE,surfaceMotionPoint}=await import('../web/lib/tactical-elevation.ts');
const project=(x,y)=>({x:300+(x-y)*26,y:65+(x+y)*14}),noop=()=>{};
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
// Recover the actual roof mesh transform and its vertices. This is independent
// of the surface projection helper and detects changes to the approved art plane.
function renderedRoofPlane(state){
 const object=buildBuildingObjects({state,revealed:new Set(),cursorLevel:1,project,light:()=>1}).find(o=>o.key==='architecture-roof-terrace:interior');
 const element=nodes(object.node).find(node=>node.type===BuildingRoof),roof=componentTree(BuildingRoof,element.props);
 const flat=nodes(roof).find(node=>node.props?.['data-roof-form']==='flat');
 const mesh=nodes(flat).find(node=>node.type==='g'&&node.props?.transform?.startsWith('matrix('));
 const matrix=mesh.props.transform.slice(7,-1).split(/\s+/).map(Number);
 const [a,b,c,d,e,f]=matrix,projectVertex=(x,y)=>({x:a*x+c*y+e,y:b*x+d*y+f});
 const vertices=mesh.props.children[0].props.points.split(' ').map(point=>point.split(',').map(Number));
 return {point:(x,y)=>projectVertex(x*32,y*32),vertices:vertices.map(([x,y])=>({cell:{x:x/32,y:y/32,tacticalLevel:1},screen:projectVertex(x,y)}))};
}
function fixture(){
 const built=buildBuilding({id:'terrace',x:2,y:2,width:5,height:5,doors:[{x:3,y:6,open:true}]}),ground=Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,blocksSight:false,cover:0}));
 const map=new Map(built.tiles.map(t=>[`${t.x},${t.y}`,t]));
 const space=buildTerrace(built.building,{climbPoints:[{id:'west',from:{x:1,y:3},to:{x:2,y:3}}]});
 const state=createBattle([{id:'climber',name:'Trepa',x:1,y:3},{id:'down',name:'Abajo',x:3,y:3},{id:'up',name:'Arriba',x:3,y:3,tacticalLevel:1}],{width:10,height:10,tiles:ground.map(t=>map.get(`${t.x},${t.y}`)??t),buildings:[built.building],...space,enemies:[{id:'enemy',x:9,y:9}],seed:45});
 Object.assign(state.units[1],{x:3,y:3});Object.assign(state.units[2],{x:3,y:3,tacticalLevel:1});
 return state;
}
function sceneProps(state,extra={}){return {state,selected:'up',unit:state.units[2],players:state.units,units:state.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(['terrace:interior']),project,onTile:noop,onHover:noop,onTalk:noop,onCannon:noop,cannonId:'',...extra};}
function inventoryProps(battle,onOrder=noop){const unit=battle.units[0];return {battle,unit,selected:unit.id,units:battle.units,missionAllies:[],localMilitia:[],mode:'move',showSight:false,busy:false,vw:1000,vh:600,cameraRect:{x:0,y:0,width:1000,height:600},project,zoom:1,onOrder,onMode:noop,onToggleSight:noop,onSelect:noop,onRetreat:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCloseInventory:noop,onCursorLevelChange:noop};}

test('ground and roof hit frames share map columns but retain distinct physical heights and identities',()=>{
 const state=fixture(),clicked=[];
 for(const level of [0,1]){
  const tree=componentTree(Scene,sceneProps(state,{cursorLevel:level,onTile:point=>clicked.push(point)})),all=nodes(tree);
  const frames=['down','up'].map(id=>nodes(all.find(n=>n.props?.['data-unit-id']===id)).find(n=>n.props?.['data-person-hit-target']));
  assert.equal(frames[0].props.x,frames[1].props.x);
  close(frames[0].props.y-frames[1].props.y,project(3,3).y-renderedRoofPlane(state).point(3,3).y);
  for(const [i,frame]of frames.entries()){
   assert.equal(frame.props.tabIndex,i===level?0:-1);assert.equal(frame.props.pointerEvents,i===level?'all':'none');
  }
  frames[level].props.onKeyDown({key:'Enter',preventDefault:noop});
  const point=clicked.at(-1);assert.equal(point.id,level?'up':'down');assert.equal(tacticalLevel(point),level);
  assert.equal(cellOccupant(state.units,point).id,point.id);
 }
 assert.equal(cellOccupant(state.units,{x:3,y:3}).id,'down');
 assert.equal(cellOccupant(state.units,{x:3,y:3,tacticalLevel:1}).id,'up');
 assert.equal(visibleHover(state,state.units[2]).id,'up');
});

test('roof mesh vertices, actor feet, hit frames and tile targets use the same existing art plane',()=>{
 for(const architecture of ['house','mansion','warehouse']){
  const state=fixture();Object.assign(state.buildings[0],{architecture,roof:'terrace'});
  const plane=renderedRoofPlane(state);
  for(const vertex of plane.vertices){const p=projectSurface(state,project,vertex.cell);close(p.x,vertex.screen.x);close(p.y,vertex.screen.y);}
  for(const cell of [{x:2,y:3},{x:3,y:3},{x:6,y:5}]){
   Object.assign(state.units[2],cell);const expected=plane.point(cell.x,cell.y),surface=state.upperSurfaces.find(t=>t.x===cell.x&&t.y===cell.y);
   const tree=componentTree(Scene,sceneProps(state,{cursorLevel:1,hover:surface})),actor=nodes(tree).find(node=>node.props?.['data-unit-id']==='up');
   const ring=nodes(actor).find(node=>node.type==='ellipse'&&node.props.stroke==='#dacb86'),hit=nodes(actor).find(node=>node.props?.['data-person-hit-target']);
   close(ring.props.cx,expected.x);close(ring.props.cy,expected.y);close(hit.props.x+hit.props.width/2,expected.x);close(hit.props.y+hit.props.height,expected.y);
   const sprite=nodes(actor).find(node=>node.props?.drawSize===52);assert.deepEqual(sprite.props.position,{x:ring.props.cx,y:ring.props.cy});assert.equal(sprite.props.drawSize,52);
   const target=nodes(tree).find(node=>node.props?.['data-surface-id']===surface.id),vertices=target.props.children[0].props.points.split(' ').map(point=>point.split(',').map(Number));
   close(vertices.reduce((sum,p)=>sum+p[0],0)/4,expected.x);close(vertices.reduce((sum,p)=>sum+p[1],0)/4,expected.y);
  }
  assert.deepEqual(projectSurface(state,project,{x:3,y:3}),project(3,3));
 }
});

test('upper tile actions, hover outlines and sight overlays use the roof plane and its own key',()=>{
 const state=fixture(),surface=state.upperSurfaces.find(t=>t.x===4&&t.y===3),clicked=[];
 const tree=componentTree(Scene,sceneProps(state,{cursorLevel:1,hover:surface,reachable:[surface],showSight:true,sight:new Set([spaceKey(surface)]),onTile:point=>clicked.push(point)}));
 const target=nodes(tree).find(n=>n.props?.['data-surface-id']===surface.id);assert.ok(target);
 const polygon=target.props.children[0],p=projectSurface(state,project,surface);
 assert.ok(polygon.props.points.startsWith(`${p.x},${p.y-14} `));
 target.props.onClick();assert.equal(clicked[0],surface);assert.equal(movementAction(clicked[0]).tacticalLevel,1);
 const html=render(target);assert.match(html,/nivel superior/);assert.match(html,/fill="#69ac54"/);assert.match(html,/fill="#d8dca1"/);
 const ground=nodes(tree).find(n=>n.props?.['data-surface-level']==='0');assert.equal(ground.props.tabIndex,-1);
 const allHtml=render(tree),roof=allHtml.indexOf('data-roof-room="terrace:interior"'),tile=allHtml.indexOf(`data-surface-id="${surface.id}"`),actor=allHtml.indexOf('data-unit-id="up"');
 assert.ok(roof>=0&&roof<tile&&tile<actor,'detailed roof, surface targets and roof actor draw in that order');
});

test('roof visibility does not disclose the room below and cursor changes retain detailed cutaways',()=>{
 const state=fixture(),down=state.units[1],up={...state.units[2],buildingId:'terrace'};
 assert.equal(roomAt(state,down).id,'terrace:interior');assert.equal(roomAt(state,up),undefined);
  assert.equal(isInteriorVisible(state,down,new Set()),false);assert.equal(isInteriorVisible(state,up,new Set()),true);
  assert.equal(isInteriorVisible(state,{...up,roomId:'terrace:interior'},new Set()),true,'a retained downstairs tag cannot hide a roof occupant');
 const upperRoom={id:'upper-room',tacticalLevel:1,cells:[{x:4,y:3,tacticalLevel:1}]};state.buildings[0].rooms.push(upperRoom);
 assert.equal(isInteriorVisible(state,{x:4,y:3,tacticalLevel:1},new Set()),false);
 assert.equal(isInteriorVisible(state,{x:4,y:3,tacticalLevel:1},new Set(['upper-room'])),true);
 state.buildings[0].rooms.pop();
 const args={state,revealed:new Set(['terrace:interior']),project,light:()=>1};
 const ground=buildBuildingObjects({...args,cursorLevel:0}),upper=buildBuildingObjects({...args,cursorLevel:1});
 assert.ok(ground.some(o=>o.key.startsWith('architecture-floor-')));assert.ok(!ground.some(o=>o.key.startsWith('architecture-roof-')));
 const roof=upper.find(o=>o.key==='architecture-roof-terrace:interior');assert.ok(roof);
 const html=render(roof.node);assert.match(html,/data-building-silhouette="house"/);assert.match(html,/data-roof-form="flat"/);assert.match(html,/data-chimney/);
 assert.deepEqual(buildBuildingObjects({...args,cursorLevel:0}).map(o=>render(o.node)),ground.map(o=>render(o.node)));
});

test('same-column climbs animate physical height and preserve authoritative climb path metadata',()=>{
 const state=fixture(),unit=state.units[0],link=state.climbLinks[0],next=actBattle(state,{type:'climb',unitId:unit.id,linkId:link.id});
 assert.equal(next.lastError,null);const actor=next.units[0],path=movementRoute(state,unit,actor);
 assert.ok(sameCell(path.at(-1),actor));assert.equal(path.at(-1).kind,'climb');assert.equal(path.at(-1).linkId,link.id);
 const a=surfaceMotionPoint(state,{x:3,y:3}),b=surfaceMotionPoint(state,{x:3,y:3,tacticalLevel:1});
 const from=project(3,3),to=renderedRoofPlane(state).point(3,3);
 for(const fraction of [0,.25,.5,.75,1]){
  const point=sampleMovementSegment(a,b,fraction),p=projectSurface(state,project,point);
  assert.equal(point.x,3);assert.equal(point.y,3);assert.equal(point.renderedHeight,3*fraction);
  close(p.x,from.x+(to.x-from.x)*fraction);close(p.y,from.y+(to.y-from.y)*fraction);
 }
 const recorded={...actor,lastMovePath:[{...actor,kind:'climb',linkId:link.id}]};
 assert.equal(movementRoute(state,unit,recorded)[1].linkId,link.id);
 assert.equal(surfaceHeight(next,actor),3);
});

test('paid climb and descent interpolate the roof inset without snapping the actor foot or hit frame',()=>{
 const state=fixture(),unit=state.units[0],next=actBattle(state,{type:'climb',unitId:unit.id,linkId:state.climbLinks[0].id});assert.equal(next.lastError,null);
 const route=movementRoute(state,unit,next.units[0]).map(point=>surfaceMotionPoint(state,point,next)),plane=renderedRoofPlane(state);
 for(const [a,b]of [route,[...route].reverse()]){
  const from=tacticalLevel(a)?plane.point(a.x,a.y):project(a.x,a.y),to=tacticalLevel(b)?plane.point(b.x,b.y):project(b.x,b.y);
  for(const fraction of [0,.25,.5,.75,1]){
   const position=sampleMovementSegment(a,b,fraction),p=projectSurface(state,project,position),expected={x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction};
   close(p.x,expected.x);close(p.y,expected.y);
   const tree=componentTree(Scene,sceneProps(next,{selected:unit.id,cursorLevel:1,positions:{[unit.id]:{...position,moving:true,direction:3,frame:0}}}));
   const actor=nodes(tree).find(node=>node.props?.['data-unit-id']===unit.id),hit=nodes(actor).find(node=>node.props?.['data-person-hit-target']);
   close(hit.props.x+hit.props.width/2,expected.x);close(hit.props.y+hit.props.height,expected.y);
  }
 }
 const independent={...state,buildings:[],upperSurfaces:state.upperSurfaces.map(surface=>({...surface,kind:'platform',buildingId:undefined}))};
 const point={x:3,y:3,tacticalLevel:1},p=projectSurface(independent,project,point);close(p.x,project(3,3).x);close(p.y,project(3,3).y-3*ELEVATION_PIXELS_PER_METRE);
});

test('inventory climb controls use real admission, costs and callbacks while native Tab stays available',()=>{
 const state=fixture(),link=state.climbLinks[0],expected=climbPreview(state,state.units[0],{linkId:link.id});let action,cursor;
 const tree=componentTree(Inventory,{...inventoryProps(state,value=>{action=value;}),onCursorLevelChange:value=>{cursor=value;}});
 const controls=nodes(tree).find(n=>n.props?.['aria-label']==='Altura y accesos'),buttons=nodes(controls).filter(n=>n.type==='button');
 const levelControl=nodes(controls).find(n=>typeof n.type==='function'&&n.props?.onChange);let levelButton;
 function CaptureLevel(){levelButton=levelControl.type(levelControl.props);return null;}
 render(h(tree.type,null,h(CaptureLevel)));
 levelButton.props.onClick();assert.equal(cursor,1);
 const climb=buttons.find(n=>render(n).includes('Subir'));assert.equal(climb.props.disabled,false);assert.match(render(climb),new RegExp(`${expected.pa} PA`));climb.props.onClick();
 assert.deepEqual(action,{type:'climb',linkId:link.id});assert.equal(actBattle(state,{...action,unitId:state.units[0].id}).lastError,null);
 state.units[0].stance='crouched';const blocked=nodes(componentTree(Inventory,inventoryProps(state))).find(n=>n.type==='button'&&render(n).includes('Subir'));
 assert.equal(blocked.props.disabled,true);assert.match(blocked.props.title,/de pie/);
 assert.equal(tacticalShortcut({key:'Tab'}),'cursor-level');
 for(const context of [{nativeControl:true},{editing:true},{dialog:true}])assert.equal(tacticalShortcut({key:'Tab'},context),null);
 assert.equal(tacticalShortcut({key:'Tab',shiftKey:true}),null);
});

test('coordinate orders and group controls preserve legal roof and ground destinations',()=>{
 const state=fixture(),point={x:4,y:3,tacticalLevel:1};state.mode='exploration';state.units=state.units.filter(unit=>unit.side==='player');
 assert.deepEqual(movementAction(point),{type:'move',...point});
 for(const id of ['move','look','torch','artilleryMove','artilleryPivot'])assert.equal(orderAction(state,state.units[0],point,id).tacticalLevel,1,id);
 assert.equal(heldSupplyAction({activeSupply:'torches'},point).tacticalLevel,1);
 assert.deepEqual(toggleMovementGroup(state,[],'up','climber'),['climber','up']);
 assert.equal(isGroupGround(state,state.units[0],point),true);
 const group=movementGroupModel(state,['climber','up'],'climber',point);assert.equal(group.request.tacticalLevel,1);assert.equal(group.preview.ok,true);
 const result=executeGroupMove(state,group.request);assert.equal(result.status,'completed');assert.ok(result.orders.every(order=>order.tacticalLevel===1));
 const down=movementGroupModel(result.state,['climber','up'],'climber',{x:0,y:3});assert.equal(down.request.tacticalLevel,0);assert.equal(down.preview.ok,true);
 const descended=executeGroupMove(result.state,down.request);assert.equal(descended.status,'completed');assert.ok(descended.orders.every(order=>order.tacticalLevel===0));
 const reachable=getReachable(state,state.units[0]);assert.ok(reachable.some(p=>tacticalLevel(p)===1&&p.path.some(step=>step.kind==='climb')));
});
