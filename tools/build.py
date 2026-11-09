#!/usr/bin/env python3
"""Build portable Herdr files from one style source (Python standard library only)."""
import argparse
import json
import plistlib
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MODS = ('blackx-help', 'blackx-feedback', 'blackx-welcome', 'blackx-whatsnew', 'blackx-agents', 'blackx-changes', 'blackx-chrome', 'blackx-confirm', 'blackx-files', 'blackx-machine-add', 'blackx-menu', 'blackx-new-menu', 'blackx-palette', 'blackx-pane', 'blackx-picker', 'blackx-prompt', 'blackx-settings', 'blackx-spaces', 'blackx-status', 'blackx-tabs', 'blackx-worktree')

def read_json(path):
    return json.loads(path.read_text())

def resolve(value, tokens, chain=()):
    if isinstance(value, dict):
        if set(value) == {'$ref'}:
            key = value['$ref']
            if key in chain:
                raise ValueError('Cyclic token reference: ' + ' -> '.join((*chain, key)))
            target = tokens
            for part in key.split('.'):
                target = target[part]
            return resolve(target, tokens, (*chain, key))
        return {k: resolve(v, tokens, chain) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve(v, tokens, chain) for v in value]
    return value

def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()

def outputs(root=ROOT):
    src = root / 'src'
    tokens = resolve(read_json(src / 'styles.json'), read_json(src / 'styles.json'))
    files = {'install-dependencies.sh': (src / 'install-dependencies.sh').read_bytes()}
    for name in MODS:
        for path in sorted((src / 'mods' / name).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                if path.suffix == '.js':
                    for reference in re.findall(r'\bstyles\.([A-Za-z0-9_.]+)', path.read_text()):
                        value = tokens
                        for part in reference.split('.'):
                            value = value[part]
                files[path.relative_to(src).as_posix()] = path.read_bytes()
        files[f'mods/{name}/icons.js'] = (src / 'shared/icons.js').read_text().replace('__MOD_NAME__', name).encode()
        for asset in sorted((src / 'shared/lucide').iterdir()):
            files[f'mods/{name}/icons/{asset.name}'] = asset.read_bytes()
        for asset in sorted((src / 'shared/brands').iterdir()):
            files[f'mods/{name}/icons/{asset.name}'] = asset.read_bytes()
        files[f'mods/{name}/menu-item.js'] = (src / 'shared/menu-item.js').read_bytes()
        files[f'mods/{name}/routing.js'] = (src / 'shared/routing.js').read_bytes()
        files[f'mods/{name}/style.js'] = (src / 'shared/style.js').read_text().replace('__STYLE_TOKENS__', json.dumps(tokens, indent=2)).encode()
    for source, target in [('layout.json', 'layouts/blackx.json'), ('theme.json', 'themes/blackx.json'), ('theme-mono.json', 'themes/blackx-mono.json')]:
        files[target] = json_bytes(resolve(read_json(src / source), tokens))
    for source, target in [('src/README.md', 'README.md'), ('src/RECIPE.md', 'RECIPE.md'), ('docs/screenshots/preview.png', 'preview.png'), ('docs/screenshots/configs.png', 'screenshots/configs.png'), ('docs/screenshots/machine.png', 'screenshots/machine.png'), ('docs/screenshots/files.png', 'screenshots/files.png'), ('docs/screenshots/files.csv.png', 'screenshots/files.csv.png'), ('docs/screenshots/files.image.png', 'screenshots/files.image.png'), ('docs/screenshots/files.pdf.png', 'screenshots/files.pdf.png')]:
        if (root / source).exists():
            files[target] = (root / source).read_bytes()
            if target in ('README.md', 'RECIPE.md'):
                files[target] = files[target].replace(b'](../docs/screenshots/preview.png)', b'](preview.png)').replace(b'](../docs/screenshots/', b'](screenshots/')
    for theme_name, ansi in [('blackx', tokens['terminal']['ansi']), ('blackx-mono', tokens['monochrome']['ansi'])]:
        rules = [{'settings': {'background': tokens['colors']['background'], 'foreground': tokens['colors']['foreground'], 'selection': tokens['colors']['selection'], 'caret': tokens['colors']['foreground']}}]
        for scope, index in [('keyword, storage', 13), ('string', 10), ('constant.numeric, constant.language', 11), ('entity.name.function, support.function', 12), ('entity.name.type, support.type, support.class', 11), ('variable, entity.other.attribute-name', 14), ('invalid, markup.deleted', 9), ('markup.inserted', 10), ('markup.heading', 12)]:
            rules.append({'scope': scope, 'settings': {'foreground': ansi[index]}})
        rules.append({'scope': 'comment', 'settings': {'foreground': tokens['colors']['dim']}})
        files[f'integrations/codex/{theme_name}.tmTheme'] = plistlib.dumps({'name':theme_name, 'settings':rules})
    files['integrations/claude/settings.fragment.json'] = json_bytes({'theme':'dark-ansi'})
    preset = resolve(read_json(src / 'optional-settings.json'), tokens)
    files['preferences/settings.fragment.json'] = json_bytes(preset)
    bindings = read_json(src / 'optional-keys.json')
    bindings.update(read_json(src / 'package-keys.json'))
    files['preferences/keys.fragment.json'] = json_bytes(bindings)
    files['preferences/font-defaults.json'] = json_bytes({key:preset[key] for key in ('font','ui_font','font_size','zoom','font_ligatures','minimum_contrast')})
    files['programs.json'] = (src / 'package-programs.json').read_bytes()
    files['keys.json'] = (src / 'package-keys.json').read_bytes()
    return files

def build(destination, check=False, root=ROOT):
    files = outputs(root)
    for required in ('README.md', 'RECIPE.md', 'preview.png'):
        if required not in files:
            raise ValueError('Missing native release file: ' + required)
    if not files['preview.png'].startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('preview.png must be a PNG captured from Herdr')
    current = {p.relative_to(destination).as_posix(): p.read_bytes() for p in destination.rglob('*') if p.is_file()} if destination.exists() else {}
    if check:
        # Herdr's checker creates these editor-support files alongside main.js.
        current = {p:b for p,b in current.items() if not (p.startswith('mods/') and (p.endswith('.d.ts') or p.endswith('/jsconfig.json')))}
    if check:
        stale = sorted(p for p in set(files) | set(current) if files.get(p) != current.get(p))
        if stale:
            raise ValueError('Stale generated output: ' + ', '.join(stale))
    else:
        destination.mkdir(parents=True, exist_ok=True)
        for name, content in files.items():
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        for name in set(current) - set(files):
            (destination / name).unlink()
    return len(files)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if generated files differ; write nothing')
    args = parser.parse_args()
    try:
        count = build(ROOT / 'release/blackx', args.check)
    except (ValueError, KeyError) as error:
        sys.exit(str(error))
    print(f'{"Checked" if args.check else "Built"} {count} files in release/blackx/')

if __name__ == '__main__':
    main()
