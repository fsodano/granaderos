// A server transform must never put its file URL into a browser worker base.
// Validate the emitted JavaScript, not only the source import or asset manifest.
export function verifyBrowserWorkers(javascript,name,requireAsset){
 if(/new\s+Worker\s*\(\s*new\s+URL\s*\([^)]*file:\/\//.test(javascript))throw Error(`Worker uses a local file URL in browser export: ${name}`);
 for(const match of javascript.matchAll(/["'`]((?:\/[^"'`$?#]+)?\/_next\/static\/[^"'`$?#]*worker[^"'`$?#]*\.js)["'`]/g))requireAsset(match[1]);
}
