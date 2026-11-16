"""Exercise real APK signing with an ephemeral CI identity; never publish that key."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
inputs = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix="core-aura-android-publication-") as directory:
    temporary = Path(directory)
    web, state = temporary / "site", temporary / "signing"
    environment = {**os.environ, "CORE_AURA_ROOT": str(web), "CORE_AURA_ANDROID_STATE": str(state), "CORE_AURA_ANDROID_INPUTS": str(inputs), "CORE_AURA_ANDROID_BACKUP": str(temporary / "private-backup.tar.gz")}
    def publish(success=True):
        result = subprocess.run(["bash", "ops/publish-android.sh"], cwd=ROOT, env=environment, text=True, capture_output=True)
        if success:
            assert result.returncode == 0, result.stdout + result.stderr
        else:
            assert result.returncode != 0, "Publication should have been rejected"
        return result
    publish()
    channel = json.loads((web / "android/latest.json").read_text())
    assert channel["applicationId"] == "in.coreeye.coreaura"
    assert channel["versionName"] == json.loads((ROOT / "package.json").read_text())["version"]
    assert len(channel["sha256"]) == len(channel["certificateSha256"]) == 64
    assert (state / "release.p12").stat().st_mode & 0o077 == 0
    assert (temporary / "private-backup.tar.gz").stat().st_mode & 0o077 == 0
    original = (web / "android/latest.json").read_bytes()
    publish()
    assert (web / "android/latest.json").read_bytes() == original
    # An ordinary web deployment cannot replace the independent Android channel.
    (web / "releases/web-test").mkdir(parents=True)
    (web / "current").symlink_to("releases/web-test")
    assert (web / "android/core-aura-latest.apk").is_file()
    # Failed input validation leaves the public pointer and existing APK intact.
    damaged = temporary / "damaged"
    shutil.copytree(inputs, damaged)
    metadata = json.loads((damaged / "publish-inputs.json").read_text())
    (damaged / next(name for name in metadata["assets"] if name.endswith(".apk"))).write_bytes(b"damaged")
    environment["CORE_AURA_ANDROID_INPUTS"] = str(damaged)
    publish(False)
    assert (web / "android/latest.json").read_bytes() == original
    environment["CORE_AURA_ANDROID_INPUTS"] = str(inputs)
    (state / "password").unlink()
    publish(False)
    assert (web / "android/latest.json").read_bytes() == original
    print("Real APK signing, verified certificate, idempotent publication, independent web deployment, private backup and failure preservation passed.")
