// Reassemble selected poses for uniform/appearance variants. This preserves
// authored animation instead of asking each variant to invent the gait again.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
const names=process.argv.slice(2);
if(!names.length)throw Error('Pass packed animated atlas names');
const root='assets/previews/illustrated-sprites/packed';
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
for(const name of names){
 const entry=manifest.atlases[name];
 if(!entry||entry.framesPerDirection!==4)throw Error(`Expected a four-phase atlas: ${name}`);
 for(const [half,start]of[['north',0],['south',4]]){
  const layers=[];
  for(let row=0;row<4;row++)for(let frame=0;frame<4;frame++)layers.push({
   input:await sharp(`${root}/${entry.file}`).extract({left:frame*entry.cell,top:(start+row)*entry.cell,width:entry.cell,height:entry.cell}).resize(384,384,{kernel:'nearest'}).png().toBuffer(),
   left:frame*384,top:row*384,
  });
  const output=`assets/source/illustrated-sprites/${name}-${half}-reviewed-reference.png`;
  await sharp({create:{width:1536,height:1536,channels:4,background:'#ff00ff'}}).composite(layers).png().toFile(output);
  await writeFile(output.replace(/\.png$/,'.provenance.json'),JSON.stringify({source:`${root}/${entry.file}`,sha256:entry.sha256,directions:manifest.directions.slice(start,start+4),frames:4,command:`node tools/illustrated-action-reference.mjs ${name}`},null,2)+'\n');
  console.log(output);
 }
}
