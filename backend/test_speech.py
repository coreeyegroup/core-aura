import io
import os
import shutil
import tempfile
import unittest
import wave
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mktemp(suffix=".db"))
from fastapi.testclient import TestClient
from app.main import app
from app.speech import SpeechInput, render, voices, rate_window


class SpeechTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        rate_window[:] = [0, 0]
        self.origin = {
            "Origin": os.getenv(
                "CORE_AURA_PUBLIC_ORIGIN", "https://core-aura.coreeye.in"
            )
        }

    def fixture(self):
        out = io.BytesIO()
        with wave.open(out, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(22050)
            w.writeframes(b"\x10\x20" * 22050)
        return out.getvalue()

    def test_scoped_bounded_requests(self):
        body = {"text": "A short sentence.", "voice": "core:en-us", "rate": 1}
        self.assertEqual(
            self.client.post("/api/speech/speak", json=body).status_code, 403
        )
        self.assertEqual(
            self.client.post(
                "/api/speech/speak", content=b"x" * 4097, headers=self.origin
            ).status_code,
            413,
        )
        self.assertEqual(
            self.client.post(
                "/api/speech/speak",
                json={**body, "text": "x" * 301},
                headers=self.origin,
            ).status_code,
            422,
        )
        with patch("app.speech.voices", return_value=[]):
            self.assertEqual(
                self.client.post(
                    "/api/speech/speak", json=body, headers=self.origin
                ).status_code,
                503,
            )

    def test_text_uses_stdin_not_shell_and_validated_wav_no_store(self):
        class Result:
            stdout = self.fixture()

        with patch(
            "app.speech.voices", return_value=[{"voiceURI": "core:en-us"}]
        ), patch("app.speech.subprocess.run", return_value=Result()) as run:
            text = "$(touch /tmp/not-executed); I focus."
            r = self.client.post(
                "/api/speech/speak",
                json={"text": text, "voice": "core:en-us", "rate": 1},
                headers=self.origin,
            )
            self.assertEqual(r.status_code, 200, r.text if r.status_code != 200 else "")
            self.assertEqual(r.headers["cache-control"], "no-store")
            self.assertEqual(run.call_args.kwargs["input"], text.encode())
            self.assertNotIn(text, run.call_args.args[0])
            self.assertNotIn("shell", run.call_args.kwargs)
            with wave.open(io.BytesIO(r.content)) as w:
                self.assertEqual(w.getnframes(), 22050)
            r = self.client.post(
                "/api/speech/speak",
                json={"text": "hello", "voice": "core:bad;rm", "rate": 1},
                headers=self.origin,
            )
            self.assertEqual(r.status_code, 422)

    def test_actual_synthesis(self):
        if not shutil.which("espeak-ng"):
            self.skipTest("Real eSpeak NG synthesis runs in CI and the Docker image")
        voices.cache_clear()
        rows = voices()
        self.assertGreaterEqual(len(rows), 15)
        for language in ["en-us", "hi", "kn"]:
            self.assertTrue(any(v["voiceURI"] == "core:" + language for v in rows))
            content = render(
                SpeechInput(
                    text={"hi": "मैं शांत हूँ।", "kn": "ನಾನು ಶಾಂತವಾಗಿದ್ದೇನೆ."}.get(
                        language, "I am ready to begin."
                    ),
                    voice="core:" + language,
                    rate=1,
                )
            )
            with wave.open(io.BytesIO(content)) as w:
                self.assertGreater(w.getnframes(), 1000)
                self.assertLessEqual(w.getnframes() / w.getframerate(), 65)
                self.assertTrue(any(w.readframes(w.getnframes())))


if __name__ == "__main__":
    unittest.main()
