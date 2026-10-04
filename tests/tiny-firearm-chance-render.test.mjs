import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {shotChance} from '../game/tactical.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
import {tinyFirearmChanceField} from './tiny-firearm-chance-fixture.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('actual Battlefield hover displays a physically possible tiny chance and passage as below one percent',async t=>{
 const {state:battle,player,target}=tinyFirearmChanceField(),before=structuredClone(battle);assert.ok(shotChance(battle,player,target,0,'head')>0&&shotChance(battle,player,target,0,'head')<1);
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:next=>next,onFinish(){}}),get=type=>nodes(mounted.tree()).find(node=>node.type===type);
 await mounted.act(async()=>{get(JA2Strip).props.onMode('fire');get(TacticalScene).props.onHover({...target,aimLocation:'head'});});
 const preview=nodes(mounted.tree()).find(node=>node.props?.['aria-label']==='Vista previa de la orden');assert.ok(preview);const html=renderToStaticMarkup(preview);
 assert.match(html,/Cabeza · &lt;1% de impacto con penetración/);assert.match(html,/&lt;1% de paso hasta el objetivo/);assert.doesNotMatch(html,/0% de impacto|0% de paso|0\.0/);assert.equal(mounted.jobs().filter(job=>job.job.kind==='action'||job.job.kind==='movement-step').length,0);assert.deepEqual(battle,before);
});
