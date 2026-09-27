import hashlib,json,subprocess,sys,pathlib,datetime
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
def git(*args):return subprocess.check_output(['git',*args],cwd=root).decode()
paths=sorted(set(git('ls-files','--cached','--others','--exclude-standard','game','web','tests','docs','tools','package.json','package-lock.json','.github').splitlines()))
records=[]
for name in paths:
 p=root/name
 if p.is_file():records.append([name,hashlib.sha256(p.read_bytes()).hexdigest(),p.stat().st_size])
status=git('status','--porcelain=v1')
value={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'branch':git('branch','--show-current').strip(),'head':git('rev-parse','HEAD').strip(),'dirtyPathCount':len(status.splitlines()),'statusSha256':hashlib.sha256(status.encode()).hexdigest(),'sourceFileCount':len(records),'sourceSha256':hashlib.sha256(json.dumps(records,separators=(',',':')).encode()).hexdigest(),'files':records}
out.write_text(json.dumps(value,indent=2)+'\n');print(json.dumps({k:v for k,v in value.items() if k!='files'}))
