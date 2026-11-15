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
            attribution="Core-aura", provenance="Original coefficients")
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

if __name__ == "__main__":
    unittest.main()
