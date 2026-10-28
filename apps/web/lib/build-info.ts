type BuildInfo={version:string;id:string;source:string;revision:string|null};
declare const __GRANADEROS_BUILD__:BuildInfo;
export const BUILD_INFO:BuildInfo=typeof __GRANADEROS_BUILD__==='undefined'?{version:'development',id:'unbuilt',source:'',revision:null}:__GRANADEROS_BUILD__;
