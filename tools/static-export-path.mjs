// Resolve deployed URLs against their HTML/CSS/JS file, then map them to the
// flat static export. Catalog URLs remain portable and can still use /art/.
export function staticExportPath(reference,from='index.html',basePath='',{deployed=false}={}){
 if(!reference||/^(?:[a-z]+:|\/\/|#)/i.test(reference))return null;
 if(deployed&&basePath&&reference.startsWith('/')&&!reference.startsWith(`${basePath}/`)&&reference!==basePath){
  throw Error(`URL escapes deployment path: ${reference} (referenced by ${from})`);
 }
 const url=new URL(reference,`https://granaderos.invalid${basePath}/${from}`);
 let name=decodeURIComponent(url.pathname);
 if(deployed&&basePath&&name!==basePath&&!name.startsWith(`${basePath}/`)){
  throw Error(`URL escapes deployment path: ${reference} (referenced by ${from})`);
 }
 if(basePath&&(name===basePath||name.startsWith(`${basePath}/`)))name=name.slice(basePath.length);
 return name.replace(/^\//,'');
}
