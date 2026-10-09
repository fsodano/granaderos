#!/usr/bin/env python3
"""Rebuild the tactical human, equipment and horse library with Blender.

Usage: python3 tools/characters-3d/build-library.py [--only appearance|garments|equipment|horse|animations] [--preset ID] [--lod N] [--review]
The approved playground is never read or changed by this production builder.
"""
from pathlib import Path
import argparse,subprocess,sys,json,os,struct,concurrent.futures,hashlib,tempfile,shutil
from library_manifest import checked_job_records, merge_job_manifest, strict_json
from library_jobs import current_job_pins, prepared_job_files, install_job_files
from importlib.util import spec_from_file_location, module_from_spec
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'assets/source/characters-3d/authoring';OUT=ROOT/'web/public/models/characters';META=HERE/'.build'
PRESETS=['granadero','royalist','worker','surgeon','gaucho','friar','woman-scout','woman-shawl']
p=argparse.ArgumentParser();p.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender');p.add_argument('--only',choices=['appearance','garments','equipment','horse','animations']);p.add_argument('--preset',choices=PRESETS);p.add_argument('--lod',type=int,choices=[0,1,2]);p.add_argument('--review',action='store_true');p.add_argument('--jobs',type=int,default=2);p.add_argument('--manifest-only',action='store_true');a=p.parse_args()
previous_manifest=strict_json((OUT/'manifest.json').read_text())if(OUT/'manifest.json').exists()else{}
manifest_before=(OUT/'manifest.json').read_bytes()if(OUT/'manifest.json').exists()else None
jobs=[]
private_jobs=None;JOB_OUT=OUT;JOB_META=META;job_pins={};coarse_records={}
if not a.manifest_only:
 for kind in ([a.only]if a.only else ['appearance','garments','equipment','horse','animations']):
  presets=([a.preset]if a.preset else PRESETS)if kind=='appearance' else ['granadero','woman-scout']if kind in ('garments','animations')else ['granadero']
  lods=([a.lod]if a.lod is not None else [0,1,2])if kind in ('appearance','horse')else[0]
  for preset in presets:
   for lod in lods:jobs.append((kind,preset,lod))
 job_pins=current_job_pins(OUT,jobs)
 private_jobs=Path(tempfile.mkdtemp(prefix='granaderos-source-jobs-'))
 JOB_OUT=private_jobs/'assets';JOB_META=private_jobs/'metadata'
 JOB_OUT.mkdir();JOB_META.mkdir()
 print('PRIVATE_SOURCE_JOBS',private_jobs,flush=True)
 def run(job):
  kind,preset,lod=job;log=JOB_META/(kind+'-'+preset+'-'+str(lod)+'.log')
  cmd=[a.blender,'--background','--factory-startup','--python',str(HERE/'build.py'),'--',kind,'--preset',preset,'--lod',str(lod),'--output-dir',str(JOB_OUT),'--metadata-dir',str(JOB_META)]+(['--review']if a.review else[])
  with log.open('w')as f:r=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
  # Blender can return0 after Python exceptions; verify the explicit completion.
  content=log.read_text()
  if r.returncode or 'ASSET_READY'not in content:raise RuntimeError(str(log)+'\n'+content[-3500:])
  print(next(line for line in content.splitlines()if line.startswith('ASSET_READY')),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=a.jobs)as pool:list(pool.map(run,jobs))
byname=checked_job_records(JOB_META,JOB_OUT,jobs)
if any(kind=='appearance' and preset=='gaucho' and lod in (1,2) for kind,preset,lod in jobs):
 spec=spec_from_file_location('source_coarse_graft',ROOT/'tools/characters-3d/build-coarse-garment-surfaces.py');coarse=module_from_spec(spec);spec.loader.exec_module(coarse)
 coarse_records,coarse_files,coarse_receipt=coarse.prepare_selected_jobs(ROOT,jobs,JOB_OUT)
 for name,raw in coarse_files.items():
  path=JOB_OUT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
 for name,record in coarse_records.items():
  byname[name].update(record)
  raw=(JOB_OUT/name).read_bytes();document=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
  for image in document.get('images',[]):
   uri=image.get('uri')
   if uri and not (JOB_OUT/uri).exists():
    target=JOB_OUT/uri;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((OUT/uri).read_bytes())
 if coarse_records:(JOB_META/'coarse-garment-graft-receipt.json').write_text(json.dumps(coarse_receipt,indent=2)+'\n')
job_files=prepared_job_files(JOB_OUT,byname)if jobs else{}
bones={'root':'Root','hips':'pelvis','spine':'spine_02','chest':'spine_03','neck':'neck_01','head':'head','handRight':'hand_r','handLeft':'hand_l','footRight':'foot_r','footLeft':'foot_l'}
manifest={'version':1,'units':'metres','up':'+Y','forward':'+Z','bodyHeight':1.76,'bones':bones,'skinTones':{'light':'#d5a07d','brown':'#9d6844','dark':'#623c29'},'appearances':{},'animationLibraries':{},'equipment':{'url':'/models/characters/equipment.glb','items':{}},'garments':{},'horse':{},'provenance':'assets/source/characters-3d/README.md'}
native_path=JOB_OUT/'granadero-lod0.glb'if(JOB_OUT/'granadero-lod0.glb').exists()else OUT/'granadero-lod0.glb'
if native_path.exists():
 raw=native_path.read_bytes();document=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
 native_names=[document['nodes'][index]['name']for index in document['skins'][0]['joints']]
 mirror={name:name[:-2]+('_r'if name.endswith('_l')else'_l')if name.endswith(('_l','_r'))else name for name in native_names}
 assert len(mirror)==53 and all(mirror.get(other)==name for name,other in mirror.items())
 manifest['animationMirroring']={'axis':'x','bones':mirror}
for preset in PRESETS:
 gender='female'if preset.startswith('woman-')else'male';lods=[byname[preset+'-lod'+str(i)+'.glb']for i in range(3)if preset+'-lod'+str(i)+'.glb'in byname]
 manifest['appearances'][preset]={'id':preset,'gender':gender,'height':1.76,'animationLibrary':gender,'lods':[{k:f[k]for k in ('lod','url','triangles','bytes','drawCalls','sha256')}for f in lods],'materials':{'skin':'Skin','apparel':'Apparel_Atlas'},'parts':{part:'Human_'+part+'_LOD{lod}'for part in ('skin','outfit','legwear','footwear','headwear')},'sockets':lods[0]['sockets']if lods else{},'lodPixelThresholds':[120,65,0],'baseAttire':{'headwear':'appearance','outfit':'appearance','legwear':'appearance'},'nullWornItem':'keepBaseAttire'}
 sockets=manifest['appearances'][preset]['sockets']
 if 'handLeft_pistol'in sockets:sockets['handLeft_pistol']['mirror']={'socket':'handRight_pistol','localAxis':'z'}
for gender in ('male','female'):
 name=gender+'-animations.glb'
 if name in byname:manifest['animationLibraries'][gender]={k:byname[name][k]for k in ('url','bytes','sha256','clips','locomotionSpeed')}
 if gender in manifest['animationLibraries']:
  bank=manifest['animationLibraries'][gender];bank['anchorCoordinates']={'space':'model-local','units':'metres','up':'+Y','forward':'+Z'}
  anchor=next((c['seatAnchor']for c in bank['clips']if 'seatAnchor'in c),[0,-.025,.945])
  for clip in bank['clips']:
   if 'seatAnchor'in clip or clip.get('gesture')in ('mount','dismount'):
    x,y,z=clip.get('seatAnchor',anchor);clip['seatAnchor']=[x,z,-y];clip['seatAnchorSpace']='gltf-model-local'
   if clip.get('gesture')in ('mount','dismount')and not clip.get('seatWeight'):
    mount=clip['gesture']=='mount';clip['seatWeight']=[{'time':0,'weight':0 if mount else 1},{'time':clip['markers']['seat'],'weight':1 if mount else 0},{'time':clip['duration'],'weight':1 if mount else 0}]
   if clip.get('posture')=='mounted'and clip.get('gesture')in ('die','collapse','knockdown'):
    clip['seatWeight']=[{'time':0,'weight':1},{'time':clip['markers']['ground'],'weight':0},{'time':clip['duration'],'weight':0}]
 name=gender+'-garments.glb'
 if name in byname:manifest['garments'][gender]={'url':byname[name]['url'],'items':{'poncho':{'node':'garment_poncho','slot':'outfit','hideAppearanceParts':[]},'linen_shirt':{'node':'garment_linen_shirt','slot':'outfit','hideAppearanceParts':['outfit']},'trousers':{'node':'garment_trousers','slot':'legwear','hideAppearanceParts':['legwear']},'hat':{'node':'garment_hat','slot':'headwear','hideAppearanceParts':['headwear']}}}
if 'equipment.glb'in byname:manifest['equipment'].update({k:byname['equipment.glb'][k]for k in ('bytes','sha256','items')})
item_overrides=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ACTOR_ITEM_CLIP_OVERRIDES} from './game/actor-action-contract.js';console.log(JSON.stringify(ACTOR_ITEM_CLIP_OVERRIDES));"],cwd=ROOT,text=True))
for item,binding in item_overrides.items():
 if item in manifest['equipment']['items']:manifest['equipment']['items'][item]['clipOverrides']=binding
manifest['equipment']['aliases']={'medical':'medkits','medkit':'medkits','torch':'torches','bolas':'boleadoras','ration':'rations','ammo':'ammunition','inventory:key':'key','inventory:lockpick':'lockpick','inventory:crowbar':'crowbar','inventory:pliers':'pliers'}
manifest['equipment']['fittings']={'india_socket':{'node':'item_1811','hostWeapon':1800,'position':[1.045,.055,.018],'rotation':[0,0,-1.5707963267948966],'scale':1}}
horses=[byname['horse-lod'+str(i)+'.glb']for i in range(3)if 'horse-lod'+str(i)+'.glb'in byname]
if horses:manifest['horse']={'height':1.51,'saddle':horses[0]['saddle'],'lods':[{k:h[k]for k in ('lod','url','triangles','bytes','sha256')}for h in horses],'clips':horses[0]['clips'],'actions':{'idle':'HorseIdle','walk':'HorseWalk','run':'HorseRun'},'riderSeatLocal':'clip.seatAnchor'}
manifest['complete']=all(len(x['lods'])==3 for x in manifest['appearances'].values())and len(manifest['animationLibraries'])==2 and len(manifest['garments'])==2 and len(horses)==3 and bool(manifest['equipment']['items'])
manifest=merge_job_manifest(previous_manifest,manifest,OUT,jobs,{name:JOB_OUT/name for name in byname})
# A proved graft retains all original native support and layered receipts. The
# ordinary source export's six-field summary must never discard that lineage.
for name,record in coarse_records.items():
 preset=name.rsplit('-lod',1)[0];index=next(i for i,row in enumerate(manifest['appearances'][preset]['lods']) if row['lod']==record['lod'])
 manifest['appearances'][preset]['lods'][index]=record
canonical=subprocess.check_output(['node','-e',"let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"],input=json.dumps(manifest),text=True)
assert strict_json(canonical)==manifest,'Canonical manifest changes source values'
assert((OUT/'manifest.json').read_bytes()if(OUT/'manifest.json').exists()else None)==manifest_before,'Concurrent source manifest change'
if coarse_records:coarse._check_source_inputs(JOB_OUT,coarse_receipt['sourceInputs'])
if jobs:install_job_files(OUT,job_files,job_pins)
OUT.mkdir(parents=True,exist_ok=True)
if not (OUT/'manifest.json').exists() or (OUT/'manifest.json').read_text()!=canonical:(OUT/'manifest.json').write_text(canonical)
print('Manifest written; complete=',manifest['complete'])
if private_jobs:
 if a.review:print('PRIVATE_REVIEW_READY',JOB_META,flush=True)
 else:shutil.rmtree(private_jobs)
if manifest['complete']:
 # The general bank uses 30 Hz. Native ladder contacts need 60 Hz keys and
 # exact final-frame timing; retain the rest of each complete bank.
 if any(kind=='animations'for kind,preset,lod in jobs):
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-motion-increment.py'),'--blender',a.blender,'--gesture','climbUp','--gesture','climbDown','--equipment','any'],cwd=ROOT,check=True)
  # Clear planted roof fingertips only after fresh native climb channels.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-climb-palm-support.py')],cwd=ROOT,check=True)
  # Keep the released rifle guard soles supported after native retargeting.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-guard-support.py'),'--blender',a.blender],cwd=ROOT,check=True)
  # The bayonet retains its own Root/pelvis and native support gate.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-guard-support.py'),'--blender',a.blender,'--clip','stand.bayonet.long-gun'],cwd=ROOT,check=True)
  # Preserve native upper reach gestures and correct only their leg support.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-gesture-support.py'),'--blender',a.blender],cwd=ROOT,check=True)
  # Prone rifle work retains its own body/weapon tracks and the already
  # supported native prone idle leg pose, with exact source input clocks.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-prone-rifle-support.py')],cwd=ROOT,check=True)
  # Preserve each native body and weapon contact for remaining prone firearm work.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-prone-work-support.py')],cwd=ROOT,check=True)
  # Retain body/hand/item channels while supporting fixed prone interactions.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-prone-interaction-support.py')],cwd=ROOT,check=True)
  # Retain pistol grip/body clocks and support the native free forearm.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-prone-pistol-forearm-support.py')],cwd=ROOT,check=True)
  # Bake rifle elbow planes from each retained native wrist and body curve.
  subprocess.run(['node',str(ROOT/'tools/characters-3d/build-prone-rifle-arm-support.mjs')],cwd=ROOT,check=True)
  # Prone self-care keeps the opposite native forearm supported, with clear fingers.
  subprocess.run(['node',str(ROOT/'tools/characters-3d/build-prone-heal-arm-support.mjs')],cwd=ROOT,check=True)
  # Preserve the retained 30 Hz parent trajectory and fit crouched boot support
  # at 60 Hz without replacing native upper-body, Root or pace channels.
  leg_bones=[name+'_'+side for side in ('l','r')for name in ('thigh','calf','foot','ball')]
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-motion-increment.py'),'--blender',a.blender,'--posture','crouched','--gesture','strafeLeft','--gesture','strafeRight','--equipment','unarmed','--metadata-field','nativeSidewaysSupport','--existing-only']+[argument for bone in leg_bones for argument in ('--bone',bone)],cwd=ROOT,check=True)
  # The five owned equipment poses retain that exact native parent path.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-equipped-crouch-support.py')],cwd=ROOT,check=True)
  # Raised crouched guards retain the same supported native lower body.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-crouched-guard-support.py')],cwd=ROOT,check=True)
  # Retain the complete current bank and clocks; restore only the reviewed
  # standing sabre thrust right-arm/wrist/thumb rotation set.
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-standing-blade-wrists.py')],cwd=ROOT,check=True)
 else:subprocess.run(['node',str(ROOT/'tools/characters-3d/compile-locomotion-profile.mjs')],cwd=ROOT,check=True)
 # Fit existing long-cloth shapes only after the final native support poses.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-long-cloth-support.py')],cwd=ROOT,check=True)
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-close-long-cloth-boot-support.py')],cwd=ROOT,check=True)
 # Reuse the reviewed close sewn surface before adding its colour detail.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-reviewed-long-cloth-lods.py')],cwd=ROOT,check=True)
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-woman-shawl-palette.py')],cwd=ROOT,check=True)
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-woman-shawl-hem.py')],cwd=ROOT,check=True)
 # A fresh hem appends UV1 after the first coarse packing. Finalize the complete
 # donor surface now so the first complete source build is already canonical.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-reviewed-long-cloth-lods.py')],cwd=ROOT,check=True)
 # The first garment form pilot appends colours to the completed released
 # bodies. It retains native geometry, faces, maps and all animation banks.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-layered-cloth-depth.py'),'--layer','pilot'],cwd=ROOT,check=True)
 # The independent six-family recipe keeps the accepted pilot bytes exact.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-layered-cloth-depth.py'),'--layer','family'],cwd=ROOT,check=True)
 # Keep the accepted cloth form/hem stages exact below a reversible material
 # layer. This last pass adds broad pigment, boot wear and matte gun fittings.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-apparel-surfaces.py')],cwd=ROOT,check=True)

 # Strict correction lineage and final donor checks remain explicit after the
 # complete native and frozen colour replay. Library rig checks are separate.
 subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-coarse-garment-surfaces.py'),'--verify-only'],cwd=ROOT,check=True)

 # Apply the three independent standing rest bindings after native bank
 # authoring and all body layers. Completed banks verify without writes.
 if all({'stand.idle.unarmed','stand.idle.short-gun','stand.idle.blade','stand.idle.knife'}.issubset({clip['name'] for clip in bank.get('clips',[])}) for bank in manifest['animationLibraries'].values()):
  subprocess.run([sys.executable,str(ROOT/'tools/characters-3d/build-standing-free-arm-rest.py')],cwd=ROOT,check=True)
