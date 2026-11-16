#!/usr/bin/env python3
"""Sign and atomically publish the Android channel using the VPS-owned identity."""
import datetime
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from android_inputs import APP_ID, TOOL_NAME, sha256, source_digest

ORIGIN = "https://core-aura.coreeye.in"

def fetch(url, path, limit):
    request = urllib.request.Request(url, headers={"User-Agent": "Core-aura-Android-publisher", "Accept": "application/octet-stream"})
    with urllib.request.urlopen(request, timeout=60) as response, Path(path).open("wb") as out:
        size = 0
        while block := response.read(1024 * 1024):
            size += len(block)
            if size > limit:
                raise ValueError("Android build input exceeds its allowed size")
            out.write(block)

def command(args):
    try:
        return subprocess.check_output([str(a) for a in args], stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(error.output.decode(errors="replace").strip()) from None

def signing_identity(state, published):
    key, password = state / "release.p12", state / "password"
    if key.exists() != password.exists():
        raise ValueError("Android signing state is incomplete. Restore its private backup; do not generate a different key.")
    if not key.exists():
        if published:
            raise ValueError("A channel already exists. Restore the original Android signing backup before publishing.")
        state.mkdir(parents=True, exist_ok=True, mode=0o700)
        state.chmod(0o700)
        password.write_text(secrets.token_hex(32))
        password.chmod(0o600)
        try:
            command(["keytool", "-genkeypair", "-noprompt", "-storetype", "PKCS12", "-keystore", key, "-alias", "core-aura", "-keyalg", "RSA", "-keysize", "3072", "-sigalg", "SHA256withRSA", "-validity", "10000", "-dname", "CN=Core-aura Android", "-storepass:file", password, "-keypass:file", password])
        except Exception:
            key.unlink(missing_ok=True)
            password.unlink(missing_ok=True)
            raise
        key.chmod(0o600)
    certificate = subprocess.check_output(["keytool", "-exportcert", "-keystore", str(key), "-alias", "core-aura", "-storepass:file", str(password)], stderr=subprocess.PIPE)
    import hashlib
    fingerprint = hashlib.sha256(certificate).hexdigest()
    backup = Path(os.environ.get("CORE_AURA_ANDROID_BACKUP", str(state.parent / "android-signing-backup.tar.gz")))
    if not backup.exists():
        backup.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(backup, "w:gz") as archive:
            archive.add(key, arcname="android-signing/release.p12")
            archive.add(password, arcname="android-signing/password")
        backup.chmod(0o600)
    return key, password, fingerprint

def publish(inputs):
    version = json.loads((ROOT / "package.json").read_text())["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Invalid application version")
    metadata_path = inputs / "publish-inputs.json"
    if metadata_path.stat().st_size > 32768:
        raise ValueError("Android metadata is too large")
    metadata = json.loads(metadata_path.read_text())
    apk_name = f"core-aura-{version}-unsigned.apk"
    if metadata.get("schemaVersion") != 1 or metadata.get("applicationId") != APP_ID or metadata.get("versionName") != version or metadata.get("sourceDigest") != source_digest() or type(metadata.get("versionCode")) is not int or not 0 < metadata["versionCode"] <= 2100000000 or type(metadata.get("minSdk")) is not int or not 23 <= metadata["minSdk"] <= 100 or set(metadata.get("assets", {})) != {apk_name, TOOL_NAME}:
        raise ValueError("Android build inputs do not match this checkout. Pull the matching release before publishing.")
    for name, expected in metadata["assets"].items():
        path = inputs / name
        if not re.fullmatch(r"[a-f0-9]{64}", expected) or path.stat().st_size > 150 * 1024 * 1024 or sha256(path) != expected:
            raise ValueError("Android build input checksum does not match")
    public = Path(os.environ.get("CORE_AURA_ROOT", "/var/www/core-aura")) / "android"
    public.mkdir(parents=True, exist_ok=True, mode=0o755)
    public.chmod(0o755)
    for name in ("current", "latest.json", "core-aura-latest.apk"):
        path = public / name
        if path.exists() and not path.is_symlink():
            raise ValueError(f"Refusing to replace an unmanaged Android channel entry: {name}")
    state = Path(os.environ.get("CORE_AURA_ANDROID_STATE", "/var/lib/core-aura/android-signing"))
    old = json.loads((public / "latest.json").read_text()) if (public / "latest.json").exists() else None
    key, password, fingerprint = signing_identity(state, old is not None)
    if old:
        if old["certificateSha256"] != fingerprint:
            raise ValueError("Refusing to change the published Android signing identity")
        if old["versionCode"] > metadata["versionCode"]:
            raise ValueError("Refusing to publish an older Android build")
        if old["versionCode"] == metadata["versionCode"]:
            if old.get("sourceDigest") != metadata["sourceDigest"] or old.get("unsignedSha256") != metadata["assets"][apk_name]:
                raise ValueError("This Android build number is already published. Increase versionCode before publishing changed code.")
            target = public / "current" / f"core-aura-{version}.apk"
            if not target.is_file() or sha256(target) != old["sha256"]:
                raise ValueError("The published APK is missing or damaged; restore the verified channel backup")
            print(f"Android {version} is already published at {ORIGIN}/download.html")
            return
    releases = public / "releases"
    releases.mkdir(exist_ok=True, mode=0o755)
    releases.chmod(0o755)
    stage = Path(tempfile.mkdtemp(prefix=".stage-", dir=public))
    try:
        signed_name = f"core-aura-{version}.apk"
        signed = stage / signed_name
        signer = inputs / TOOL_NAME
        command(["java", "-jar", signer, "sign", "--ks", key, "--ks-key-alias", "core-aura", "--ks-pass", "file:" + str(password), "--ks-type", "PKCS12", "--v4-signing-enabled", "false", "--out", signed, inputs / apk_name])
        verification = command(["java", "-jar", signer, "verify", "--verbose", "--print-certs", signed]).decode()
        certificate = re.search(r"Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]{64})", verification)
        if not certificate or certificate[1].lower() != fingerprint:
            raise ValueError("Signed APK verification did not match the permanent signing identity")
        digest = sha256(signed)
        channel = {"schemaVersion": 1, "applicationId": APP_ID, "versionName": version, "versionCode": metadata["versionCode"], "minSdk": metadata["minSdk"], "url": f"{ORIGIN}/android/releases/{digest}/{signed_name}", "sha256": digest, "size": signed.stat().st_size, "certificateSha256": fingerprint, "publishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "sourceDigest": metadata["sourceDigest"], "unsignedSha256": metadata["assets"][apk_name]}
        (stage / "latest.json").write_text(json.dumps(channel, indent=2) + "\n")
        os.link(signed, stage / "core-aura-latest.apk")
        for path in stage.iterdir():
            path.chmod(0o644)
        stage.chmod(0o755)
        destination = releases / digest
        if destination.exists():
            raise ValueError("A release directory with this APK hash already exists; inspect it before publishing")
        os.replace(stage, destination)
        pointer = public / (".current-" + secrets.token_hex(8))
        pointer.symlink_to("releases/" + digest)
        os.replace(pointer, public / "current")
        for name in ("latest.json", "core-aura-latest.apk"):
            link = public / name
            if not link.is_symlink():
                if link.exists():
                    raise ValueError(f"Refusing to overwrite an unmanaged Android channel file: {name}")
                link.symlink_to("current/" + name)
        print(f"Published Android {version}, build {metadata['versionCode']}")
        print(f"Download page: {ORIGIN}/download.html")
        print(f"APK: {ORIGIN}/android/core-aura-latest.apk")
        print(f"Certificate SHA-256: {fingerprint}")
    finally:
        if stage.exists():
            shutil.rmtree(stage)

def main():
    os.umask(0o077)
    local = os.environ.get("CORE_AURA_ANDROID_INPUTS")
    if local:
        publish(Path(local).resolve())
        return
    version = json.loads((ROOT / "package.json").read_text())["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Invalid version")
    base = f"https://github.com/coreeyegroup/core-aura/releases/download/android-v{version}/"
    with tempfile.TemporaryDirectory(prefix="core-aura-android-inputs-") as directory:
        inputs = Path(directory)
        fetch(base + "publish-inputs.json", inputs / "publish-inputs.json", 32768)
        for name, limit in ((f"core-aura-{version}-unsigned.apk", 150 * 1024 * 1024), (TOOL_NAME, 20 * 1024 * 1024)):
            fetch(base + name, inputs / name, limit)
        publish(inputs)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Android publication failed: {error}", file=sys.stderr)
        sys.exit(1)
