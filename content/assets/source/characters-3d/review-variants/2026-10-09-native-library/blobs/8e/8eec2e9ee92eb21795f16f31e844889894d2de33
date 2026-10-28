import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../assets/source/characters-3d/authoring/',import.meta.url));
function fixture(path,times,values){
 const data=Buffer.alloc((times.length+values.length*3)*4);times.forEach((n,i)=>data.writeFloatLE(n,i*4));values.flatMap(v=>[v,0,0]).forEach((n,i)=>data.writeFloatLE(n,(times.length+i)*4));
 const document={asset:{version:'2.0'},buffers:[{byteLength:data.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:times.length*4},{buffer:0,byteOffset:times.length*4,byteLength:values.length*12}],accessors:[{bufferView:0,componentType:5126,type:'SCALAR',count:times.length,min:[times[0]],max:[times.at(-1)]},{bufferView:1,componentType:5126,type:'VEC3',count:values.length}],animations:[{name:'terminal',samplers:[{input:0,output:1,interpolation:'LINEAR'}],channels:[]}]};
 let json=Buffer.from(JSON.stringify(document));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+data.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(data.length,0);binHeader.writeUInt32LE(0x004e4942,4);writeFileSync(path,Buffer.concat([header,json,binHeader,data]));
}
function read(path){const raw=readFileSync(path),length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length)),binary=raw.subarray(28+length),sampler=doc.animations[0].samplers[0];return Object.fromEntries(['input','output'].map(key=>{const a=doc.accessors[sampler[key]],v=doc.bufferViews[a.bufferView],width=a.type==='VEC3'?3:1;return [key,Array.from({length:a.count},(_,i)=>binary.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*width*4))];}));}
function run(path,duration){execFileSync('python3',['-c',"import sys;sys.path.insert(0,sys.argv[1]);from export_timing import trim_endpoints;trim_endpoints(sys.argv[2],{'terminal':float(sys.argv[3])})",source,path,String(duration)],{stdio:'pipe'});}
for(const [label,duration,expectedTimes]of [['fractional',1.016667,[0,.5,1,1.016667]],['near integer',1.0000003,[0,.5,1.0000003]]]){
 test(`animation export preserves the authored ${label} terminal pose without moving prior samples`,()=>{
  const directory=mkdtempSync(join(tmpdir(),'granadero-timing-')),path=join(directory,'probe.glb');
  try{fixture(path,[0,.5,1,1.033333333],[0,7,12,99]);run(path,duration);const actual=read(path);
   assert.equal(actual.input.length,expectedTimes.length);actual.input.forEach((n,i)=>assert.ok(Math.abs(n-expectedTimes[i])<1e-7));
   assert.deepEqual(actual.output,expectedTimes.length===4?[0,7,12,99]:[0,7,99]);
   for(let i=1;i<actual.input.length;i++)assert.ok(actual.input[i]>actual.input[i-1]);
   assert.equal(actual.output.at(-1),99,'Non-loop terminal pose is not replaced by the first pose');
  }finally{rmSync(directory,{recursive:true,force:true});}
 });
}
test('animation export rejects a missing source endpoint instead of stretching time',()=>{
 const directory=mkdtempSync(join(tmpdir(),'granadero-timing-')),path=join(directory,'probe.glb');
 try{fixture(path,[0,.5,.966667],[0,7,12]);assert.throws(()=>run(path,1),/Missing padded terminal pose/);}finally{rmSync(directory,{recursive:true,force:true});}
});
test('rig-only export defers planted skin calibration without changing carried crawl speeds',()=>{
 const result=execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,sys.argv[1]);from export_timing import calibrate_crawl;clips=[{'name':'prone.crawl.unarmed','nativeStrideSpeed':.2,'strideMeasurement':{'method':'native forearm planted pull displacement'}},{'name':'prone.crawl.long-gun','nativeStrideSpeed':.3}];before=json.dumps(clips);speed=calibrate_crawl('no-body-skin-in-this-worker.glb',clips);assert json.dumps(clips)==before;print(speed)",source],{encoding:'utf8'});
 assert.equal(Number(result.trim()),.2);
});
