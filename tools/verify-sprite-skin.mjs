import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {SPRITE_SKIN_MASKS} from '../game/sprite-skin-masks.js';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';import {SPRITE_SEQUENCES} from '../game/sprite-state.js';
export async function verifySpriteSkin(directory,requireAsset=()=>{}){
 const root=resolve(directory,'art/skin');requireAsset('/art/skin/manifest.json','skin-mask manifest');
 const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'))),base=JSON.parse(await readFile(resolve(directory,'art/illustrated/manifest.json')));
 const expected=Object.keys(SPRITE_APPEARANCES).flatMap(a=>SPRITE_SEQUENCES.map(s=>`${a}-${s}`)).sort();
 if(manifest.version!==1||Object.keys(manifest.masks).sort().join()!==expected.join()||[...SPRITE_SKIN_MASKS].sort().join()!==expected.join())throw Error('Skin-mask coverage mismatch');
 for(const name of expected){const mask=manifest.masks[name],source=base.atlases[name];
  if(mask.file!==name+'.png'||mask.sourceSha256!==source.sha256||mask.size.join()!==source.size.join())throw Error(`Skin-mask source mismatch: ${name}`);
  requireAsset(`/art/skin/${mask.file}`,'skin mask');const bytes=await readFile(resolve(root,mask.file));
  if(createHash('sha256').update(bytes).digest('hex')!==mask.sha256||bytes.readUInt32BE(16)!==source.size[0]||bytes.readUInt32BE(20)!==source.size[1])throw Error(`Skin-mask checksum or dimensions: ${name}`);
 }
}
