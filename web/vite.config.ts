import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, type Plugin } from 'vite';
import {fileURLToPath} from 'node:url';
import {buildIdentity} from '../tools/build-identity.mjs';
export default defineConfig(async()=>{
 const identity=await buildIdentity(fileURLToPath(new URL('..',import.meta.url)));
 const identityPlugin:Plugin={
  name:'granaderos-build-identity',
  configureServer(server){server.middlewares.use('/build-info.json',(_request,response)=>{response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.end(JSON.stringify(identity));});},
  generateBundle(){this.emitFile({type:'asset',fileName:'build-info.json',source:JSON.stringify(identity,null,2)+'\n'});},
 };
 return {define:{__GRANADEROS_BUILD__:JSON.stringify(identity)},css:{postcss:{plugins:[tailwindcss()]}},server:{host:'0.0.0.0',fs:{allow:['..']}},plugins:[vinext(),identityPlugin]};
});
