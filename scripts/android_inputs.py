#!/usr/bin/env python3
"""Prepare unsigned native build inputs; private signing keys never enter CI."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
APP_ID = "in.coreeye.coreaura"
TOOL_NAME = "apksigner-35.0.0.jar"

def sha256(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest() if hasattr(hashlib, "file_digest") else _stream_hash(stream)

def _stream_hash(stream):
    digest = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(block)
    return digest.hexdigest()

def source_digest():
    names = subprocess.check_output(["git", "-c", "safe.directory=" + str(ROOT), "ls-files", "-z", "--", "src", "public", "android", "scripts", "package.json", "package-lock.json", "index.html", "download.html", "capacitor.config.ts", "vite.config.ts"], cwd=ROOT).split(b"\0")
    digest = hashlib.sha256()
    for name in sorted(n for n in names if n):
        digest.update(name + b"\0")
        digest.update(bytes.fromhex(sha256(ROOT / name.decode())))
    return digest.hexdigest()

def prepare(apk, tools, output):
    apk, tools, output = Path(apk), Path(tools), Path(output)
    version = json.loads((ROOT / "package.json").read_text())["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Use a numeric three-part Android release version")
    badging = subprocess.check_output([str(tools / "aapt"), "dump", "badging", str(apk)], text=True)
    package = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging, re.M)
    sdk = re.search(r"^sdkVersion:'(\d+)'", badging, re.M)
    if not package or not sdk or package[1] != APP_ID or package[3] != version or "application-debuggable" in badging:
        raise ValueError("Expected the non-debug Core-aura release APK with matching version metadata")
    output.mkdir(parents=True, exist_ok=True)
    apk_name = f"core-aura-{version}-unsigned.apk"
    shutil.copyfile(apk, output / apk_name)
    shutil.copyfile(tools / "lib" / "apksigner.jar", output / TOOL_NAME)
    metadata = {"schemaVersion": 1, "applicationId": APP_ID, "versionName": version, "versionCode": int(package[2]), "minSdk": int(sdk[1]), "sourceCommit": subprocess.check_output(["git", "-c", "safe.directory=" + str(ROOT), "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(), "sourceDigest": source_digest(), "assets": {apk_name: sha256(output / apk_name), TOOL_NAME: sha256(output / TOOL_NAME)}}
    (output / "publish-inputs.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Prepared unsigned Android {version}, build {metadata['versionCode']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--digest", action="store_true")
    parser.add_argument("--apk")
    parser.add_argument("--tools")
    parser.add_argument("--output")
    args = parser.parse_args()
    if args.digest:
        print(source_digest())
    elif args.apk and args.tools and args.output:
        prepare(args.apk, args.tools, args.output)
    else:
        parser.error("Supply --digest or --apk, --tools and --output")
