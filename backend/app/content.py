"""Immutable uploaded PCM audio. Publication is authorized separately by pack state."""

import fcntl
import hashlib
import os
from pathlib import Path
import re
import tempfile
import wave
from fastapi import HTTPException
from .database import SessionLocal
from .models import StoredAsset

MAX_FILE = 25 * 1024 * 1024


def root():
    path = Path(os.environ.get("CORE_AURA_CONTENT_ROOT", "./content"))
    path.mkdir(parents=True, exist_ok=True)
    (path / ".incoming").mkdir(mode=0o700, exist_ok=True)
    return path


def file_path(sha):
    if not re.fullmatch(r"[a-f0-9]{64}", sha):
        raise HTTPException(404, "Audio unavailable")
    return root() / (sha + ".wav")


def asset_record(asset, asset_id=None, title=None):
    return dict(
        id=asset_id or asset.asset_id,
        title=title or asset.title,
        url=f"/packs/uploads/{asset.sha256}.wav",
        sha256=asset.sha256,
        bytes=asset.bytes,
        seconds=asset.seconds,
    )


def digest_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(262144), b""):
            digest.update(chunk)
    return digest.hexdigest()


def finalize_upload(raw, asset_id, title, actor):
    path = root()
    candidate = None
    try:
        try:
            with wave.open(str(raw), "rb") as source:
                channels, width, rate, frames = (
                    source.getnchannels(),
                    source.getsampwidth(),
                    source.getframerate(),
                    source.getnframes(),
                )
                if (
                    channels not in (1, 2)
                    or width != 2
                    or rate not in (44100, 48000)
                    or source.getcomptype() != "NONE"
                    or frames < 1
                    or frames * channels * width + 44 > MAX_FILE
                    or frames / rate > 600
                ):
                    raise ValueError()
                audio = source.readframes(frames)
                if len(audio) != frames * channels * width:
                    raise ValueError()
        except (wave.Error, EOFError, ValueError):
            raise HTTPException(
                422,
                "Choose a complete 16-bit PCM WAV, mono/stereo, 44.1 or 48 kHz, under 25 MB",
            )
        fd, name = tempfile.mkstemp(dir=path / ".incoming", suffix=".wav")
        os.close(fd)
        candidate = Path(name)
        with wave.open(str(candidate), "wb") as output:
            output.setnchannels(channels)
            output.setsampwidth(width)
            output.setframerate(rate)
            output.writeframes(audio)
        del audio
        sha = digest_file(candidate)
        size = candidate.stat().st_size
        target = file_path(sha)
        with (path / ".commit.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            if target.exists():
                if digest_file(target) != sha:
                    raise HTTPException(
                        409, "Stored audio needs recovery before it can be reused"
                    )
            else:
                used = sum(p.stat().st_size for p in path.glob("*.wav"))
                limit = int(
                    os.environ.get("CORE_AURA_CONTENT_LIMIT_BYTES", str(2 * 1024**3))
                )
                if used + size > limit:
                    raise HTTPException(
                        507, "Content storage is full; contact the server administrator"
                    )
                os.chmod(candidate, 0o640)
                with candidate.open("rb") as persisted:
                    os.fsync(persisted.fileno())
                os.replace(candidate, target)
                directory = os.open(path, os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
            with SessionLocal() as db:
                asset = db.get(StoredAsset, sha)
                if asset is None:
                    asset = StoredAsset(
                        sha256=sha,
                        asset_id=asset_id,
                        title=title,
                        bytes=size,
                        seconds=frames / rate,
                        created_by=actor,
                    )
                    db.add(asset)
                    db.commit()
                return asset_record(asset, asset_id, title)
    finally:
        if candidate is not None:
            candidate.unlink(missing_ok=True)


def verify_assets(db, assets):
    if not assets:
        raise HTTPException(409, "Upload and attach audio before review or publication")
    for item in assets:
        sha = item["sha256"]
        asset = db.get(StoredAsset, sha)
        path = file_path(sha)
        if (
            item["url"] != f"/packs/uploads/{sha}.wav"
            or asset is None
            or asset.bytes != item["bytes"]
            or abs(asset.seconds - item["seconds"]) > 0.01
            or not path.is_file()
            or path.stat().st_size != asset.bytes
            or digest_file(path) != sha
        ):
            raise HTTPException(
                409,
                "An attached file is missing or changed. Upload it again before continuing",
            )
