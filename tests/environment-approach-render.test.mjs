import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,environmentTargetAt} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');

test('keyboard tile focus shows the same approach cost before Enter commits the order',()=>{
  const state=createBattle([{id:'p',x:2,y:2,facing:2}],{width:16,height:8,enemies:[{id:'e',x:14,y:6,patrol:false,overwatch:false}]});
  for(const tile of state.tiles)Object.assign(tile,{type:'grass',blocked:false,blocksSight:false});
  Object.assign(state.tiles.find(t=>t.x===4&&t.y===2),{type:'door',doorId:'test',open:false,locked:false,blocked:true,blocksSight:true});
  state.units[1].ap=0;
  const unit=state.units[0];let hover=null,result=null,prevented=false;
  const tree=componentTree(TacticalScene,{state,selected:'p',unit,players:[unit],units:state.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14}),onHover:point=>{hover=point;},onTile:point=>{const ref=environmentTargetAt(state,point);result=actBattle(state,{type:'useItem',unitId:'p',environment:{kind:ref.kind,id:ref.id}});}});
  const nodes=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;nodes.push(node);visit(node.props?.children);}visit(tree);
  const tile=nodes.find(node=>node.props?.['aria-label']==='C5, obstáculo');assert.ok(tile);assert.equal(tile.props.tabIndex,0);
  tile.props.onFocus();const preview=targetPreview(state,unit,hover);assert.equal(preview.valid,true);assert.equal(preview.pa,12);assert.equal(preview.actionLabel,'Acercarse y abrir');assert.equal(result,null);
  tile.props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(result.lastError,null);assert.equal(result.units[0].ap,unit.ap-preview.pa);assert.equal(result.units[0].x,3);assert.equal(result.tiles.find(t=>t.doorId==='test').open,true);
  tile.props.onBlur();assert.equal(hover,null);
});
