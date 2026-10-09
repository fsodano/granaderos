"""Check exact review-source bytes without executing archived code."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'manifest.json').read_text())
blobs={row['gitBlob']:row for row in manifest['blobs']}
assert len(blobs)==manifest['blobCount']
for row in blobs.values():
 path=(HERE/row['archivePath']).resolve()
 if not path.is_relative_to(HERE):raise ValueError('Archive path leaves the review directory')
 data=path.read_bytes()
 assert len(data)==row['bytes'],row['archivePath']+' size'
 assert hashlib.sha256(data).hexdigest()==row['sha256'],row['archivePath']+' SHA-256'
 assert hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==row['gitBlob'],row['archivePath']+' Git identity'
 assert row['runtimeEnabled'] is False
external=json.loads((HERE/'external-files.json').read_text()) if (HERE/'external-files.json').exists() else {'files':[]}
for row in json.loads((HERE/'private-files.json').read_text())['files']+external['files']:
 if 'archivePath' in row:
  stored=blobs[row['gitBlob']]
  assert stored['archivePath']==row['archivePath'] and stored['sha256']==row['sha256']
 else:assert row['storage'] in ('main-history','existing-integration-history')
print(json.dumps({'verifiedBlobs':len(blobs),'logicalBytes':sum(r['bytes']for r in blobs.values()),'externalPaths':len(external['files']),'runtimeAssetsChanged':False}))
