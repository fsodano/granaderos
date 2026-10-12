import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import campaignTests,{reviewedCoreCampaignFixtures} from './test-campaign-config.mjs';

export function partitionTestScopes(all,configuration=campaignTests){
 assert.ok(Array.isArray(all)&&all.length,'No test files were found.');assert.equal(new Set(all).size,all.length,'A test file is repeated.');assert.ok(Array.isArray(configuration),'The campaign scope list must be an array.');
 const discovered=new Set(all),campaign=new Map();
 for(const entry of configuration){assert.ok(entry&&typeof entry.file==='string'&&typeof entry.reason==='string'&&entry.reason.trim(),'Each campaign test needs a file and a scope reason.');assert.ok(discovered.has(entry.file),`A campaign test target is missing: ${entry.file}. Update the reviewed scope manifest.`);assert.ok(!campaign.has(entry.file),`A campaign test target is repeated: ${entry.file}`);campaign.set(entry.file,entry.reason);}
 const scopes={core:all.filter(file=>!campaign.has(file)),campaign:all.filter(file=>campaign.has(file))},union=[...scopes.core,...scopes.campaign];assert.equal(new Set(union).size,all.length,'Core and campaign test files overlap.');assert.deepEqual([...union].sort(),[...all].sort(),'Core and campaign must cover every discovered file exactly once.');return {scopes,reasons:campaign};
}

// This guard requests review of new earned inputs and full route dependencies.
// It is not a filename classifier. Portable engine and editor tests stay core.
export function assertReviewedTestScopes(root,all,configuration=campaignTests,coreReviews=reviewedCoreCampaignFixtures){
 const {scopes}=partitionTestScopes(all,configuration),campaign=new Set(scopes.campaign),reviewed=new Map();
 assert.ok(Array.isArray(coreReviews),'The reviewed core fixture list must be an array.');
 for(const entry of coreReviews){assert.ok(entry&&typeof entry.file==='string'&&typeof entry.reason==='string'&&entry.reason.trim(),'Each reviewed core fixture needs a file and a reason.');assert.ok(all.includes(entry.file),`A reviewed core target is missing: ${entry.file}`);assert.ok(!campaign.has(entry.file),`A reviewed core target belongs to campaign: ${entry.file}`);assert.ok(!reviewed.has(entry.file),`A reviewed core target is repeated: ${entry.file}`);reviewed.set(entry.file,entry.reason);}
 const nativeInput=/['"`]\.{1,2}\/[^'"`\r\n]*\.gz['"`]|(?:from\s*|import\s*)['"]\.\/(?:fresh-(?:campaign|coastal|northern|cuyo|mountain)|stock-(?:port-opening|tucuman|cuyo)|created-(?:ending|cuyo|coastal)|salta-route|northern-support-fixture|funded-route-fixture)[^'"]*['"]/;
 for(const file of scopes.core){const source=readFileSync(resolve(root,file),'utf8');assert.ok(!nativeInput.test(source)||reviewed.has(file),`Review the campaign scope of ${file}: it consumes an earned input or a campaign route. Declare campaign membership or a justified core fixture review.`);}
 return scopes;
}
