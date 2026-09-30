// Static proof from the actual tactical renderer. Grid and labels are review overlays.
import {register} from 'node:module';
register('../tests/tactical-render-loader.mjs',import.meta.url);
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import ts from '../web/node_modules/typescript/lib/typescript.js';
import sharp from '../web/node_modules/sharp/lib/index.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {buildBuildingObjects}=await import('../web/app/TacticalBuildings.tsx');
const destination=resolve(process.argv[2]??'assets/previews/buildings/wall-alignment');
await mkdir(destination,{recursive:true});

// Reconstruct the former center placement without changing the working renderer.
const source=await readFile(new URL('../web/app/TacticalBuildings.tsx',import.meta.url),'utf8');
if(!source.includes('const wallInset=.4;'))throw Error('Wall placement changed; update the reference comparison.');
const reference=ts.transpileModule(source.replace('const wallInset=.4;','const wallInset=0;'),{
 compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(new URL('../web/node_modules/react/jsx-runtime.js',import.meta.url).href))
 .replace(/from (['"])(\.[^'"]+)\1/g,(_,quote,specifier)=>{
  const url=new URL(specifier,new URL('../web/app/TacticalBuildings.tsx',import.meta.url));
  const path=['','.tsx','.ts','.js'].map(ext=>`${url.href}${ext}`).find(path=>existsSync(new URL(path)));
  if(!path)throw Error(`Cannot resolve ${specifier}`);
  return `from ${JSON.stringify(path)}`;
 });
const {buildBuildingObjects:buildCentered}=await import(`data:text/javascript;base64,${Buffer.from(reference).toString('base64')}`);
const project=(x,y)=>({x:208+(x-y)*26,y:70+(x+y)*14});
const point=(x,y)=>{const p=project(x,y);return `${p.x},${p.y}`;};
const diamond=(x,y)=>[[x-.5,y-.5],[x+.5,y-.5],[x+.5,y+.5],[x-.5,y+.5]].map(([x,y])=>point(x,y)).join(' ');
const panels=[];
for(const axis of ['y','x'])for(const centered of [true,false]){
 const tiles=Array.from({length:49},(_,i)=>{
  const x=i%7,y=Math.floor(i/7),wall=axis==='y'?x===3&&y>=1&&y<=4:y===3&&x>=1&&x<=4;
  return {x,y,type:wall?'wall':'road',blocked:wall,blocksSight:wall,cover:wall?40:0};
 });
 const unit={id:'acosta',name:'Acosta',x:axis==='y'?2:4,y:axis==='y'?4:4,side:'player',hp:100,maxHp:100};
 const state={tiles,units:[unit],npcs:[],props:[],buildings:[],artillery:[],lights:[],smoke:[]};
 const args={state,project,light:()=>1,revealed:new Set()};
 let scene=render(h(TacticalScene,{state,players:[unit],units:[unit],selected:unit.id,unit,positions:{},poses:{},directions:{},mode:'move',reachable:[],sight:new Set(),revealed:new Set(),project}));
 if(centered){
  const oldObjects=new Map(buildCentered(args).map(o=>[o.key,o]));
  for(const object of buildBuildingObjects(args)){
   const current=render(object.node);
   if(!scene.includes(current))throw Error(`Missing wall in scene: ${object.key}`);
   scene=scene.replace(current,render(oldObjects.get(object.key).node));
  }
 }
 const outlines=tiles.map(t=>h('polygon',{key:`${t.x},${t.y}`,points:diamond(t.x,t.y),fill:t.blocked?'#d8bb65':'none',fillOpacity:.18,stroke:t.blocked?'#f1d989':'#b3b094',strokeOpacity:t.blocked?1:.25,strokeWidth:t.blocked?1:.5}));
 // Insert grid over the ground but below scene objects, retaining normal wall occlusion.
 const firstObject=scene.indexOf('<g><g data-wall-tile=');
 if(firstObject<0)throw Error('Cannot find the scene object layer.');
 scene=scene.slice(0,firstObject)+render(h('g',null,outlines))+scene.slice(firstObject);
 const walls=tiles.filter(t=>t.blocked);
 const edge=walls.map(t=>h('path',{key:`${t.x},${t.y}`,d:axis==='y'?`M${point(t.x+.5,t.y-.5)}L${point(t.x+.5,t.y+.5)}`:`M${point(t.x-.5,t.y+.5)}L${point(t.x+.5,t.y+.5)}`,stroke:'#9ef1df',strokeWidth:1.5,fill:'none'}));
 const labels=render(h('g',{fontFamily:'sans-serif'},
  h('text',{x:18,y:26,fill:'#f6ebc9',fontSize:17,fontWeight:700},centered?'CENTER PLACEMENT · REFERENCE':'CURRENT · NEAR SOUTHERN EDGE'),
  h('text',{x:18,y:46,fill:'#c4ccb9',fontSize:11},axis==='y'?'Wall direction shown in your screenshot':'The other wall direction'),
  h('text',{x:18,y:283,fill:'#f1d989',fontSize:11},'Gold outlines: blocked tiles'),
  h('text',{x:18,y:300,fill:'#9ef1df',fontSize:11},'Green line: southern tile edge'),
  h('text',{x:18,y:321,fill:'#dce3d4',fontSize:12},centered?'Wall base crosses the tile center.':'Wall base is 0.1 tile inside the edge.'),
  h('g',null,edge)));
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="832" height="680" viewBox="0 0 416 340"><rect width="416" height="340" fill="#17271f"/>${scene}${labels}</svg>`;
 for(const url of new Set([...svg.matchAll(/href="(\/art\/[^\"]+)"/g)].map(m=>m[1]))){
  const image=await sharp(await readFile(resolve('web/public',`.${url}`))).png().toBuffer();
  svg=svg.replaceAll(`href="${url}"`,`href="data:image/png;base64,${image.toString('base64')}"`);
 }
 const name=`${axis}-${centered?'center':'current'}`;
 await writeFile(resolve(destination,`${name}.svg`),svg);
 const png=await sharp(Buffer.from(svg)).png().toBuffer();
 await writeFile(resolve(destination,`${name}.png`),png);
 panels.push(png);
}
await sharp({create:{width:1664,height:1360,channels:4,background:'#17271f'}}).composite(panels.map((input,i)=>({input,left:(i%2)*832,top:Math.floor(i/2)*680}))).png().toFile(resolve(destination,'comparison.png'));
console.log(resolve(destination,'comparison.png'));
