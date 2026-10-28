"""Resolve published recipe identities through the checked repository relocation."""
from pathlib import Path
import hashlib
import json

TABLE_PATH = Path(__file__).with_name('source-relocation-v1.json')


def relocation_records():
    document = json.loads(TABLE_PATH.read_bytes())
    assert document['format'] == 'granaderos-source-relocation' and document['version'] == 1
    return document['sources']


def normalized_source_reference(reference):
    return str(reference).replace('\\', '/')


def source_path(root, reference):
    reference = normalized_source_reference(reference)
    record = relocation_records().get(reference)
    if record is None:
        record = next((row for row in relocation_records().values() if row['path'] == reference), None)
    return Path(root) / (record['path'] if record else reference)


def published_source_reference(reference):
    reference = normalized_source_reference(reference)
    return next((name for name, row in relocation_records().items() if row['path'] == reference), reference)


def published_source_sha256(root, reference):
    published_reference = published_source_reference(reference)
    record = relocation_records().get(published_reference)
    path = source_path(root, reference)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if record is None:
        return digest
    assert digest == record['relocatedSha256'], 'Unrecorded source change after relocation: ' + str(path)
    return record['publishedSha256']


def published_source_digests(root, references):
    return {published_source_reference(reference): published_source_sha256(root, reference)
            for reference in references}
