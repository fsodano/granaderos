"""Recover selected private source/art without replacing live repository files."""
import argparse,hashlib,json,subprocess
from pathlib import Path,PurePosixPath
HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
group=parser.add_mutually_exclusive_group(required=True)
group.add_argument('--prefix')
group.add_argument('--external-prefix')
parser.add_argument('--destination',required=True,type=Path)
args=parser.parse_args()
repo=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],cwd=HERE,text=True).strip()).resolve()
destination=args.destination.resolve()
if destination.is_relative_to(repo) or repo.is_relative_to(destination):raise ValueError('Recovery destination must be outside the source checkout')
external=args.external_prefix is not None
prefix=PurePosixPath(str(Path(args.external_prefix).resolve())) if external else PurePosixPath(args.prefix)
if '..' in prefix.parts or (not external and prefix.is_absolute()):raise ValueError('Expected a relative private path or an absolute external prefix')
records=json.loads((HERE/('external-files.json' if external else 'private-files.json')).read_text())['files']
def original_path(row):return PurePosixPath(str(Path(row['path']).resolve())) if external else PurePosixPath(row['path'])
rows=[r for r in records if original_path(r).is_relative_to(prefix)]
if not rows:raise ValueError('No archived private paths match the prefix')
for row in rows:
 original=original_path(row)
 if '..' in original.parts or (not external and original.is_absolute()):raise ValueError('Invalid archived original path')
 data=(HERE/row['archivePath']).read_bytes() if 'archivePath' in row else subprocess.check_output(['git','cat-file','blob',row['gitBlob']],cwd=repo)
 assert hashlib.sha256(data).hexdigest()==row['sha256']
 target=destination.joinpath(*original.relative_to(prefix).parts)
 if not target.resolve().is_relative_to(destination):raise ValueError('Recovery path leaves the destination')
 if target.exists() and target.read_bytes()!=data:raise ValueError('Recovery would replace different existing bytes: '+str(target))
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 if 'originalModeOctal' in row:target.chmod(int(row['originalModeOctal'],8))
print(json.dumps({'restoredPaths':len(rows),'destination':str(destination),'archivedCodeExecuted':False}))
