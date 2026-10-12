import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import sharp from '../web/node_modules/sharp/lib/index.js';

const root=new URL('..',import.meta.url);
const python=source=>JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import sys,base64,copy,hashlib,importlib.util,io,json,shutil,struct,tempfile,zlib
from PIL import Image,features
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
import apparel_png_replay as portable
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
sha=lambda raw:hashlib.sha256(raw).hexdigest()
`+source],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));

test('alternate zlib bytes reproduce the CI failure while portable replay retains exact published pixels, GLBs and PNGs',()=>{
 const result=python(String.raw`
assets=root/'web/public/models/characters'
pins={str(p.relative_to(assets)):sha(p.read_bytes())for p in assets.rglob('*')if p.is_file()}
legacy=module('portable_negative_frozen',root/'tools/characters-3d/build-apparel-surfaces.py')
legacy.png_bytes=lambda image:portable.deterministic_png(image)
try:legacy.verify_completed(root,['granadero']);raise RuntimeError('Alternate encoded bytes unexpectedly passed frozen byte comparison')
except AssertionError as error:assert 'Delivered apparel surface differs from its recipe' in str(error)
catalog,approved=portable.approved_images(root)
sample=next(iter(approved.values()));image=Image.open(io.BytesIO(sample));image.load();alternate=portable.deterministic_png(image)
assert sample!=alternate and Image.open(io.BytesIO(alternate)).tobytes()==image.tobytes()
def forbidden(*args,**kwargs):raise RuntimeError('Host PNG/compressor must not run')
old_save,old_compress=Image.Image.save,zlib.compress
Image.Image.save=zlib.compress=forbidden
try:
 installer=portable.load_installer(root);result=installer.verify_completed(root,['granadero'])
 assert not result['pending']
 for uri,png in result['textures'].items():assert (assets/uri).read_bytes()==png
 assert installer.png_bytes(image)==sample
 changed=image.copy();pixel=list(changed.getpixel((0,0)));pixel[0]^=1;changed.putpixel((0,0),tuple(pixel));assert installer.png_bytes(changed)!=sample
 wrong_mode=image.convert('RGBA');assert installer.png_bytes(wrong_mode)!=sample
 wrong_size=Image.frombytes(image.mode,(image.width//2,image.height*2),image.tobytes());assert installer.png_bytes(wrong_size)!=sample
finally:Image.Image.save,zlib.compress=old_save,old_compress
assert pins=={str(p.relative_to(assets)):sha(p.read_bytes())for p in assets.rglob('*')if p.is_file()}
print(json.dumps({'alternateEncodingRejectedByFrozenVerifier':True,'decodedPixelsExact':True,'hostEncodersForbidden':True,'portableReplayExact':True,'differentPixelsModeAndSizeNotAliased':True,'releasedFilesUnchanged':True,'approvedImages':len(approved),'Pillow':features.version('pil'),'PillowZlib':features.version('zlib'),'stdlibZlib':zlib.ZLIB_RUNTIME_VERSION}))
`);
 for(const key of ['alternateEncodingRejectedByFrozenVerifier','decodedPixelsExact','hostEncodersForbidden','portableReplayExact','differentPixelsModeAndSizeNotAliased','releasedFilesUnchanged'])assert.equal(result[key],true);
 assert.equal(result.approvedImages,56);
});

test('fresh RGB and RGBA pixels have exact portable bytes and independent decoded pixels across multiple deflate blocks',async()=>{
 const result=python(String.raw`
results=[]
def forbidden(*args,**kwargs):raise RuntimeError('Host PNG/compressor must not run')
old_save,old_compress=Image.Image.save,zlib.compress
Image.Image.save=zlib.compress=forbidden
try:
 for mode,channels in [('RGB',3),('RGBA',4)]:
  width,height=200,160;raw=bytes((i*37+11)%256 for i in range(width*height*channels));image=Image.frombytes(mode,(width,height),raw)
  encoded=portable.deterministic_png(image);assert encoded==portable.deterministic_png(image.copy())
  decoded=Image.open(io.BytesIO(encoded));decoded.load();assert decoded.mode==mode and decoded.size==(width,height) and decoded.tobytes()==raw
  pos=8;parts=[]
  while pos<len(encoded):
   size=struct.unpack_from('>I',encoded,pos)[0];kind=encoded[pos+4:pos+8];body=encoded[pos+8:pos+8+size];assert struct.unpack_from('>I',encoded,pos+8+size)[0]==zlib.crc32(kind+body)&0xffffffff;parts.append((kind,body));pos+=12+size
  assert [kind for kind,_ in parts]==[b'IHDR',b'IDAT',b'IEND'];packed=parts[1][1];assert packed[:2]==b'\x78\x01';p=2;blocks=[]
  while True:
   final=packed[p];length,negative=struct.unpack_from('<HH',packed,p+1);assert final in (0,1) and negative==length^65535;blocks.append(packed[p+5:p+5+length]);p+=5+length
   if final:break
  assert len(blocks)>1 and p+4==len(packed);scanlines=b''.join(blocks);assert zlib.decompress(packed)==scanlines
  assert scanlines==b''.join(b'\0'+raw[y*width*channels:(y+1)*width*channels]for y in range(height))
  results.append({'mode':mode,'width':width,'height':height,'channels':channels,'pngBase64':base64.b64encode(encoded).decode(),'pngSha256':sha(encoded),'pixelSha256':sha(raw),'blocks':len(blocks)})
finally:Image.Image.save,zlib.compress=old_save,old_compress
print(json.dumps(results))
`);
 for(const row of result){
  const png=Buffer.from(row.pngBase64,'base64'),decoded=await sharp(png).raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([decoded.info.width,decoded.info.height,decoded.info.channels],[row.width,row.height,row.channels]);
  const expected=Buffer.from(Array.from({length:row.width*row.height*row.channels},(_,i)=>(i*37+11)%256));assert.deepEqual(decoded.data,expected,'The independent renderer image decoder gets every authored byte.');assert.ok(row.blocks>1);
 }
 assert.deepEqual(result.map(row=>row.pngSha256),['8d7876c10402a34383be9968af1f6fc1ee4f6015b3ff06b6372d29fd2b109d81','de967dda71fb00b9e268cb21d099df2e3ecaa900370bf7b48838a5ddf56e652b']);
});

test('portable replay rejects altered catalog, frozen or already-loaded source and roots before any installation',()=>{
 const result=python(String.raw`
rejected=[]
with tempfile.TemporaryDirectory(prefix='granaderos-portable-png-')as folder:
 target=Path(folder).resolve()/'root';tools=target/'tools/characters-3d';tools.mkdir(parents=True);authoring=target/'assets/source/characters-3d/authoring';authoring.mkdir(parents=True)
 for name in ['build-apparel-surfaces.py','merge-animation-bank.py','apparel_png_replay.py']:shutil.copy2(root/'tools/characters-3d'/name,tools/name)
 for name in ['apparel_surfaces.py','cloth_depth.py','family_cloth_depth.py','apparel_png_replay_v1.json']:shutil.copy2(root/'assets/source/characters-3d/authoring'/name,authoring/name)
 assets=target/'web/public/models/characters';assets.mkdir(parents=True);shutil.copy2(root/'web/public/models/characters/manifest.json',assets/'manifest.json')
 for lod in (0,1,2):shutil.copy2(root/f'web/public/models/characters/granadero-lod{lod}.glb',assets/f'granadero-lod{lod}.glb')
 (assets/'textures').symlink_to((root/'web/public/models/characters/textures').resolve(),target_is_directory=True)
 index=target/portable.CATALOG;source=tools/'build-apparel-surfaces.py';adapter=tools/'apparel_png_replay.py'
 def expect_failure(action,label):
  try:action();raise RuntimeError('Unexpected trust fallback: '+label)
  except (AssertionError,FileNotFoundError):rejected.append(label)
 for path,label in [(index,'catalog'),(source,'frozen-installer'),(authoring/'apparel_surfaces.py','recipe')]:
  raw=path.read_bytes();path.write_bytes(raw+b'\n# changed\n');expect_failure(lambda:portable.load_installer(target),label);path.write_bytes(raw)
 raw=index.read_bytes();index.unlink();expect_failure(lambda:portable.load_installer(target),'missing-catalog');index.write_bytes(raw)
 assets_before={str(p.relative_to(assets)):sha(p.read_bytes())for p in assets.rglob('*')if p.is_file()}
 loaded=module('copied_loaded_portable_adapter',adapter);raw=adapter.read_bytes();assert loaded.ADAPTER_SHA256==sha(raw)
 adapter.write_bytes(raw+b'\n# Changed after module import, before load_installer.\n')
 expect_failure(lambda:loaded.load_installer(target),'changed-loaded-adapter')
 assert assets_before=={str(p.relative_to(assets)):sha(p.read_bytes())for p in assets.rglob('*')if p.is_file()};adapter.write_bytes(raw)
 installer=portable.load_installer(target);expect_failure(lambda:installer.prepare(root,['granadero'],completed_only=True,include_equipment=False),'foreign-root')
 prepared=installer.prepare(target,['granadero'],completed_only=True,include_equipment=False);assert not prepared['pending']
 assert index in prepared['pins'] and adapter in prepared['pins']
 before={str(p.relative_to(assets)):sha(p.read_bytes())for p in assets.rglob('*')if p.is_file()}
 for path,label in [(index,'concurrent-catalog'),(adapter,'concurrent-adapter')]:
  raw=path.read_bytes();path.write_bytes(raw+b'\n');expect_failure(lambda:installer.install(prepared),label);assert before=={str(p.relative_to(assets)):sha(p.read_bytes())for p in assets.rglob('*')if p.is_file()};path.write_bytes(raw)
print(json.dumps({'rejected':rejected,'predecessorAndApprovedAssetsUnchanged':True}))
`);
 assert.deepEqual(result.rejected,['catalog','frozen-installer','recipe','missing-catalog','changed-loaded-adapter','foreign-root','concurrent-catalog','concurrent-adapter']);assert.equal(result.predecessorAndApprovedAssetsUnchanged,true);
});

test('the external frozen-context adapter redirects only the admitted apparel command and preserves its arguments',()=>{
 const result=python(String.raw`
import coarse_garment_context as context
context_before=(root/'tools/characters-3d/coarse_garment_context.py').read_bytes();assert sha(context_before)==portable.FROZEN_COARSE_CONTEXT_SHA256
command=[sys.executable,str(root/'tools/characters-3d/build-apparel-surfaces.py'),'--root',str(root),'--presets','granadero','--verify-only','--no-equipment'];before=list(command)
redirected=portable.portable_replay_command(command);assert command==before and redirected[0]==command[0] and redirected[2:]==command[2:]
assert redirected[1]==str(root/'tools/characters-3d/apparel_png_replay.py')
for other in [[sys.executable,'-c','print(1)'],[sys.executable,str(root/'tools/characters-3d/build-cloth-depth.py'),'--root',str(root)]]:assert portable.portable_replay_command(other)is other
try:portable.portable_replay_command([*command[:3],str(root.parent),*command[4:]]);raise RuntimeError('A forged root was accepted')
except AssertionError:pass
calls=[];original=context._run_frozen;context._run_frozen=lambda value:calls.append(value)
try:
 portable.bind_frozen_replay_commands();bound=context._run_frozen;portable.bind_frozen_replay_commands();assert context._run_frozen is bound
 context._run_frozen(command);assert calls==[redirected]
finally:context._run_frozen=original
assert context_before==(root/'tools/characters-3d/coarse_garment_context.py').read_bytes()
print(json.dumps({'frozenContextExact':True,'onlyApparelCommandChanged':True,'argumentsAndInputExact':True,'wrongRootRejected':True,'idempotentBinding':True}))
`);
 assert.ok(Object.values(result).every(value=>value===true));assert.equal(Object.keys(result).length,5);
});
