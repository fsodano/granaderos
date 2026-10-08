#!/usr/bin/env python3
"""Compose only the seven standing-gesture hooks on a current actor runtime.
Never replace a newer runtime with the frozen reference copy.
"""
import argparse, hashlib, json
from pathlib import Path

def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()

def once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Expected one exact hook anchor: '+before.strip())
    return text.replace(before, after, 1)

BEGIN='      this.gestureSupport.begin(this.clipSpec,clipSpec,this.mixer.time,clip,this.action?.getClip(),this.action?.time??0);\n'
APPLY='    this.gestureSupport.apply(this.mixer.time,this.action.time,this.action.timeScale);\n'
HOOKS=[
("import {NativeGaitTransitionSupport} from './gait-transition-support';\n", "import {NativeGestureBlendSupport} from './gesture-blend-support';\n"),
('  private gaitSupport:NativeGaitTransitionSupport;\n', '  private gestureSupport:NativeGestureBlendSupport;\n'),
("    this.gaitSupport=new NativeGaitTransitionSupport(this.model,this.root,asset.appearance.parts?.footwear?.replace('{lod}',String(asset.lod)));\n", "    this.gestureSupport=new NativeGestureBlendSupport(this.model,this.root,asset.appearance.parts?.footwear?.replace('{lod}',String(asset.lod)));\n"),
('      this.gaitSupport.begin(this.clipSpec,clipSpec,this.mixer.time,clip);\n',BEGIN),
('    this.gaitSupport.restore();\n','    this.gestureSupport.restore();\n'),
('    this.gaitSupport.apply(this.mixer.time,this.action.time,inputMotion?.speed??0);\n',APPLY),
('    this.gaitSupport.dispose();\n','    this.gestureSupport.dispose();\n')]

def compose(source):
    text=source
    mode='new-seven-hooks'
    if 'NativeGestureBlendSupport' in text:
        mode='upgrade-existing-gesture-hooks'
        for _,hook in HOOKS:
            if hook in [BEGIN,APPLY]:
                continue
            if text.count(hook)!=1:
                raise ValueError('Incomplete existing gesture hooks: '+hook.strip())
        old_begin=BEGIN if text.count(BEGIN)==1 else '      this.gestureSupport.begin(this.clipSpec,clipSpec,this.mixer.time);\n'
        old_apply=next((hook for hook in [APPLY,'    this.gestureSupport.apply(this.mixer.time,this.action.time);\n','    this.gestureSupport.apply(this.mixer.time);\n'] if text.count(hook)==1),None)
        if old_apply is None:
            raise ValueError('Expected one exact existing gesture apply hook')
        if old_begin==BEGIN and old_apply==APPLY:
            return text,{'mode':'already-installed','before':digest(source),'after':digest(text),'allOtherBytesPreserved':True}
        if old_begin!=BEGIN:
            text=once(text,old_begin,BEGIN)
        text=once(text,old_apply,APPLY)
        restored=once(text,APPLY,old_apply)
        if old_begin!=BEGIN:
            restored=once(restored,BEGIN,old_begin)
    else:
        for anchor,hook in HOOKS:
            before=hook+anchor if 'restore()' in hook or 'dispose()' in hook else anchor+hook
            text=once(text,anchor,before)
        restored=text
        for _,hook in HOOKS:
            restored=once(restored,hook,'')
    if restored != source:
        raise ValueError('Composition changed unrelated runtime bytes')
    return text,{'mode':mode,'before':digest(source),'after':digest(text),'allOtherBytesPreserved':True}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('runtime',type=Path)
    p.add_argument('--output',type=Path,required=True,help='Explicit destination. Use the current runtime path only after review.')
    a=p.parse_args()
    source=a.runtime.read_text()
    result,proof=compose(source)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(result)
    print(json.dumps(proof,indent=2))
