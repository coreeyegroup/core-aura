import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
LEGACY = 'core-aura.coreeye.in {\n root * /var/www/core-aura/current\n file_server\n}\n'

class SiteUpgrade(unittest.TestCase):
    def run_upgrade(self, original, fail=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site = root / "core-aura.caddy"
            site.write_text(original)
            for name in ("caddy", "systemctl"):
                tool = root / name
                tool.write_text("#!/bin/sh\nexit " + ("1" if fail and name == "caddy" else "0") + "\n")
                tool.chmod(0o755)
            env = {**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"], "CORE_AURA_CADDY_SITE": str(site)}
            result = subprocess.run(["bash", "ops/update-site.sh", "--enable-api"], cwd=ROOT, env=env, text=True, capture_output=True)
            return result, site.read_text()
    def test_legacy_upgrade_adds_separate_apk_and_pack_headers(self):
        result, updated = self.run_upgrade(LEGACY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('handle_path /android/*', updated)
        self.assertIn('@coreAuraPackFiles path /packs/*', updated)
        self.assertIn('handle /api/*', updated)
        self.assertIn('application/vnd.android.package-archive', updated)
        result, again = self.run_upgrade(updated)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(again, updated)
    def test_failed_validation_preserves_existing_site(self):
        result, updated = self.run_upgrade(LEGACY, fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(updated, LEGACY)

if __name__ == '__main__':
    unittest.main()
