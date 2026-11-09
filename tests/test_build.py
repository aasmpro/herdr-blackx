import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build import ROOT, build, outputs, resolve

class BundleTests(unittest.TestCase):
    def test_program_icons_are_bundled_lucide_assets(self):
        files = outputs()
        programs = json.loads(files['programs.json'])['programs']
        self.assertTrue(programs)
        for entry in programs.values():
            self.assertTrue(entry['tint'])
            self.assertIn(entry['icon'], files)
            self.assertTrue(entry['icon'].startswith('mods/blackx-chrome/icons/'))
        for path in files:
            if path.endswith('.svg'):
                self.assertIn('/icons/', path)
        self.assertIn('mods/blackx-chrome/icons/LICENSE', files)

    def test_native_release_structure(self):
        files = outputs()
        self.assertTrue({'README.md', 'RECIPE.md', 'preview.png', 'layouts/blackx.json', 'themes/blackx.json', 'themes/blackx-mono.json'} <= set(files))
        self.assertTrue(files['preview.png'].startswith(b'\x89PNG\r\n\x1a\n'))
        self.assertFalse(any(p.startswith(('optional/', 'tools/', 'src/')) for p in files))
        self.assertNotIn('settings.json', files)
        self.assertEqual(set(json.loads(files['keys.json'])), {'layout:blackx'})
        self.assertNotIn('manifest.json', files)
        mods = {p.split('/')[1] for p in files if p.startswith('mods/')}
        self.assertEqual(mods, {'blackx-agents', 'blackx-changes', 'blackx-chrome', 'blackx-files', 'blackx-pane', 'blackx-spaces', 'blackx-status', 'blackx-tabs', 'blackx-settings', 'blackx-palette', 'blackx-menu', 'blackx-new-menu', 'blackx-picker', 'blackx-prompt', 'blackx-confirm', 'blackx-worktree', 'blackx-machine-add', 'blackx-help', 'blackx-feedback', 'blackx-welcome', 'blackx-whatsnew'})
        for path, content in files.items():
            if path.endswith(('.js', '.json')):
                self.assertNotIn(b'mods/my-', content)
        self.assertNotIn('my-', json.dumps(json.loads(files['layouts/blackx.json'])))

    def test_configuration_fragments_preserve_settings_and_shortcuts(self):
        files = outputs()
        settings = json.loads(files['preferences/settings.fragment.json'])
        expected = resolve(json.loads((ROOT / 'src/optional-settings.json').read_text()), json.loads((ROOT / 'src/styles.json').read_text()))
        self.assertEqual(settings, expected)
        bindings = json.loads(files['preferences/keys.fragment.json'])
        self.assertEqual(bindings['layout:blackx'], json.loads(files['keys.json'])['layout:blackx'])
        original = json.loads((ROOT / 'src/optional-keys.json').read_text())
        for section, values in original.items():
            self.assertEqual(bindings[section], values)

    def test_deterministic_and_detects_stale_output(self):
        with tempfile.TemporaryDirectory() as directory:
            dest = Path(directory)
            build(dest)
            self.assertEqual(outputs(), outputs())
            build(dest, check=True)
            (dest / 'themes/blackx.json').write_text('{}')
            with self.assertRaisesRegex(ValueError, 'Stale'):
                build(dest, check=True)

    def test_style_changes_reach_all_generated_consumers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'src', root / 'src')
            tokens = json.loads((ROOT / 'src/styles.json').read_text())
            tokens['colors']['foreground'] = '#abcdef'
            tokens['sidebar']['expanded'] = 310
            tokens['components']['changes']['diffRowHeight'] = 24
            (root / 'src/styles.json').write_text(json.dumps(tokens))
            result = outputs(root)
            self.assertEqual(json.loads(result['themes/blackx.json'])['foreground'], '#abcdef')
            self.assertEqual(json.loads(result['layouts/blackx.json'])['children'][0]['size']['px'], 310)
            for name in ('blackx-agents', 'blackx-chrome', 'blackx-files', 'blackx-changes', 'blackx-spaces', 'blackx-tabs', 'blackx-pane', 'blackx-status'):
                module = result[f'mods/{name}/style.js'].decode()
                self.assertIn('"foreground": "#abcdef"', module)
                self.assertIn('"expanded": 310', module)
                self.assertIn('"diffRowHeight": 24', module)
            changes = result['mods/blackx-changes/main.js'].decode()
            # Virtual-list geometry and rendered rows must use the same token.
            self.assertIn('.h(styles.components.changes.diffRowHeight)', changes)
            self.assertIn('this.rows.length, styles.components.changes.diffRowHeight,', changes)

    def test_bad_mod_token_reference_fails_before_install(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'src', root / 'src')
            mod = root / 'src/mods/blackx-files/main.js'
            mod.write_text(mod.read_text().replace('styles.components.files.fileRowHeight', 'styles.components.files.missingRowHeight'))
            with self.assertRaises(KeyError):
                outputs(root)

    def test_bad_references_fail(self):
        with self.assertRaises(KeyError):
            resolve({'$ref': 'missing'}, {})
        with self.assertRaisesRegex(ValueError, 'Cyclic'):
            resolve({'$ref': 'a'}, {'a': {'$ref': 'a'}})

    def test_installer_preserves_personal_state_and_refuses_collisions(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as tools:
            home = Path(directory)
            personal = {'font': 'Personal Font', 'zoom': 1.6, 'sounds': {'enabled': False}, 'colors': {'customRole': '#123456'}}
            (home / 'settings.json').write_text(json.dumps(personal))
            (home / 'keys.json').write_text('{"global":{"cmd-t":"custom"}}')
            (home / 'shared.json').write_text('{"sidebar.width":301}')
            original = {p.name:p.read_bytes() for p in home.iterdir()}
            # Stub only the dependency shell so installer tests cannot install system packages.
            shell = Path(tools) / 'sh'
            shell.write_text('#!/bin/sh\ncase "$1" in */install-dependencies.sh) exit 0 ;; *) exit 99 ;; esac\n')
            shell.chmod(0o755)
            env = {**os.environ, 'PATH': tools + os.pathsep + os.environ.get('PATH', '')}
            cmd = [sys.executable, str(ROOT / 'tools/install.py'), '--home', str(home)]
            subprocess.run(cmd, check=True, capture_output=True, env=env)
            for name, content in original.items():
                self.assertEqual((home / name).read_bytes(), content)
            self.assertNotEqual(subprocess.run(cmd, capture_output=True, env=env).returncode, 0)
            subprocess.run(cmd + ['--update', '--sync-style-settings'], check=True, capture_output=True, env=env)
            merged = json.loads((home / 'settings.json').read_text())
            self.assertEqual(merged['zoom'], 1.1)
            self.assertFalse(merged['font_ligatures'])
            self.assertEqual(merged['minimum_contrast'], 1)
            self.assertEqual(merged['sounds'], personal['sounds'])
            self.assertEqual(merged['colors']['customRole'], '#123456')
            self.assertEqual((home / 'keys.json').read_bytes(), original['keys.json'])
            self.assertEqual((home / 'shared.json').read_bytes(), original['shared.json'])
            self.assertTrue(list((home / 'backups').glob('*/settings.json')))
            shell.write_text('#!/bin/sh\nexit 7\n')
            before = (home / 'layouts/blackx.json').read_bytes()
            result = subprocess.run(cmd + ['--update'], capture_output=True, env=env)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((home / 'layouts/blackx.json').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
