"""Optional on-server synthesis. Text is neither persisted nor included in logs."""

import asyncio
import functools
import io
import json
import os
import shutil
import subprocess
import threading
import time
import wave
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

router = APIRouter(prefix="/api/speech")
slots = threading.BoundedSemaphore(2)
rate_lock = threading.Lock()
rate_window = [0.0, 0]
LANGUAGES = [
    ("en-us", "English (US)", "en-US"),
    ("en-gb", "English (UK)", "en-GB"),
    ("en-in", "English (India)", "en-IN"),
    ("hi", "Hindi", "hi-IN"),
    ("kn", "Kannada", "kn-IN"),
    ("ta", "Tamil", "ta-IN"),
    ("te", "Telugu", "te-IN"),
    ("ml", "Malayalam", "ml-IN"),
    ("mr", "Marathi", "mr-IN"),
    ("bn", "Bengali", "bn-IN"),
    ("gu", "Gujarati", "gu-IN"),
    ("pa", "Punjabi", "pa-IN"),
    ("es", "Spanish", "es-ES"),
    ("fr-fr", "French", "fr-FR"),
    ("de", "German", "de-DE"),
    ("pt-br", "Portuguese", "pt-BR"),
]


@functools.lru_cache(maxsize=1)
def voices():
    if not shutil.which("espeak-ng"):
        return []
    try:
        output = subprocess.run(
            ["espeak-ng", "--voices"],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        ).stdout
        installed = {
            line.split()[1]
            for line in output.splitlines()[1:]
            if len(line.split()) >= 4
        }
        return [
            {
                "voiceURI": "core:" + code + variant,
                "name": f"Core-aura {name} · {label}",
                "lang": lang,
                "localService": False,
            }
            for code, name, lang in LANGUAGES
            if code in installed
            for variant, label in [
                ("", "Standard"),
                ("+f2", "Style B"),
                ("+m3", "Style C"),
            ]
        ]
    except (OSError, subprocess.SubprocessError):
        return []


class SpeechInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=300)
    voice: str = Field(max_length=100)
    rate: float = Field(ge=0.5, le=1.5)


@router.get("/voices")
def list_voices():
    rows = voices()
    return {
        "ready": bool(rows),
        "voices": rows,
        "engine": "eSpeak NG",
        "privacy": "Selected text is processed on your Core-aura server and is not saved.",
    }


def render(data: SpeechInput):
    if data.voice not in {v["voiceURI"] for v in voices()}:
        raise HTTPException(422, "Choose an available Core-aura voice.")
    if not data.text.strip() or "\x00" in data.text:
        raise HTTPException(422, "Enter a sentence to speak.")
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Voice synthesis is busy. Try again shortly.")
    try:
        with rate_lock:
            now = time.monotonic()
            if now - rate_window[0] >= 60:
                rate_window[:] = [now, 0]
            if rate_window[1] >= 120:
                raise HTTPException(429, "Voice synthesis is busy. Try again shortly.")
            rate_window[1] += 1
        try:
            output = subprocess.run(
                [
                    "espeak-ng",
                    "--stdout",
                    "--stdin",
                    "-b",
                    "1",
                    "-v",
                    data.voice[5:],
                    "-s",
                    str(round(175 * data.rate)),
                ],
                input=data.text.encode("utf8"),
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                check=True,
                timeout=10,
            ).stdout
            if len(output) > 6 * 1024 * 1024:
                raise ValueError()
            with wave.open(io.BytesIO(output), "rb") as audio:
                rate, channels, width = (
                    audio.getframerate(),
                    audio.getnchannels(),
                    audio.getsampwidth(),
                )
                if channels != 1 or width != 2 or not 8000 <= rate <= 48000:
                    raise ValueError()
                frames = audio.readframes(rate * 65 + 1)
                if not frames or len(frames) > rate * 65 * 2:
                    raise ValueError()
            # --stdout can contain streaming-length placeholders; emit a canonical WAV.
            result = io.BytesIO()
            with wave.open(result, "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(rate)
                audio.writeframes(frames)
            return result.getvalue()
        except subprocess.TimeoutExpired:
            raise HTTPException(
                503, "The voice engine timed out. Try a shorter sentence."
            )
        except (OSError, subprocess.SubprocessError, wave.Error, ValueError, EOFError):
            raise HTTPException(
                503,
                "Speech could not be generated. Try a shorter sentence or another voice.",
            )
    finally:
        slots.release()


@router.post("/speak")
async def speak(request: Request):
    allowed = {
        os.getenv("CORE_AURA_PUBLIC_ORIGIN", "https://core-aura.coreeye.in").rstrip(
            "/"
        ),
        "capacitor://localhost",
        "https://localhost",
        "http://localhost",
    }
    if request.headers.get("origin") not in allowed:
        raise HTTPException(403, "Use the Core-aura app for speech.")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 4096:
            raise HTTPException(413, "Choose a shorter sentence.")
    try:
        data = SpeechInput.model_validate_json(bytes(raw))
    except ValidationError:
        raise HTTPException(
            422, "Enter up to 300 characters and choose a valid voice and speed."
        )
    if not voices():
        raise HTTPException(
            503, "Core-aura voices are unavailable. Update the speech backend first."
        )
    content = await run_in_threadpool(render, data)
    return Response(
        content,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
