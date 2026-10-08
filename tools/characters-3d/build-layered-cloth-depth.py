#!/usr/bin/env python3
"""Run a frozen cloth installer beneath the verified final apparel layer."""
from pathlib import Path
import argparse
import subprocess
import sys
from apparel_surface_context import apparel_surface_context


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--layer', choices=('pilot', 'family'), required=True)
    parser.add_argument('--presets', nargs='+')
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    tool = 'build-cloth-depth.py' if args.layer == 'pilot' else 'build-family-cloth-depth.py'
    if apparel_surface_context(tool, root, args.receipt, selected_presets=args.presets):
        return
    command = [sys.executable, str(root / 'tools/characters-3d' / tool), '--root', str(root)]
    if args.presets:
        command.extend(['--presets', *args.presets])
    if args.receipt:
        command.extend(['--receipt', str(args.receipt)])
    subprocess.run(command, cwd=root, check=True)


if __name__ == '__main__':
    main()
