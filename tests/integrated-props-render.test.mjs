import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
const {buildPropObjects}=await import('../web/app/TacticalProps.tsx');
const project=(x,y)=>({x:(x-y)*20,y:(x+y)*10});
const objects=props=>buildPropObjects({state:{props,buildings:[]},revealed:new Set(),project,light:()=>1});
test('multi-cell carts keep their new artwork and beds retain their authored rotation',()=>{
 const [cart]=objects([{id:'cart',type:'cart',x:2,y:2,footprint:{width:2,height:1}}]);
 const markup=render(h('svg',null,cart.node));assert.match(markup,/data-cart-art="true"/);assert.match(markup,/cart-v1.webp/);assert.match(markup,/data-footprint="2x1"/);
 const bed={id:'bed',type:'bed',x:2,y:2,footprint:{width:2,height:1}};
 const normal=render(h('svg',null,objects([bed])[0].node)),rotated=render(h('svg',null,objects([{...bed,rotation:180}])[0].node));
 assert.notEqual(normal,rotated);assert.match(rotated,/data-prop-type="bed"/);
});
