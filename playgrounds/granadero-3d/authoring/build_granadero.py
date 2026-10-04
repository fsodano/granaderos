"""Compatibility entry point for the native human build.

Use build_human.py without --publish to review a candidate first.
This original command continues to update the local playground asset.
"""
from pathlib import Path
import runpy
import sys
if '--publish' not in sys.argv:
    sys.argv.append('--publish')
runpy.run_path(str(Path(__file__).with_name('build_human.py')), run_name='__main__')
