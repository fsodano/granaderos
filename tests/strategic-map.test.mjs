import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAP_PLACES,MAP_MODES,sectorPosition,sectorIncome,MAP_TILE_SIZE,mapTilesForSector,mapTileOutline} from '../game/strategic-map.js';
import {CITIES} from '../game/cities.js';
import {CAMPAIGN_SECTORS,initialCampaign,isSupplied,dispatchCampaign} from '../game/campaign.js';

test('every existing campaign sector has a geographic anchor inside the operational map',()=>{
 assert.deepEqual(Object.keys(MAP_PLACES).sort(),CAMPAIGN_SECTORS.map(s=>s.id).sort());
 for(const d of CAMPAIGN_SECTORS){const p=sectorPosition(d.id);assert.ok(p.x>=36&&p.x<=684,d.id);assert.ok(p.y>=36&&p.y<=624,d.id);}
 assert.ok(sectorPosition('mendoza').x<sectorPosition('cordoba').x);
 assert.ok(sectorPosition('cordoba').x<sectorPosition('buenos_aires').x);
 assert.ok(sectorPosition('humahuaca').y<sectorPosition('jujuy').y);
 assert.ok(sectorPosition('jujuy').y<sectorPosition('salta').y);
 assert.ok(sectorPosition('salta').y<sectorPosition('tucuman').y);
 assert.ok(sectorPosition('los_patos').x<sectorPosition('uspallata').x);
 assert.ok(sectorPosition('uspallata').x<sectorPosition('mendoza').x);
 assert.ok(sectorPosition('santa_fe').y<sectorPosition('san_nicolas').y);
 assert.ok(sectorPosition('ensenada').x>sectorPosition('buenos_aires').x);
});
test('bottom view order preserves all six reference functions',()=>{
 assert.deepEqual(MAP_MODES.map(m=>m.id),['cities','resources','squads','militia','horses','items']);
});
test('income readout matches actual campaign daily payout',()=>{
 const s=initialCampaign();s.hour=23;
 const expected=CAMPAIGN_SECTORS.reduce((n,d)=>n+sectorIncome(s,d,isSupplied),0);
 const next=dispatchCampaign(s,{type:'wait',hours:1});
 assert.equal(next.lastError,null);
 assert.equal(next.resources.treasury-s.resources.treasury,expected);
});
test('income readout applies control, damage and blockade without mutation',()=>{
 const s=initialCampaign(),d=CAMPAIGN_SECTORS.find(d=>d.id==='ensenada');
 s.sectors[d.id].damageUntil=10;s.blockade=true;
 const before=JSON.stringify(s);
 assert.equal(sectorIncome(s,d),10);
 assert.equal(JSON.stringify(s),before);
 s.sectors[d.id].owner='royalist';assert.equal(sectorIncome(s,d,()=>true),0);
});
test('cartography contains continental Argentina and all three main river geometries',()=>{
 const g=JSON.parse(readFileSync(new URL('../game/strategic-geography.json',import.meta.url)));
 assert.equal(g.rivers.length,3);assert.ok(g.land.length>=10);
 const points=g.argentina.coordinates.flat(2);assert.ok(points.some(p=>p[1]<-54));assert.ok(points.some(p=>p[1]>-23));
});


test('every city has multiple connected district tiles and each tile targets an existing sector',()=>{
 for(const city of CITIES){
  const tiles=city.sectors.flatMap(mapTilesForSector);assert.ok(tiles.length>=3,city.id);
  for(const sector of city.sectors){
   const districts=mapTilesForSector(sector),seen=new Set([districts[0].id]);
   for(let i=0;i<districts.length;i++)for(const tile of districts)if(districts.some(other=>seen.has(other.id)&&Math.abs(tile.col-other.col)+Math.abs(tile.row-other.row)===1))seen.add(tile.id);
   assert.equal(seen.size,districts.length,sector);
   for(const tile of districts)assert.equal(tile.sectorId,sector);
  }
 }
});
test('district tiles share the map grid without overlaps or clipping',()=>{
 const tiles=CAMPAIGN_SECTORS.flatMap(d=>mapTilesForSector(d.id));
 assert.equal(new Set(tiles.map(t=>`${t.col},${t.row}`)).size,tiles.length);
 assert.equal(new Set(tiles.map(t=>t.id)).size,tiles.length);
 for(const t of tiles){assert.ok(t.x>=36&&t.x+MAP_TILE_SIZE<=684,t.id);assert.ok(t.y>=36&&t.y+MAP_TILE_SIZE<=624,t.id);assert.equal((t.x-36)%MAP_TILE_SIZE,0);assert.equal((t.y-36)%MAP_TILE_SIZE,0);}
 for(const id of ['humahuaca','uspallata','los_patos'])assert.equal(mapTilesForSector(id).length,1);
});
test('city outline omits internal edges, including the Buenos Aires and Retiro seam',()=>{
 const a={col:0,row:0,x:36,y:36},b={col:1,row:0,x:54,y:36};
 const outline=mapTileOutline([a,b]);assert.equal(outline.split(' ').length,6);
 assert.ok(!outline.includes('M54,36v18'));
 const tiles=['buenos_aires','retiro'].flatMap(mapTilesForSector);
 assert.ok(!mapTileOutline(tiles).includes('M522,540v18'));
});
