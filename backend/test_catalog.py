import os
import tempfile
import unittest
import io
import wave
import hashlib
import struct
import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mktemp(suffix=".db"))
os.environ["CORE_AURA_ADMIN_TOKEN"] = "test-admin"
from fastapi.testclient import TestClient
from app.database import Base, engine
from app.models import Pack, StoredAsset, PackEvent
from app.main import app


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        os.environ["CORE_AURA_CONTENT_ROOT"] = self.directory.name
        os.environ["CORE_AURA_CONTENT_LIMIT_BYTES"] = str(2 * 1024**3)
        Base.metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(PackEvent.__table__.delete())
            connection.execute(Pack.__table__.delete())
            connection.execute(StoredAsset.__table__.delete())
        self.client = TestClient(app)
        self.auth = {
            "Authorization": "Bearer test-admin",
            "X-Core-Aura-Operator": "Test editor",
        }

    def tearDown(self):
        self.directory.cleanup()

    def wav(self):
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(44100)
            audio.writeframes(b"\x10\x00" * 44100)
        return output.getvalue()

    def upload(self, data=None):
        return self.client.post(
            "/api/admin/assets/bowl?title=Bowl",
            content=self.wav() if data is None else data,
            headers={**self.auth, "Content-Type": "audio/wav"},
        )

    def pack(self, asset):
        return dict(
            title="Bowl",
            tradition="Original synthesis",
            description="Modal study",
            creator="Core-aura",
            license="Project-owned",
            version="1.0.0",
            minimum_engine="2.0",
            attribution="Core-aura",
            provenance="Original coefficients",
            assets=[asset],
        )

    def test_review_and_revision_guard(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        self.assertEqual(self.client.get("/api/admin/packs").status_code, 401)
        uploaded = self.upload()
        self.assertEqual(uploaded.status_code, 201)
        asset = uploaded.json()
        self.assertEqual(self.client.get(asset["url"]).status_code, 404)
        self.assertEqual(
            self.client.get("/api/admin/assets/" + asset["sha256"]).status_code, 401
        )
        self.assertEqual(
            self.client.get(
                "/api/admin/assets/" + asset["sha256"], headers=self.auth
            ).status_code,
            200,
        )
        data = self.pack(asset)
        self.assertEqual(
            self.client.post(
                "/api/admin/packs/bowl", json=data, headers=self.auth
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client.post(
                "/api/admin/packs/bowl", json=data, headers=self.auth
            ).status_code,
            409,
        )
        review = dict(
            status="published",
            reviewer="Reviewer",
            notes="Checked",
            expected_revision=1,
        )
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/bowl/review", json=review, headers=self.auth
            ).status_code,
            409,
        )
        review["status"] = "reviewed"
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/bowl/review", json=review, headers=self.auth
            ).status_code,
            200,
        )
        review["status"] = "published"
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/bowl/review", json=review, headers=self.auth
            ).status_code,
            409,
        )
        review["expected_revision"] = 2
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/bowl/review", json=review, headers=self.auth
            ).status_code,
            200,
        )
        self.assertEqual(len(self.client.get("/api/catalog").json()["packs"]), 1)
        published = self.client.get(asset["url"])
        self.assertEqual(published.status_code, 200)
        self.assertEqual(hashlib.sha256(published.content).hexdigest(), asset["sha256"])
        events = self.client.get(
            "/api/admin/packs/bowl/events", headers=self.auth
        ).json()["events"]
        self.assertEqual(
            [e["action"] for e in events], ["published", "reviewed", "created"]
        )
        self.assertEqual(events[0]["details"]["from_status"], "reviewed")
        self.assertNotIn("test-admin", json.dumps(events))
        replacement = {**data, "version": "1.1.0", "expected_revision": 3}
        self.assertEqual(
            self.client.put(
                "/api/admin/packs/bowl", json=replacement, headers=self.auth
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/catalog").json()["packs"], [])
        self.assertEqual(
            self.client.get("/api/admin/packs", headers=self.auth).json()["packs"][0][
                "status"
            ],
            "draft",
        )
        replacement["version"] = "1.2.0"
        self.assertEqual(
            self.client.put(
                "/api/admin/packs/bowl", json=replacement, headers=self.auth
            ).status_code,
            409,
        )

    def test_unsafe_asset_manifests(self):
        data = dict(
            title="Bowl",
            tradition="Original synthesis",
            description="Modal study",
            creator="Core-aura",
            license="CC0-1.0",
            version="1.0.0",
            minimum_engine="2.0",
            attribution="Core-aura",
            provenance="Original coefficients",
        )
        for url in [
            "https://example.com/file.wav",
            "/packs/bowl/../file.wav",
            "/packs/a/%2e%2e/file.wav",
        ]:
            payload = {
                **data,
                "assets": [
                    dict(
                        id="bowl",
                        title="Bowl",
                        url=url,
                        sha256="a" * 64,
                        bytes=88244,
                        seconds=1,
                    )
                ],
            }
            self.assertEqual(
                self.client.post(
                    "/api/admin/packs/unsafe", json=payload, headers=self.auth
                ).status_code,
                422,
            )
        self.assertEqual(
            self.client.post(
                "/api/admin/packs/no-files", json=data, headers=self.auth
            ).status_code,
            201,
        )
        review = dict(
            status="reviewed", reviewer="Reviewer", notes="Checked", expected_revision=1
        )
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/no-files/review", json=review, headers=self.auth
            ).status_code,
            409,
        )
        review.update(status="published", expected_revision=2)
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/no-files/review", json=review, headers=self.auth
            ).status_code,
            409,
        )

    def test_upload_normalization_deduplication_and_persistence(self):
        canonical = self.wav()
        extra = (
            canonical[:12] + b"JUNK" + struct.pack("<I", 4) + b"meta" + canonical[12:]
        )
        extra = extra[:4] + struct.pack("<I", len(extra) - 8) + extra[8:]
        first = self.upload(extra)
        self.assertEqual(first.status_code, 201)
        asset = first.json()
        self.assertEqual(asset["sha256"], hashlib.sha256(canonical).hexdigest())
        self.assertEqual(self.upload().json()["sha256"], asset["sha256"])
        self.assertEqual(len(list(Path(self.directory.name).glob("*.wav"))), 1)
        restarted = TestClient(app)
        preview = restarted.get(
            "/api/admin/assets/" + asset["sha256"], headers=self.auth
        )
        self.assertEqual(preview.content, canonical)
        self.assertEqual(
            len(restarted.get("/api/admin/assets", headers=self.auth).json()["assets"]),
            1,
        )
        self.assertEqual(list((Path(self.directory.name) / ".incoming").iterdir()), [])

    def test_rejects_bad_uploads_and_enforces_actual_stream_limit(self):
        self.assertEqual(
            self.client.post(
                "/api/admin/assets/bowl?title=Bowl", content=self.wav()
            ).status_code,
            401,
        )
        self.assertEqual(self.upload(b"not a wave").status_code, 422)
        self.assertEqual(self.upload(self.wav()[:-100]).status_code, 422)
        with patch("app.main.MAX_FILE", 8):
            response = self.client.post(
                "/api/admin/assets/bowl?title=Bowl",
                content=iter([b"1234", b"56789"]),
                headers=self.auth,
            )
            self.assertEqual(response.status_code, 413)
        self.assertEqual(list(Path(self.directory.name).glob("*.wav")), [])
        self.assertEqual(list((Path(self.directory.name) / ".incoming").iterdir()), [])

    def test_storage_quota_and_corrupt_content_block_review(self):
        os.environ["CORE_AURA_CONTENT_LIMIT_BYTES"] = "1"
        self.assertEqual(self.upload().status_code, 507)
        os.environ["CORE_AURA_CONTENT_LIMIT_BYTES"] = str(2 * 1024**3)
        asset = self.upload().json()
        data = self.pack(asset)
        self.assertEqual(
            self.client.post(
                "/api/admin/packs/bowl", json=data, headers=self.auth
            ).status_code,
            201,
        )
        Path(self.directory.name, asset["sha256"] + ".wav").write_bytes(b"corrupt")
        review = dict(
            status="reviewed", reviewer="Reviewer", notes="Checked", expected_revision=1
        )
        self.assertEqual(
            self.client.patch(
                "/api/admin/packs/bowl/review", json=review, headers=self.auth
            ).status_code,
            409,
        )
        self.assertEqual(self.client.get("/api/catalog").json()["packs"], [])

    def test_content_backup_is_verifiable(self):
        self.assertEqual(self.upload().status_code, 201)
        backend = Path(__file__).resolve().parent
        archive = Path(self.directory.name) / "backup.tar.gz"
        with archive.open("wb") as output:
            subprocess.run(
                [sys.executable, str(backend / "scripts/archive-content.py")],
                stdout=output,
                check=True,
            )
        subprocess.run(
            [
                sys.executable,
                str(backend.parent / "ops/verify-content-backup.py"),
                str(archive),
            ],
            check=True,
            capture_output=True,
        )


if __name__ == "__main__":
    unittest.main()
