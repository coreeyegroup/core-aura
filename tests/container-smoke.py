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


def start(public_key=""):
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
        "-e",
        "CORE_AURA_VAPID_PUBLIC_KEY=" + public_key,
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
    with urllib.request.urlopen(base + "/api/speech/voices") as response:
        voice_config = json.load(response)
    assert voice_config["ready"] and len(voice_config["voices"]) >= 15
    spoken = urllib.request.Request(
        base + "/api/speech/speak",
        data=json.dumps(
            {"text": "I am ready to begin.", "voice": "core:en-us", "rate": 1}
        ).encode(),
        headers={
            "Origin": "https://core-aura.coreeye.in",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(spoken) as response:
        with wave.open(io.BytesIO(response.read())) as audio:
            assert audio.getnframes() > 1000 and any(
                audio.readframes(audio.getnframes())
            )
    print("Actual container speech synthesis produced non-silent PCM audio")
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
    # Generate persistent keys without printing their private component.
    run(
        "docker",
        "exec",
        name,
        "python",
        "-c",
        "from pathlib import Path; Path('/data/content/vapid.env').touch()",
    )
    run(
        "docker",
        "exec",
        name,
        "python",
        "scripts/generate-vapid.py",
        "/data/content/vapid.env",
    )
    read_key = "from pathlib import Path; import hashlib; print(hashlib.sha256(Path('/data/content/vapid.env').read_bytes()).hexdigest())"
    before = run("docker", "exec", name, "python", "-c", read_key).stdout
    run(
        "docker",
        "exec",
        name,
        "python",
        "scripts/generate-vapid.py",
        "/data/content/vapid.env",
    )
    assert run("docker", "exec", name, "python", "-c", read_key).stdout == before
    public = run(
        "docker",
        "exec",
        name,
        "python",
        "-c",
        "from pathlib import Path; print(dict(l.split('=',1) for l in Path('/data/content/vapid.env').read_text().splitlines() if '=' in l)['CORE_AURA_VAPID_PUBLIC_KEY'])",
    ).stdout.strip()
    run("docker", "rm", "-f", name)
    start(public)
    with urllib.request.urlopen(base + "/api/manifest-reminders/config") as response:
        assert not json.load(response)["ready"]
    run(
        "docker",
        "run",
        "-d",
        "--name",
        name + "-worker",
        "-e",
        "DATABASE_URL=sqlite:////data/content/smoke.db",
        "-v",
        volume + ":/data/content",
        image,
        "python",
        "-c",
        "import os; from pathlib import Path; os.environ.update(dict(l.split('=',1) for l in Path('/data/content/vapid.env').read_text().splitlines() if '=' in l)); from app.reminder_worker import main; main()",
    )
    for attempt in range(30):
        with urllib.request.urlopen(
            base + "/api/manifest-reminders/config"
        ) as response:
            config = json.load(response)
        if config["ready"]:
            break
        time.sleep(1)
    else:
        raise RuntimeError("Reminder worker failed to become ready")
    assert config["publicKey"] == public
    print(
        "Persistent VAPID key generation and separate reminder worker readiness passed; no subscriptions were registered or sent."
    )
finally:
    subprocess.run(["docker", "rm", "-f", name + "-worker"], check=False)
    subprocess.run(["docker", "logs", name], check=False)
    subprocess.run(["docker", "rm", "-f", name], check=False)
    subprocess.run(["docker", "volume", "rm", volume], check=False)
