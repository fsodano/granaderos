#!/usr/bin/env python3
"""Serialize publication to one character library across cooperating tools.

Use ``with publication_lock(directory):`` around the fresh manifest read and
all publication writes. Trusted child tools inherit the held-lock token.
The lock file remains in the OS temporary directory, outside asset folders.
"""
import argparse
from contextlib import contextmanager
import errno
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

TOKEN = 'GRANADEROS_LIBRARY_LOCK'
MAX_TIMEOUT = 30.0


def canonical_directory(directory):
    return os.path.normcase(str(Path(directory).expanduser().resolve()))


@contextmanager
def publication_lock(directory, timeout=MAX_TIMEOUT):
    """Yield the canonical Path while holding an advisory publication lock.

    ``timeout`` is in seconds, from zero through thirty. TimeoutError means
    no lock was acquired. A matching token from a trusted parent reuses its
    lock; the parent must remain alive and hold it until the child exits.
    """
    if not 0 <= timeout <= MAX_TIMEOUT:
        raise ValueError('Publication lock timeout must be between 0 and 30 seconds.')
    canonical = canonical_directory(directory)
    previous = os.environ.get(TOKEN)
    if previous == canonical:
        yield Path(canonical)
        return

    folder = Path(tempfile.gettempdir()) / 'granaderos-library-publication'
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    key = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    # Do not unlink this file on release. Waiting processes must keep locking
    # the same inode, including when another writer opens it during release.
    descriptor = os.open(folder / (key + '.lock'), os.O_RDWR | os.O_CREAT, 0o600)
    with os.fdopen(descriptor, 'r+b', buffering=0) as stream:
        if os.name == 'nt':
            import msvcrt

            def acquire():
                # Windows byte-range locks may extend past EOF. Avoid writing
                # an initialization byte before another process releases it.
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)

            def release():
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            def acquire():
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

            def release():
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)

        deadline = time.monotonic() + timeout
        while True:
            try:
                acquire()
                break
            except OSError as error:
                if error.errno not in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
                    raise
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f'Publication lock timed out for {canonical}') from error
                time.sleep(min(.05, remaining))
        os.environ[TOKEN] = canonical
        try:
            yield Path(canonical)
        finally:
            if previous is None:
                os.environ.pop(TOKEN, None)
            else:
                os.environ[TOKEN] = previous
            release()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True, type=Path)
    parser.add_argument('--timeout', type=float, default=MAX_TIMEOUT)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('A child command is required after --.')
    try:
        with publication_lock(args.directory, args.timeout):
            result = subprocess.run(command)
        return result.returncode if result.returncode >= 0 else 128 - result.returncode
    except TimeoutError as error:
        print(error, file=sys.stderr)
        return 75


if __name__ == '__main__':
    sys.exit(main())
