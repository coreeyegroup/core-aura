import base64
import json
import os
import tempfile
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///" + tempfile.mktemp(suffix=".db"))
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from app.database import Base, engine, SessionLocal
from app.main import app
from app.models import ReminderDevice, ReminderDelivery, ReminderWorker
from app.reminder_worker import tick, due, send, NoRedirects
from app.push import Schedule, device_key
from requests import Response
from pywebpush import WebPushException


def enc(v):
    return base64.urlsafe_b64encode(v).decode().rstrip("=")


class ReminderTests(unittest.TestCase):
    def test_monthly_schedule_multiple_times_and_single_skip(self):
        from types import SimpleNamespace
        from pydantic import ValidationError
        row = dict(id="monthly", planId="p", name="Practice", time="07:00", days=[1],
                   frequency="monthly", monthDay=31, times=["07:00", "07:10"],
                   skipOccurrences=["2027-03-31T07:00"])
        parsed = Schedule.model_validate(row).model_dump()
        device = SimpleNamespace(timezone="Asia/Kolkata", token_hash="x", schedules=[parsed])
        close = datetime(2027, 3, 31, 1, 41, tzinfo=timezone.utc).timestamp()
        self.assertEqual(len(list(due(device, close))), 1)
        self.assertEqual(list(due(device, datetime(2027, 2, 28, 1, 41, tzinfo=timezone.utc).timestamp())), [])
        device.schedules[0]["skipOccurrences"] = []
        self.assertEqual(len({key for key, _, _ in due(device, close)}), 2)
        with self.assertRaises(ValidationError):
            Schedule.model_validate({**row, "times": ["07:00", "07:00"]})

    def setUp(self):
        Base.metadata.create_all(engine)
        with engine.begin() as db:
            for cls in [ReminderDelivery, ReminderDevice, ReminderWorker]:
                db.execute(cls.__table__.delete())
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.public = enc(
            self.key.public_key().public_bytes(
                serialization.Encoding.X962,
                serialization.PublicFormat.UncompressedPoint,
            )
        )
        self.env = patch.dict(
            os.environ,
            {
                "CORE_AURA_VAPID_PUBLIC_KEY": self.public,
                "CORE_AURA_VAPID_PRIVATE_KEY": enc(
                    self.key.private_bytes(
                        serialization.Encoding.DER,
                        serialization.PrivateFormat.PKCS8,
                        serialization.NoEncryption(),
                    )
                ),
                "CORE_AURA_PUBLIC_ORIGIN": "https://core-aura.coreeye.in",
            },
        )
        self.env.start()
        with SessionLocal() as db:
            db.add(ReminderWorker(id=1, heartbeat=time.time()))
            db.commit()
        self.client = TestClient(app)
        self.headers = {
            "Origin": "https://core-aura.coreeye.in",
            "X-Reminder-Token": "a" * 64,
        }
        self.row = {
            "id": "routine",
            "planId": "practice",
            "name": "Morning practice",
            "time": "07:00",
            "days": [0, 1, 2, 3, 4, 5, 6],
        }
        self.data = {
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/test-token",
                "keys": {"p256dh": self.public, "auth": enc(b"a" * 16)},
            },
            "timezone": "Asia/Kolkata",
            "schedules": [self.row],
        }

    def tearDown(self):
        self.env.stop()

    def register(self):
        response = self.client.put(
            "/api/manifest-reminders/device", json=self.data, headers=self.headers
        )
        self.assertEqual(response.status_code, 200, response.text)
        with SessionLocal() as db:
            return db.query(ReminderDevice).one().token_hash

    def test_scope_validation_and_no_sentence_upload(self):
        self.assertEqual(
            self.client.put(
                "/api/manifest-reminders/device", json=self.data
            ).status_code,
            403,
        )
        for endpoint in [
            "http://127.0.0.1/private",
            "https://fcm.googleapis.com.evil.test/a",
            "https://fcm.googleapis.com@127.0.0.1/a",
            "https://fcm.googleapis.com:8443/a",
        ]:
            bad = {
                **self.data,
                "subscription": {**self.data["subscription"], "endpoint": endpoint},
            }
            self.assertEqual(
                self.client.put(
                    "/api/manifest-reminders/device", json=bad, headers=self.headers
                ).status_code,
                422,
            )
        bad = {**self.data, "sentences": ["secret"]}
        self.assertEqual(
            self.client.put(
                "/api/manifest-reminders/device", json=bad, headers=self.headers
            ).status_code,
            422,
        )
        key = self.register()
        self.assertNotEqual(key, self.headers["X-Reminder-Token"])
        self.client.delete(
            "/api/manifest-reminders/device",
            headers={**self.headers, "X-Reminder-Token": "b" * 64},
        )
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(ReminderDevice, key))
        self.assertEqual(
            self.client.delete(
                "/api/manifest-reminders/device", headers=self.headers
            ).status_code,
            200,
        )
        with SessionLocal() as db:
            self.assertIsNone(db.get(ReminderDevice, key))

    def test_worker_health_gates_registration(self):
        with SessionLocal() as db:
            db.get(ReminderWorker, 1).heartbeat = 0
            db.commit()
        self.assertFalse(
            self.client.get("/api/manifest-reminders/config").json()["ready"]
        )
        self.assertEqual(
            self.client.put(
                "/api/manifest-reminders/device", json=self.data, headers=self.headers
            ).status_code,
            503,
        )

    def test_due_once_retry_and_changed_schedule_cancel(self):
        self.register()
        now = datetime(2026, 11, 16, 1, 30, tzinfo=timezone.utc).timestamp()
        sent = []

        def fail(*args):
            raise OSError("network")

        tick(now, fail)
        tick(now + 10, lambda d, j, n: sent.append(j.id))
        self.assertEqual(sent, [])
        tick(now + 31, lambda d, j, n: sent.append(j.id))
        tick(now + 50, lambda d, j, n: sent.append(j.id))
        self.assertEqual(len(sent), 1)
        # A later day's queued retry is cancelled if the saved time changes.
        tick(now + 86400, fail)
        with SessionLocal() as db:
            d = db.query(ReminderDevice).one()
            d.schedules = [{**self.row, "time": "08:00"}]
            db.commit()
        tick(now + 86431, lambda *a: self.fail("changed reminder sent"))
        with SessionLocal() as db:
            self.assertEqual(
                db.query(ReminderDelivery).filter_by(status="cancelled").count(), 1
            )

    def test_expired_subscription_and_missed_occurrences(self):
        self.register()
        now = datetime(2026, 11, 16, 1, 30, tzinfo=timezone.utc).timestamp()
        response = Response()
        response.status_code = 410

        def expired(*a):
            raise WebPushException("Gone", response=response)

        tick(now, expired)
        with SessionLocal() as db:
            self.assertEqual(db.query(ReminderDevice).one().active, 0)
        tick(now + 86400, lambda *a: self.fail("expired device sent"))
        with SessionLocal() as db:
            d = db.query(ReminderDevice).one()
            self.assertEqual(list(due(d, now + 901)), [])

    def test_dst_missing_and_repeated_hours(self):
        d = ReminderDevice(
            token_hash="x",
            timezone="America/New_York",
            schedules=[{**self.row, "time": "02:30"}],
        )
        now = datetime(2026, 3, 8, 7, 31, tzinfo=timezone.utc).timestamp()
        self.assertEqual(list(due(d, now)), [])
        d.schedules = [{**self.row, "time": "01:30"}]
        first = datetime(2026, 11, 1, 5, 30, tzinfo=timezone.utc).timestamp()
        self.assertEqual(len(list(due(d, first))), 1)
        self.assertEqual(list(due(d, first + 3600)), [])

    def test_real_encryption_signing_without_external_delivery(self):
        key = self.register()
        now = datetime(2026, 11, 16, 1, 30, tzinfo=timezone.utc).timestamp()
        captured = []

        def post(session, method, url, **kwargs):
            captured.append((url, kwargs))
            r = Response()
            r.status_code = 201
            return r

        with patch("requests.Session.request", post):
            tick(now)
        self.assertEqual(len(captured), 1)
        url, kwargs = captured[0]
        self.assertFalse(kwargs["allow_redirects"])
        self.assertIn("Authorization", kwargs["headers"])
        self.assertNotIn(b"Morning practice", kwargs["data"])
        self.assertEqual(kwargs["timeout"], 5)
        with SessionLocal() as db:
            self.assertEqual(db.query(ReminderDelivery).one().status, "sent")


if __name__ == "__main__":
    unittest.main()
