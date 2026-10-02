import test from 'node:test';
import assert from 'node:assert/strict';
import {staticExportPath} from '../tools/static-export-path.mjs';

test('deployed absolute and relative URLs resolve to the same exported file',()=>{
 assert.equal(staticExportPath('/granaderos/_next/static/page.js','editor/index.html','/granaderos',{deployed:true}),'_next/static/page.js');
 assert.equal(staticExportPath('../art/portrait-0.webp','editor/index.html','/granaderos',{deployed:true}),'art/portrait-0.webp');
 assert.equal(staticExportPath('/granaderos/story/?campaign=test#chapter','index.html','/granaderos',{deployed:true}),'story/');
 assert.equal(staticExportPath('/art/portrait-0.webp','portable catalog','/granaderos'),'art/portrait-0.webp');
 assert.equal(staticExportPath('/art/portrait-0.webp','index.html','',{deployed:true}),'art/portrait-0.webp');
});

test('published root-relative URLs cannot escape the repository path',()=>{
 for(const path of ['/art/main-menu.webp','/_next/static/page.js','/editor/','/granaderos-other/art/a.png']){
  assert.throws(()=>staticExportPath(path,'index.html','/granaderos',{deployed:true}),/escapes deployment path/);
 }
 assert.throws(()=>staticExportPath('../../art/a.png','editor/index.html','/granaderos',{deployed:true}),/escapes deployment path/);
 for(const path of ['https://example.com/image.png','data:image/png;base64,a','blob:https://example.com/id','//cdn.example.com/a','#menu']){
  assert.equal(staticExportPath(path,'index.html','/granaderos',{deployed:true}),null);
 }
});
