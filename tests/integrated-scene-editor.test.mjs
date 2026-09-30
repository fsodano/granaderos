import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {createBattle} from '../game/tactical.js';
import {ARTILLERY} from '../game/artillery-definitions.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
function fixture(){
 const state=createBattle([{id:'p',name:'Patriota',x:1,y:1,weapon:1800,loaded:1}],{width:6,height:6,exploration:true,tiles:Array.from({length:36},(_,i)=>({x:i%6,y:Math.floor(i/6),type:'grass',blocked:false,cover:0})),enemies:[],artillery:[]});
 state.artillery=[{id:'edited',x:3,y:3,type:'bronze4',side:'player',hp:100}];
 state.artilleryDefinitions={...ARTILLERY,bronze4:{...ARTILLERY.bronze4,name:'Artillería de la campaña',art:'/art/story-cannon.png'}};
 return state;
}
const noop=()=>{};
function props(state,patch={}){return {state,selected:'p',unit:state.units[0],players:state.units,units:state.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:(x-y)*26,y:(x+y)*14}),onTile:noop,onHover:noop,onTalk:noop,onCannon:noop,cannonId:'',...patch};}

test('the common scene retains authored artillery names and images',()=>{
 const state=fixture(),before=structuredClone(state),html=render(h('svg',null,h(Scene,props(state))));
 assert.match(html,/Seleccionar Artillería de la campaña/);assert.match(html,/href="\/art\/story-cannon.png"/);assert.deepEqual(state,before);
});

test('editor preview shares the scene while keeping its overlay and suppressing game controls',()=>{
 const state=fixture();let actions=0;
 const all=nodes(componentTree(Scene,props(state,{interactive:false,terrainVisible:false,groundOverlay:h('g',{'data-editor-grid':true}),onCannon:()=>actions++,onTile:()=>actions++,onTalk:()=>actions++})));
 assert.ok(all.some(n=>n.props?.['data-editor-grid']));assert.ok(!all.some(n=>n.props?.role==='button'||n.props?.tabIndex>=0));
 assert.ok(!all.some(n=>n.props?.['data-ground-paint']));
 const cannon=all.find(n=>n.props?.['aria-label']==='Seleccionar Artillería de la campaña');assert.ok(cannon);
 cannon.props.onClick();assert.equal(actions,0);
});
