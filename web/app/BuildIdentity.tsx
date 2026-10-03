import {sitePath} from '../lib/site-path.js';
import {BUILD_INFO} from '../lib/build-info';
export default function BuildIdentity(){
 return <small data-build-id={BUILD_INFO.id}><a href={sitePath('/build-info.json')} target="_blank" rel="noreferrer" title="Identifica la misma versión del juego y de sus editores">Versión {BUILD_INFO.version} · {BUILD_INFO.id}</a></small>;
}
