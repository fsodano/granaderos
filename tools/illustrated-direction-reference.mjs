// Assemble selected still frames as an orientation reference for imagegen.
// This rearranges atlas cells; it does not draw or synthesize character art.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';

const names=process.argv.slice(2);
if(!names.length)throw Error('Pass one or more packed still atlas names');
const root='assets/previews/illustrated-sprites/packed';
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
for(const name of names){
 const entry=manifest.atlases[name];
 if(!entry||entry.framesPerDirection!==1)throw Error(`Expected a complete still atlas: ${name}`);
 const layers=[];
 for(let direction=0;direction<8;direction++)layers.push({
  input:await sharp(`${root}/${entry.file}`).extract({left:direction*entry.cell,top:0,width:entry.cell,height:entry.cell}).resize(480,480,{kernel:'nearest'}).png().toBuffer(),
  left:direction%4*480,top:Math.floor(direction/4)*480,
 });
 const output=`assets/source/illustrated-sprites/${name}-reviewed-reference.png`;
 await sharp({create:{width:1920,height:960,channels:4,background:'#ff00ff'}}).composite(layers).png().toFile(output);
 await writeFile(output.replace(/\.png$/,'.provenance.json'),JSON.stringify({source:`${root}/${entry.file}`,sha256:entry.sha256,directions:manifest.directions,command:`node tools/illustrated-direction-reference.mjs ${name}`},null,2)+'\n');
 console.log(output);
}
