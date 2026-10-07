import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const base=process.argv.includes('--dist')?resolve(root,'dist'):root;
const production=process.argv.includes('--dist');
const libraryRoot=resolve(root,'../../web/public/models/characters');
const port=Number(process.env.GRANADERO_PLAYGROUND_PORT??3147);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const publicPath=pathname.startsWith('/assets/')&&!process.argv.includes('--dist')?`public${pathname}`:pathname.replace(/^\//,'');
  const relative=!production&&pathname.startsWith('/vendor/three/')?`node_modules/three/${pathname.slice('/vendor/three/'.length)}`:publicPath;
  const fromLibrary=!production&&pathname.startsWith('/models/characters/');
  const allowedRoot=fromLibrary?libraryRoot:base;
  const file=resolve(allowedRoot,fromLibrary?pathname.slice('/models/characters/'.length):relative||'index.html');
  if(file!==allowedRoot&&!file.startsWith(allowedRoot+sep)){res.writeHead(403).end();return;}
  if(!(await stat(file)).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});
  res.end(await readFile(file));
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Granadero 3D: http://localhost:${server.address().port}`));
