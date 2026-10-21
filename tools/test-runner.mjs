import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

if(process.argv.length>2)throw Error('Usage: npm test (the minimal suite always uses two workers).');
const inherited=(process.env.NODE_OPTIONS??'').replaceAll('_','-');
if(/(?:^|[\s"'])--test-(?:name-pattern|skip-pattern|only|shard)(?=$|[\s="'])/.test(inherited))
 throw Error('Remove test-selection flags from NODE_OPTIONS to run the complete minimum.');
if(process.env.NODE_TEST_CONTEXT!==undefined)
 throw Error('Run the minimal suite outside another Node test process.');
const root=fileURLToPath(new URL('../',import.meta.url));
const files=readdirSync(new URL('../tests/',import.meta.url))
 .filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`tests/${name}`);
if(!files.length)throw Error('No test files found.');
console.log(`Minimal suite: ${files.length} files, two workers.`);
const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
