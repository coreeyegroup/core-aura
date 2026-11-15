"""Verify the non-root image and persistence across container recreation."""

import hashlib
import io
import json
from pathlib import Path
import subprocess
import time
import urllib.request
import uuid
import wave

name = "core-aura-smoke-" + uuid.uuid4().hex[:12]
volume = name + "-content"
image = name + ":test"
base = "http://127.0.0.1:8794"


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def start():
    run(
        "docker",
        "run",
        "-d",
        "--name",
        name,
        "-p",
        "127.0.0.1:8794:8000",
        "-e",
        "DATABASE_URL=sqlite:////data/content/smoke.db",
        "-e",
        "CORE_AURA_CONTENT_ROOT=/data/content",
        "-e",
        "CORE_AURA_ADMIN_TOKEN=container-test-key",
        "-v",
        volume + ":/data/content",
        image,
    )
    for _ in range(60):
        try:
            with urllib.request.urlopen(base + "/api/health", timeout=2) as response:
                if json.load(response)["status"] == "ok":
                    return
        except Exception:
            time.sleep(1)
    raise RuntimeError("Container health did not become ready")


try:
    subprocess.run(["docker", "build", "-t", image, "backend"], check=True)
    run("docker", "volume", "create", volume)
    start()
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(44100)
        audio.writeframes(b"\x01\x00" * 4410)
    request = urllib.request.Request(
        base + "/api/admin/assets/container-fixture?title=Container",
        data=output.getvalue(),
        method="POST",
        headers={
            "Authorization": "Bearer container-test-key",
            "Content-Type": "audio/wav",
        },
    )
    with urllib.request.urlopen(request) as response:
        asset = json.load(response)
    run("docker", "rm", "-f", name)
    start()
    request = urllib.request.Request(
        base + "/api/admin/assets/" + asset["sha256"],
        headers={"Authorization": "Bearer container-test-key"},
    )
    with urllib.request.urlopen(request) as response:
        content = response.read()
    assert hashlib.sha256(content).hexdigest() == asset["sha256"]
    print("Non-root upload and persistence across container recreation passed")
finally:
    subprocess.run(["docker", "logs", name], check=False)
    subprocess.run(["docker", "rm", "-f", name], check=False)
    subprocess.run(["docker", "volume", "rm", volume], check=False)
