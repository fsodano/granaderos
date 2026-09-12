import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {createElement} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {BUILDING_TYPES} from '../game/building-types.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {propCells,placePulperiaCart} from '../game/props.js';
const {BuildingMaterials}=await import('../web/app/BuildingMaterials.tsx');
const {buildPropObjects}=await import('../web/app/TacticalProps.tsx');
test('all declared building materials are packaged, detailed and local',async()=>{
 const markup=renderToStaticMarkup(createElement('svg',null,createElement(BuildingMaterials)));
 const urls=[...markup.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(urls.length,6+Object.keys(BUILDING_TYPES).length);
 for(const url of urls){
  const bytes=await readFile(`web/public${url}`),meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
  assert.equal(meta.width,256,url);assert.equal(meta.height,256,url);
  assert.ok(stats.channels.some(c=>c.stdev>8),`${url}: surface detail must survive packaging`);
 }
 const cart=await sharp('web/public/art/buildings/cart-v1.webp').ensureAlpha().stats();
 assert.equal(cart.channels[3].min,0);assert.equal(cart.channels[3].max,255);
});
test('pulpería carts preserve every doorway approach and do not duplicate on placement',()=>{
 let count=0;
 for(const sector of MAP_IDS){
  const map=buildSectorMap({sector}),carts=map.props.filter(p=>p.type==='cart');
  count+=carts.length;
  for(const cart of carts){
   assert.equal(propCells(cart).length,2);
   for(const cell of propCells(cart)){
    assert.ok(!map.tiles.find(t=>t.x===cell.x&&t.y===cell.y).blocked);
    assert.ok(!map.tiles.some(t=>t.type==='door'&&Math.abs(t.x-cell.x)+Math.abs(t.y-cell.y)<=1));
   }
  }
  const before=map.props.length;
  for(const b of map.buildings.filter(b=>map.props.some(p=>p.id===`${b.id}:cart`)))assert.equal(placePulperiaCart(map,b),false);
  assert.equal(map.props.length,before);
 }
 assert.ok(count>=10,'Carts must occur in the authored campaign, not just the preview.');
});
test('cart rendering uses the approved transparent art and its two-cell depth',()=>{
 const nodes=buildPropObjects({state:{tiles:[],props:[{id:'cart',type:'cart',x:2,y:3,footprint:{width:2,height:1}}]},revealed:new Set(),project:(x,y)=>({x:(x-y)*26,y:(x+y)*14}),light:()=>.7});
 assert.equal(nodes[0].depth,6.02);
 const markup=renderToStaticMarkup(nodes[0].node);
 assert.match(markup,/\/art\/buildings\/cart-v1.webp/);assert.match(markup,/data-footprint="2x1"/);assert.match(markup,/brightness\(0.7\)/);
});
