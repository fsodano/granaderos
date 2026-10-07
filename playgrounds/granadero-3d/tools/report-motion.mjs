import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('public/assets/asset-manifest.json',root),'utf8'));
const bytes=await readFile(new URL('public/assets/granadero.glb',root));
const sha=createHash('sha256').update(bytes).digest('hex');
if(sha!==manifest.sha256)throw new Error('Manifest and GLB do not match');
const report={
 schemaVersion:1,unit:'granadero',scope:'standalone playground; not the production character library',
 assetSha256:sha,visualApproval:'Accepted as reusable visual reference 2026-10-06; current direction sufficient for propagation, not final polish',
 referenceAcceptance:{date:'2026-10-06',assetSha256:'4921a38bf3b6afeea30eed115743141621454e55fa078ba7d366021c17e2d795',scope:'whole Granadero reference accepted for reuse; each receiving anatomy and garment still needs fit and export review'},
 approvalByAction:Object.fromEntries(manifest.clips.map(clip=>[clip.name,'included in accepted Granadero reference 2026-10-06'])),
 appearanceDirection:'small natural human with digitized-actor character; smooth isometric rendering, coarse pixel filter optional',
 playbackSpeed:1,basePlaybackRate:1.25,sourceFPS:30,
 actions:manifest.clips.map(clip=>({name:clip.name,durationSeconds:clip.durationSeconds,playbackDurationAt1xSeconds:clip.durationSeconds/1.25,loop:clip.loop,events:clip.events,channels:clip.channels,source:clip.source??'authored skeletal animation',...(manifest.locomotionSpeed[clip.name]?{strideMetresPerSecond:manifest.locomotionSpeed[clip.name]}:{})})),
 implemented:['unarmed idle/walk/run','armed walk/run for rifle, pistol, sabre and knife','gait-derived wrist/elbow carry with delayed wrist rotation','rifle aim and isolated shot','one-hand pistol aim and isolated shot','layered wrist/chest/knee recoil and arm settlement','sabre guard, three cuts, linked combination, thrust and hilt strike','knife guard, two cuts and thrust','bayonet thrust','rifle butt strike','pistol strike','punch','weapon-specific thrust and blunt-strike body transfer','free-arm counterbalance','breathing','rear-foot pivot during cuts','short advancing cuts with recovery'],
 missing:['reloads','start/stop steps','defenses','hit reactions','paired opponent/contact','two-hand pistol variant'],
 reuseStatus:'accepted reference transferred to production; 34 semantic clips use 29 distinct motions in native male/female banks; two-cut combination remains preview-only',
 productionReview:'../../assets/source/characters-3d/REVIEW.md',
 reviewDocument:'MOTION_REVIEW.md'
};
await writeFile(new URL('motion-inventory.json',root),JSON.stringify(report,null,2)+'\n');
console.log(`Recorded ${report.actions.length} actions for ${sha.slice(0,12)}`);
