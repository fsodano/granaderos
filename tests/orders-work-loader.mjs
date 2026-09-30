// Test-only counters at real read-model entry points. No production hooks or mocks.
import ts from '../web/node_modules/typescript/lib/typescript.js';
const names=new Set(['orderDescriptors','equipmentSlots','handSlots','equippedItemHelp','heardNoiseModel','medicalUsePreview','itemUsePreview','supplyUsePreview','artilleryReloadPreview']);
export async function load(url,context,next){
 const result=await next(url,context);
 if(!/\/game\/(ja2-hud|tactical)\.js$/.test(url))return result;
 let source=String(result.source);
 const file=ts.createSourceFile(url,source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.JS);
 const functions=file.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.has(node.name?.text)&&node.body);
 for(const node of functions.reverse()){
  const at=node.body.getStart(file)+1,name=JSON.stringify(node.name.text);
  source=source.slice(0,at)+`if(globalThis.__ordersWork)globalThis.__ordersWork[${name}]=(globalThis.__ordersWork[${name}]??0)+1;`+source.slice(at);
 }
 return {...result,source};
}
