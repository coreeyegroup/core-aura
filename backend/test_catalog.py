import os
import tempfile
import unittest
os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mktemp(suffix=".db"))
os.environ["CORE_AURA_ADMIN_TOKEN"] = "test-admin"
from fastapi.testclient import TestClient
from app.database import Base, engine
from app.models import Pack
from app.main import app

class CatalogTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(Pack.__table__.delete())
        self.client = TestClient(app)
        self.auth = {"Authorization": "Bearer test-admin"}

    def test_review_and_revision_guard(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        self.assertEqual(self.client.get("/api/admin/packs").status_code, 401)
        data = dict(title="Bowl", tradition="Original synthesis", description="Modal study",
            creator="Core-aura", license="Project-owned", version="1.0.0", minimum_engine="2.0",
            attribution="Core-aura", provenance="Original coefficients", assets=[dict(id="bowl", title="Bowl", url="/packs/bowl/1.0.0/bowl.wav", sha256="a"*64, bytes=88244, seconds=1)])
        self.assertEqual(self.client.post("/api/admin/packs/bowl", json=data, headers=self.auth).status_code, 201)
        self.assertEqual(self.client.post("/api/admin/packs/bowl", json=data, headers=self.auth).status_code, 409)
        review = dict(status="published", reviewer="Reviewer", notes="Checked", expected_revision=1)
        self.assertEqual(self.client.patch("/api/admin/packs/bowl/review", json=review, headers=self.auth).status_code, 409)
        review["status"] = "reviewed"
        self.assertEqual(self.client.patch("/api/admin/packs/bowl/review", json=review, headers=self.auth).status_code, 200)
        review["status"] = "published"
        self.assertEqual(self.client.patch("/api/admin/packs/bowl/review", json=review, headers=self.auth).status_code, 409)
        review["expected_revision"] = 2
        self.assertEqual(self.client.patch("/api/admin/packs/bowl/review", json=review, headers=self.auth).status_code, 200)
        self.assertEqual(len(self.client.get("/api/catalog").json()["packs"]), 1)
        replacement = {**data, "version": "1.1.0", "expected_revision": 3}
        self.assertEqual(self.client.put("/api/admin/packs/bowl", json=replacement, headers=self.auth).status_code, 200)
        self.assertEqual(self.client.get("/api/catalog").json()["packs"], [])
        self.assertEqual(self.client.get("/api/admin/packs", headers=self.auth).json()["packs"][0]["status"], "draft")
        replacement["version"] = "1.2.0"
        self.assertEqual(self.client.put("/api/admin/packs/bowl", json=replacement, headers=self.auth).status_code, 409)

    def test_unsafe_asset_manifests(self):
        data = dict(title="Bowl", tradition="Original synthesis", description="Modal study", creator="Core-aura", license="CC0-1.0", version="1.0.0", minimum_engine="2.0", attribution="Core-aura", provenance="Original coefficients")
        for url in ["https://example.com/file.wav", "/packs/bowl/../file.wav", "/packs/a/%2e%2e/file.wav"]:
            payload = {**data, "assets": [dict(id="bowl", title="Bowl", url=url, sha256="a"*64, bytes=88244, seconds=1)]}
            self.assertEqual(self.client.post("/api/admin/packs/unsafe", json=payload, headers=self.auth).status_code, 422)
        self.assertEqual(self.client.post("/api/admin/packs/no-files", json=data, headers=self.auth).status_code, 201)
        review = dict(status="reviewed", reviewer="Reviewer", notes="Checked", expected_revision=1)
        self.assertEqual(self.client.patch("/api/admin/packs/no-files/review", json=review, headers=self.auth).status_code, 200)
        review.update(status="published", expected_revision=2)
        self.assertEqual(self.client.patch("/api/admin/packs/no-files/review", json=review, headers=self.auth).status_code, 409)


if __name__ == "__main__":
    unittest.main()
