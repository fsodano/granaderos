#!/usr/bin/env python3
"""Change only selected native climb finger rotations on the current banks."""
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
import argparse,copy,hashlib,json,math,struct,subprocess


def module(name,path):
    spec=spec_from_file_location(name,path);out=module_from_spec(spec);spec.loader.exec_module(out);return out


def values(doc,data,index,size):
    a=doc['accessors'][index];assert a['componentType']==5126 and not a.get('normalized'),'Expected retained float native source'
    view=doc['bufferViews'][a['bufferView']];offset=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',size*4)
    return [struct.unpack_from('<'+'f'*size,data,offset+i*stride)for i in range(a['count'])]


def prove(original,updated,recipe,channels):
    before,data=original;after,newdata=updated;old=channels(before,data);new=channels(after,newdata)
    assert list(old)==list(new),'Native motion inventory/order changed'
    changed=[]
    for name,tracks in old.items():
        assert set(tracks)==set(new[name]),name+' target inventory changed'
        for key,payload in tracks.items():
            current=new[name][key]
            if name in recipe.NAMES and key[0]in recipe.FINGERS and key[1]=='rotation':
                assert payload[:2]==current[:2],'Native interpolation/clock changed'
                if payload!=current:changed.append((name,*key))
            else:assert payload==current,str((name,key))+' retained native channel changed'
    assert len(changed)==len(recipe.NAMES)*len(recipe.FINGERS),'Expected exact bounded finger inventory'
    for key,value in before.items():
        if key not in('animations','accessors','bufferViews','buffers'):assert value==after[key],key+' retained asset data changed'
    assert bytes(newdata[:len(data)])==bytes(data),'Original binary geometry/skin/motion prefix changed'
    return {'clips':len(old),'untouchedClips':len(old)-2,'changedRotationChannels':changed,'nativeClockInputsExact':True,'allOtherChannelsExact':True,'nativeRigMeshSkinAndPrefixExact':True}



def retained_before(doc,data,recipe):
    """Recover the byte-identical retained input of this named transplant."""
    result=copy.deepcopy(doc);accessors=[];sampler_starts=[];restored=0
    for animation in result['animations']:
        if animation['name'] not in recipe.NAMES:continue
        starts=[]
        for channel in animation['channels']:
            sampler=animation['samplers'][channel['sampler']];old=sampler.get('extras',{}).get('nativeRoofFingerBeforeSampler')
            if old is None:continue
            assert isinstance(old,int) and 0<=old<channel['sampler'],'Invalid retained predecessor sampler'
            assert animation['samplers'][old]['input']==sampler['input'],'Retained key clock mismatch'
            starts.append(channel['sampler']);accessors.append(sampler['output']);channel['sampler']=old;restored+=1
        assert len(starts)==len(recipe.FINGERS),'Expected complete retained finger predecessor'
        del animation['samplers'][min(starts):]
    assert restored==len(recipe.NAMES)*len(recipe.FINGERS),'Expected bounded two-clip predecessor'
    first_accessor=min(accessors);views=[result['accessors'][i]['bufferView'] for i in accessors];first_view=min(views);length=min(result['bufferViews'][i]['byteOffset'] for i in views)
    del result['accessors'][first_accessor:];del result['bufferViews'][first_view:];result['buffers'][0]['byteLength']=length
    return result,bytearray(data[:length])


def main():
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--receipt',type=Path);a=p.parse_args();root=a.root.resolve()
    authoring=root/'assets/source/characters-3d/authoring';recipe=module('climb_palm_recipe',authoring/'climb_palm_support.py');merge=module('climb_palm_glb',root/'tools/characters-3d/merge-animation-bank.py');gesture=module('climb_palm_channels',root/'tools/characters-3d/build-gesture-support.py')
    out=root/'web/public/models/characters';manifest_path=out/'manifest.json';assert not manifest_path.is_symlink(),'Use private or owned manifest output';manifest=json.loads(manifest_path.read_text());before_manifest=copy.deepcopy(manifest);receipt={};pending=[]
    source=hashlib.sha256((authoring/'climb_palm_support.py').read_bytes()).hexdigest()
    for gender in('male','female'):
        bank=manifest['animationLibraries'][gender];path=out/Path(bank['url']).name;assert not path.is_symlink(),'Use private or owned bank output';assert hashlib.sha256(path.read_bytes()).hexdigest()==bank['sha256'],'Bank does not match current manifest'
        assert all('nativeRoofFingerSupport'not in c for c in bank['clips']if c['name']in recipe.NAMES),'Refuse to apply roof relief twice'
        doc,data=merge.read_glb(path);updated=copy.deepcopy(doc);binary=bytearray(data);nodes={n['name']:i for i,n in enumerate(doc['nodes'])};preset='granadero'if gender=='male'else'woman-scout';body,_=merge.read_glb(out/(preset+'-lod0.glb'));bind={n['name']:tuple(n.get('rotation',[0,0,0,1]))for n in body['nodes']}
        for name in recipe.FINGERS:assert name in nodes and name in bind,'Missing actual native finger'
        clips={x['name']:x for x in updated['animations']};assert recipe.NAMES<=set(clips)
        for name in sorted(recipe.NAMES):
            anim=clips[name]
            for channel in anim['channels']:
                target=channel['target'];bone=updated['nodes'][target['node']]['name']
                if target['path']!='rotation'or bone not in recipe.FINGERS:continue
                oldsampler=anim['samplers'][channel['sampler']];times=[v[0]for v in values(doc,data,oldsampler['input'],1)];quats=values(doc,data,oldsampler['output'],4);assert len(times)==len(quats);duration=max(times);assert duration>0
                assert all(math.isfinite(t) for t in times) and all(x<y for x,y in zip(times,times[1:])), 'Expected finite increasing native keys'
                assert oldsampler.get('interpolation','LINEAR')=='LINEAR', 'Expected retained linear native rotations'
                assert all(all(math.isfinite(v) for v in q) and sum(v*v for v in q)>1e-12 for q in quats), 'Expected finite native quaternions'
                rows=[recipe.slerp(q,bind[bone],recipe.relief_weight(name,bone[-1],time,duration))for time,q in zip(times,quats)]
                assert all(all(math.isfinite(v) for v in q) and abs(sum(v*v for v in q)-1)<1e-5 for q in rows), 'Expected finite unit roof-finger output'
                while len(binary)%4:binary.append(0)
                offset=len(binary);raw=struct.pack('<'+'f'*(len(rows)*4),*(v for row in rows for v in row));binary.extend(raw)
                view=len(updated['bufferViews']);updated['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
                accessor=len(updated['accessors']);updated['accessors'].append({'bufferView':view,'componentType':5126,'count':len(rows),'type':'VEC4'})
                sampler=copy.deepcopy(oldsampler);sampler['output']=accessor
                sampler.setdefault('extras',{})['nativeRoofFingerBeforeSampler']=channel['sampler']
                channel['sampler']=len(anim['samplers']);anim['samplers'].append(sampler)
        updated['buffers'][0]['byteLength']=len(binary)
        proof=prove((doc,data),(updated,binary),recipe,gesture.channels)
        temp=out/('palm-support-pending-'+gender+'.glb');merge.write_glb(temp,updated,binary);raw=temp.read_bytes();temp.unlink();bank['sha256']=hashlib.sha256(raw).hexdigest();bank['bytes']=len(raw)
        for clip in bank['clips']:
            if clip['name']in recipe.NAMES:clip['nativeRoofFingerSupport']={'method':'existing-native-roof-finger-curl-relief','curlReliefRadians':recipe.CURL_RELIEF,'channels':'index-middle-ring-pinky-rotations-only','sourceSha256':source,'preservedNativeParentsAndClocks':True}
        receipt[gender]={'sha256':bank['sha256'],'beforeSha256':before_manifest['animationLibraries'][gender]['sha256'],'proof':proof};pending.append((path,raw))
    for key,value in before_manifest.items():
        if key!='animationLibraries':assert value==manifest[key],'Unrelated manifest data changed'
    for gender,old in before_manifest['animationLibraries'].items():
        current=copy.deepcopy(manifest['animationLibraries'][gender])
        current['sha256']=old['sha256'];current['bytes']=old['bytes']
        for clip in current['clips']:
            if clip['name'] in recipe.NAMES:clip.pop('nativeRoofFingerSupport',None)
        assert current==old,'Retained animation metadata, markers or dimensions changed'
    canonical=subprocess.run(['node','-e','let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+"\\n"));'],input=json.dumps(manifest,allow_nan=False),text=True,capture_output=True,check=True).stdout
    # Complete both preservation checks and canonicalization before installation.
    for path,raw in pending:path.write_bytes(raw)
    manifest_path.write_text(canonical)
    if a.receipt:a.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
    print('NATIVE_CLIMB_FINGER_RELIEF_READY',json.dumps(receipt),flush=True)


if __name__=='__main__':main()
