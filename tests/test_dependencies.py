"""Exercise provisioning with fake executables; never invoke real package managers."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'src/install-dependencies.sh'

class DependenciesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.bin = Path(self.temp.name)
        self.env = {**os.environ, 'PATH': str(self.bin)}
        self.tool('uname', 'echo Darwin')
        for name in ('python3', 'git'):
            self.tool(name)

    def tool(self, name, body='exit 0'):
        path = self.bin / name
        path.write_text('#!/bin/sh\n' + body + '\n')
        path.chmod(0o755)

    def run_setup(self, *args):
        return subprocess.run(['/bin/sh', str(SCRIPT), *args], env=self.env, capture_output=True, text=True)

    def test_check_reports_missing_without_installing(self):
        self.tool('brew', 'exit 99')
        result = self.run_setup('--check')
        self.assertEqual(result.returncode, 1)
        self.assertIn('pdfinfo pdftoppm', result.stderr)

    def test_endpoint_does_not_need_pdf_tools(self):
        self.assertEqual(self.run_setup('--endpoint').returncode, 0)

    def test_brew_installs_poppler_once_and_verifies_commands(self):
        self.tool('brew', '''echo "$*" > "$PATH/calls"
for name in pdfinfo pdftoppm; do
  printf '#!/bin/sh\\nexit 0\\n' > "$PATH/$name"
  /bin/chmod +x "$PATH/$name"
done''')
        self.assertEqual(self.run_setup().returncode, 0)
        self.assertEqual((self.bin / 'calls').read_text().strip(), 'install poppler')
        (self.bin / 'calls').unlink()
        self.assertEqual(self.run_setup().returncode, 0)
        self.assertFalse((self.bin / 'calls').exists())

    def test_package_manager_failure_is_fatal(self):
        self.tool('brew', 'exit 7')
        self.assertEqual(self.run_setup().returncode, 7)

    def test_successful_manager_must_provide_missing_tools(self):
        self.tool('brew')
        self.assertNotEqual(self.run_setup().returncode, 0)

    def test_unsupported_platform_fails_explicitly(self):
        self.tool('uname', 'echo MINGW64_NT')
        self.assertIn('manually', self.run_setup().stderr)

    def test_linux_apt_endpoint_packages_exclude_pdf_and_reveal(self):
        self.tool('uname', 'echo Linux')
        self.tool('id', 'echo 0')
        (self.bin / 'python3').unlink()
        self.tool('apt-get', '\n'.join([
            'echo "$*" >> "$PATH/calls"',
            'if [ "$1" = install ]; then',
            'for name in python3 gio; do',
            "printf '#!/bin/sh\\nexit 0\\n' > \"$PATH/$name\"",
            '/bin/chmod +x "$PATH/$name"',
            'done',
            'fi',
        ]))
        self.assertEqual(self.run_setup('--endpoint').returncode, 0)
        self.assertEqual((self.bin / 'calls').read_text().splitlines(), ['update', 'install -y python3 libglib2.0-bin'])
