#!/usr/bin/env python3
"""Install a built blackx bundle without replacing personal settings or shortcuts."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
from build import ROOT, build

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--home', type=Path, default=Path(os.environ.get('HERDR_APP_HOME', str(Path.home() / '.config/herdr-app'))))
parser.add_argument('--update', action='store_true', help='Explicitly allow replacement of existing bundle files; backs them up first')
parser.add_argument('--sync-style-settings', action='store_true', help='Merge generated color/font values into personal settings; preserve every other key')
args = parser.parse_args()
build(ROOT / 'release/blackx', check=True)
bundle = ROOT / 'release/blackx'
files = [p for directory in ('mods', 'layouts', 'themes') for p in (bundle / directory).rglob('*') if p.is_file()]
collisions = [p for p in files if (args.home / p.relative_to(bundle)).exists()]
if collisions and not args.update:
    parser.error('Names already exist: ' + ', '.join(str(p.relative_to(bundle)) for p in collisions) + '. Review them before using --update.')
# Check collisions before installing system packages or writing bundle files.
subprocess.run(['sh', str(bundle / 'install-dependencies.sh')], check=True)
settings_path = args.home / 'settings.json'
settings_update = None
if args.sync_style_settings:
    original = json.loads(settings_path.read_text()) if settings_path.exists() else {}
    from build import read_json, resolve
    preset = resolve(read_json(ROOT / 'src/optional-settings.json'), read_json(ROOT / 'src/styles.json'))
    original['colors'] = {**original.get('colors', {}), **preset['colors']}
    for key in ('font', 'ui_font', 'font_size', 'zoom', 'font_ligatures', 'minimum_contrast'):
        original[key] = preset[key]
    settings_update = (json.dumps(original, indent=2) + '\n').encode()
backup = args.home / 'backups' / ('blackx-install-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
# Back up all replaced files before writing any. Files are individually atomically replaced.
for p in collisions:
    relative = p.relative_to(bundle)
    saved = backup / relative
    saved.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.home / relative, saved)
if settings_update is not None and settings_path.exists():
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(settings_path, backup / 'settings.json')
for p in files:
    target = args.home / p.relative_to(bundle)
    if target.exists() and target.read_bytes() == p.read_bytes():
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.', suffix='.tmp', delete=False) as f:
        f.write(p.read_bytes())
        temporary = f.name
    os.replace(temporary, target)
if settings_update is not None:
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=settings_path.parent, prefix='.', suffix='.tmp', delete=False) as f:
        f.write(settings_update)
        temporary = f.name
    os.replace(temporary, settings_path)
print(f'Installed {len(files)} bundle files into {args.home}')
if collisions or settings_update is not None:
    print(f'Rollback copies: {backup}')
print('Shortcuts and runtime state were not written. ' + ('Only style settings were merged. ' if settings_update is not None else 'Personal settings were not written. ') + 'Select the blackx layout and blackx or blackx-mono palette in Herdr when needed.')
