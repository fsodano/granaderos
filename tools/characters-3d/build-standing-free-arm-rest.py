#!/usr/bin/env python3
"""Bind the existing relaxed free left arm to three standing weapon idles."""
from pathlib import Path
import argparse,copy,hashlib,importlib.util,json,struct,subprocess
FIELD='standingFreeArmRest'
SOURCE='assets/source/characters-3d/authoring/standing_free_arm_rest.py'


def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result


def sha(raw):return hashlib.sha256(raw).hexdigest()


def json_sha(value):
    text=subprocess.check_output(['node','-e',"let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;process.stdin.on('end',()=>process.stdout.write(JSON.stringify(stable(JSON.parse(s)))));"],input=json.dumps(value),text=True)
    return sha(text.encode())


def encode(doc,binary):
    text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*(-len(text)%4)
    assert len(binary)%4==0
    return struct.pack('<III',0x46546c67,2,28+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+bytes(binary)


def recipe(root):
    paths=(SOURCE,'tools/characters-3d/build-standing-free-arm-rest.py','tools/characters-3d/standing_arm_context.py')
    return {'method':'native-relaxed-arm-with-bounded-chest-forward-forearm','sourceSha256':{path:sha((root/path).read_bytes())for path in paths},'donor':'stand.idle.unarmed','targets':['stand.idle.short-gun','stand.idle.blade','stand.idle.knife'],'rotationBones':['upperarm_l','lowerarm_l','hand_l'],'outwardForearmDegrees':{'male':4,'female':12},'retainInputClocksAndOtherChannels':True}


def restore_bank(doc,binary,meta):
    result=copy.deepcopy(doc);assert result.get('extras',{}).get(FIELD)==meta,'Inconsistent standing free arm bank receipt'
    clips={clip['name']:clip for clip in result['animations']}
    for patch in meta['patches']:
        clip=clips[patch['name']]
        for change in patch['channels']:
            assert clip['channels'][change['channel']]['sampler']==change['sampler'],'Changed standing free arm binding'
            clip['channels'][change['channel']]['sampler']=change['originalSampler']
        clip['samplers']=clip['samplers'][:patch['originalSamplerCount']]
    result['accessors']=result['accessors'][:meta['originalAccessorCount']];result['bufferViews']=result['bufferViews'][:meta['originalBufferViewCount']];result['buffers'][0]['byteLength']=meta['originalBufferByteLength'];binary=bytes(binary[:meta['originalBinaryBytes']])
    del result['extras'][FIELD]
    if not meta['originalHadExtras']:del result['extras']
    assert sha(bytes(binary))==meta['originalBinarySha256'] and json_sha(result)==meta['originalJSONSha256'],'Standing free arm predecessor data changed'
    assert sha(encode(result,binary))==meta['beforeSha256'],'Exact standing free arm bank restoration differs'
    return result,bytes(binary)


def restore_record(record):
    restored=copy.deepcopy(record);meta=restored.pop(FIELD);restored.update(bytes=meta['beforeBytes'],sha256=meta['beforeSha256'])
    assert json_sha(restored)==meta['originalRecordJSONSha256'],'Standing free arm predecessor record changed'
    return restored


def prepare(root,doc,binary,record,gender):
    author=module('standing_free_arm_recipe',root/SOURCE);updated,new_binary,patches=author.compose(doc,binary,gender)
    meta={'recipe':recipe(root),'anatomy':gender,'beforeSha256':record['sha256'],'beforeBytes':record['bytes'],'originalJSONSha256':json_sha(doc),'originalBinarySha256':sha(bytes(binary)),'originalBinaryBytes':len(binary),'originalBufferByteLength':doc['buffers'][0]['byteLength'],'originalAccessorCount':len(doc['accessors']),'originalBufferViewCount':len(doc['bufferViews']),'originalRecordJSONSha256':json_sha(record),'originalHadExtras':'extras'in doc,'patches':patches}
    updated.setdefault('extras',{})[FIELD]=meta;raw=encode(updated,new_binary);result=copy.deepcopy(record);result.update(bytes=len(raw),sha256=sha(raw));result[FIELD]=meta
    assert restore_bank(updated,new_binary,meta)==(doc,bytes(binary)) and restore_record(result)==record,'Full standing free arm restoration differs'
    return raw,result


def verify(root,doc,binary,record):
    meta=record[FIELD];assert meta['recipe']==recipe(root),'Changed standing free arm source recipe'
    before,old_binary=restore_bank(doc,binary,meta);old_record=restore_record(record);expected,expected_record=prepare(root,before,old_binary,old_record,meta['anatomy'])
    assert expected==encode(doc,binary) and expected_record==record,'Standing free arm output differs from native donor recipe'
    return {'targets':meta['recipe']['targets'],'changedRotationBindings':9,'originalBinaryPrefixExact':bytes(binary[:len(old_binary)])==old_binary,'appendedRotationBytes':len(binary)-len(old_binary),'oldBankAndRecordRestorationExact':True,'otherChannelsExact':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);parser.add_argument('--receipt',type=Path);parser.add_argument('--verify-only',action='store_true');args=parser.parse_args();root=args.root.resolve();assets=root/'web/public/models/characters';mp=assets/'manifest.json';initial=mp.read_bytes();manifest=json.loads(initial);source_recipe=recipe(root);glb=module('standing_free_arm_glb',root/'tools/characters-3d/merge-animation-bank.py');pending=[];rows={}
    assert set(manifest['animationLibraries'])=={'male','female'},'Standing free arm needs both native anatomy banks'
    for gender,record in manifest['animationLibraries'].items():
        assert record['url']==f'/models/characters/{gender}-animations.glb','Unowned standing free arm bank URL'
        if FIELD in record:assert record[FIELD]['anatomy']==gender,'Standing free arm anatomy receipt differs'
        path=assets/Path(record['url']).name;raw=path.read_bytes();assert sha(raw)==record['sha256'] and len(raw)==record['bytes'],'Standing free arm bank differs from manifest';doc,binary=glb.read_glb(path)
        assert (FIELD in record)==(FIELD in doc.get('extras',{})),'Ambiguous standing free arm state'
        if FIELD in record:rows[gender]=verify(root,doc,binary,record)
        else:
            assert not args.verify_only,'Standing free arm bank is not completed'
            next_raw,next_record=prepare(root,doc,binary,record,gender);next_doc,next_binary,_=module('standing_free_arm_recipe_check',root/SOURCE).compose(doc,binary,gender);next_doc.setdefault('extras',{})[FIELD]=next_record[FIELD]
            rows[gender]=verify(root,next_doc,next_binary,next_record);manifest['animationLibraries'][gender]=next_record;pending.append((path,raw,next_raw))
    assert mp.read_bytes()==initial,'Concurrent standing free arm manifest change'
    for path,before,after in pending:assert path.read_bytes()==before,'Concurrent standing free arm bank change'
    assert recipe(root)==source_recipe,'Concurrent standing free arm source recipe change'
    for path,before,after in pending:path.write_bytes(after)
    if pending:mp.write_text(json.dumps(manifest,indent=2)+'\n')
    receipt={'method':'standing-native-free-arm-rest','banks':rows,'changedFiles':sorted([path.name for path,_,_ in pending]+(['manifest.json']if pending else[])),'exactNoOp':not pending,'geometryBytesAdded':0,'rotationBytesAdded':sum(row['appendedRotationBytes']for row in rows.values())}
    if args.receipt:args.receipt.parent.mkdir(parents=True,exist_ok=True);args.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
    print('STANDING_FREE_ARM_READY',json.dumps(receipt))


if __name__=='__main__':main()
