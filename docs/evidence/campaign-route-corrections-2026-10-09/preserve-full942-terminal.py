from pathlib import Path, PurePosixPath
import datetime, gzip, hashlib, io, json, tarfile

run_dir=Path('/tmp/granaderos-campaign-final-posture-full-2026-10-10T040806965Z')
receipt_path=run_dir/'final-receipt.json'
if not receipt_path.is_file():
    raise SystemExit('Full942 is still pending; no archive created.')
receipt=json.loads(receipt_path.read_text())
if receipt.get('complete') is not True or receipt.get('sourceDrift') != [] or receipt.get('selectedFiles') != 942:
    raise SystemExit('Terminal coverage or source freeze does not match the declared full942 gate.')
if receipt.get('exitCode') not in (0,1):
    raise SystemExit('Unexpected full942 terminal code; inspect before preserving.')
metadata=json.loads((run_dir/'metadata.json').read_text())
if metadata.get('filters') != [] or metadata.get('exclusions') != [] or metadata.get('command') != ['tools/test-runner.mjs','--concurrency','8']:
    raise SystemExit('Full942 selection or command mismatch.')

payloads={}
for filename in ['metadata.json','pid.json','before-source-hashes.json','after-source-hashes.json','full-report.json','final-receipt.json','run.log']:
    payload_path=run_dir/filename
    if payload_path.is_symlink() or not payload_path.is_file():
        raise SystemExit(f'Missing or non-regular required terminal payload: {filename}')
    payloads[filename]=payload_path.read_bytes()

failure_dir=run_dir/'native-failures'
actual_capture_dirs=sorted(p.name for p in failure_dir.iterdir()) if failure_dir.exists() else []
if actual_capture_dirs != sorted(receipt.get('nativeFailureDirectories',[])):
    raise SystemExit('Native capture directory set differs from terminal receipt.')
for capture_name in actual_capture_dirs:
    capture_dir=failure_dir/capture_name
    if capture_dir.is_symlink() or not capture_dir.is_dir():
        raise SystemExit('Unsafe native capture directory.')
    native_receipt=json.loads((capture_dir/'receipt.json').read_text())
    declared=[row['path'] for row in native_receipt['artifacts']]+['receipt.json']
    if sorted(p.name for p in capture_dir.iterdir()) != sorted(declared):
        raise SystemExit(f'Unexpected native payload set: {capture_name}')
    for row in native_receipt['artifacts']:
        artifact_name=PurePosixPath(row['path'])
        if len(artifact_name.parts)!=1 or artifact_name.name in ('.','..'):
            raise SystemExit('Unsafe native artifact path.')
        artifact_path=capture_dir/row['path']
        if artifact_path.is_symlink() or not artifact_path.is_file():
            raise SystemExit('Native artifact is not regular.')
        data=artifact_path.read_bytes()
        if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
            raise SystemExit(f'Native payload hash mismatch: {capture_name}/{row["path"]}')
    for name in declared:
        payload_path=capture_dir/name
        if payload_path.is_symlink() or not payload_path.is_file():
            raise SystemExit('Native declared payload is not regular.')
        payloads[f'native-failures/{capture_name}/{name}']=payload_path.read_bytes()

out_dir=Path('/tmp/granaderos-full942-terminal-preserved-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
out_dir.mkdir()
allowlist={'scope':'Exact frozen terminal full942 payloads and native failure captures. Includes real failures, not success acceptance. No native execution or repository edits.','runDirectory':str(run_dir),'payloads':[{'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in sorted(payloads.items())]}
allowlist_data=(json.dumps(allowlist,indent=2)+'\n').encode()
(out_dir/'archive-allowlist.json').write_bytes(allowlist_data)
archive_path=out_dir/'full942-terminal-native-evidence.tar.gz'
with archive_path.open('wb') as archive_file, gzip.GzipFile(filename='',fileobj=archive_file,mode='wb',mtime=0) as gzip_file, tarfile.open(fileobj=gzip_file,mode='w|') as archive:
    for name,data in sorted({**payloads,'archive-allowlist.json':allowlist_data}.items()):
        member=tarfile.TarInfo(name);member.size=len(data);member.mode=0o644;member.mtime=0
        archive.addfile(member,io.BytesIO(data))
with tarfile.open(archive_path,'r:gz') as archive:
    members=archive.getmembers()
    if sorted(m.name for m in members)!=sorted([*payloads,'archive-allowlist.json']) or not all(m.isfile() for m in members):
        raise SystemExit('Archive membership check failed.')
    for name,data in {**payloads,'archive-allowlist.json':allowlist_data}.items():
        if archive.extractfile(name).read()!=data:
            raise SystemExit('Archive exact-byte check failed.')
closure={'run':str(run_dir),'exitCode':receipt['exitCode'],'complete':True,'selectedFiles':942,'sourceDrift':[],'nativeCaptureDirectories':len(actual_capture_dirs),'payloadFiles':len(payloads),'archive':str(archive_path),'archiveBytes':archive_path.stat().st_size,'archiveSha256':hashlib.sha256(archive_path.read_bytes()).hexdigest(),'allowlistSha256':hashlib.sha256(allowlist_data).hexdigest(),'allRegularMembers':True,'allExactPayloadBytes':True,'repositoryEdits':0,'nativeOrdersExecuted':0}
(out_dir/'preservation-receipt.json').write_text(json.dumps(closure,indent=2)+'\n')
print(json.dumps(closure))
