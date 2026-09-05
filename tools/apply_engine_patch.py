#!/usr/bin/env python3
"""Apply reviewed Granaderos changes to the pinned upstream; safely repeatable."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def apply(engine=ROOT / "engine"):
    engine = Path(engine)
    patch = ROOT / "patches/0001-black-powder.patch"
    def git(*args):
        return subprocess.run(["git", "-C", str(engine), "apply", *args, str(patch)], capture_output=True, text=True)
    check = git("--check")
    if check.returncode == 0:
        result = git()
        if result.returncode:
            raise RuntimeError(result.stderr)
    elif git("--reverse", "--check").returncode != 0:
        raise RuntimeError("Engine differs from the expected patch base; refusing partial or destructive edits.\n" + check.stderr)
    shutil.copyfile(ROOT / "native/Granaderos/BlackPowder.h", engine / "Tactical/GranaderosBlackPowder.h")
    print("Granaderos engine integration applied (or already present).")

if __name__ == "__main__":
    apply(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "engine")
