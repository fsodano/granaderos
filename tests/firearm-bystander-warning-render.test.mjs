import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('hovering a guarded prisoner firing lane presents the miss warning in the actual order preview',async t=>{
 const battle=createBattle([{id:'p',x:1,y:4,weapon:1802}],{width:12,height:8,enemies:[{id:'e',x:8,y:4,patrol:false}],npcs:[{id:'n',name:'Prisionero a la vista',x:8,y:5,hp:100,stance:'standing'}]});
 for(const tile of battle.tiles){tile.type='grass';tile.blocked=false;tile.blocksSight=false;}
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:state=>state,onFinish(){}}),get=type=>nodes(mounted.tree()).find(node=>node.type===type);
 await mounted.act(async()=>{get(JA2Strip).props.onMode('fire');get(TacticalScene).props.onHover(battle.units[1]);});
 const preview=nodes(mounted.tree()).find(node=>node.props?.['aria-label']==='Vista previa de la orden');
 assert.ok(preview);assert.match(renderToStaticMarkup(preview),/Un tiro desviado puede herir a Prisionero a la vista/);
 assert.match(renderToStaticMarkup(preview),/Cambiá de posición o elegí otro blanco/);
 assert.equal(mounted.jobs().filter(job=>job.job.kind==='action'||job.job.kind==='movement-step').length,0,'displaying risk cannot fire or move');
});
