"""Durable at-least-once push delivery; one worker, with atomic retry leases."""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import requests
from pywebpush import webpush, WebPushException
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from .database import SessionLocal
from .models import ReminderDevice, ReminderDelivery, ReminderWorker

log = logging.getLogger(__name__)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def due(device, now):
    local = datetime.fromtimestamp(now, timezone.utc).astimezone(
        ZoneInfo(device.timezone)
    )
    for offset in (0, 1):
        date = (local - timedelta(days=offset)).date()
        for row in device.schedules:
            if row.get("oneOff"):
                if offset == 0:
                    stamp = datetime.fromisoformat(row["oneOff"].replace("Z", "+00:00")).timestamp()
                    if 0 <= now-stamp < 900:
                        yield digest([device.token_hash,row["id"],row["oneOff"]]), {**row,"timezone":device.timezone}, stamp+900
                continue
            frequency = row.get("frequency")
            if date.isoformat() in row.get("skipDates", []):
                continue
            if frequency == "monthly":
                if date.day != row.get("monthDay"):
                    continue
            elif frequency != "daily" and (date.weekday() + 1) % 7 not in row["days"]:
                continue
            for clock in row.get("times") or [row["time"]]:
                if date.isoformat() + "T" + clock in (row.get("skipOccurrences") or []):
                    continue
                hour, minute = map(int, clock.split(":"))
                when = datetime(date.year, date.month, date.day, hour, minute,
                                tzinfo=local.tzinfo, fold=0)
                stamp = when.timestamp()
                # Skip nonexistent DST wall times and use the first occurrence of a repeated hour.
                if datetime.fromtimestamp(stamp, local.tzinfo).replace(tzinfo=None) != when.replace(tzinfo=None):
                    continue
                if 0 <= now - stamp < 900:
                    yield digest([device.token_hash, row["id"], date.isoformat(), clock]), {
                        **row, "timezone": device.timezone
                    }, stamp + 900



class NoRedirects(requests.Session):
    def request(self, method, url, **kwargs):
        kwargs["allow_redirects"] = False
        return super().request(method, url, **kwargs)


def send(device, job, now):
    with NoRedirects() as session:
        webpush(
            subscription_info=device.subscription,
            data=json.dumps(
                {
                    "title": "Manifestation practice",
                    "body": job.schedule["name"],
                    "planId": job.schedule["planId"],
                    "tag": job.id,
                }
            ),
            vapid_private_key=os.environ["CORE_AURA_VAPID_PRIVATE_KEY"],
            vapid_claims={
                "sub": os.getenv(
                    "CORE_AURA_VAPID_SUBJECT", "https://core-aura.coreeye.in"
                )
            },
            ttl=max(1, int(job.expires - now)),
            timeout=5,
            headers={"Topic": job.id[:32]},
            requests_session=session,
        )


def tick(now=None, sender=send):
    now = time.time() if now is None else now
    with SessionLocal() as db:
        db.merge(ReminderWorker(id=1, heartbeat=now))
        db.execute(
            delete(ReminderDelivery).where(ReminderDelivery.expires < now - 7 * 86400)
        )
        stale = db.scalars(
            select(ReminderDevice).where(
                ReminderDevice.active == 0, ReminderDevice.updated < now - 30 * 86400
            )
        ).all()
        for d in stale:
            db.execute(
                delete(ReminderDelivery).where(ReminderDelivery.device == d.token_hash)
            )
            db.delete(d)
        db.commit()
        devices = db.scalars(
            select(ReminderDevice).where(ReminderDevice.active == 1)
        ).all()
        for d in devices:
            for key, row, expires in due(d, now):
                if db.get(ReminderDelivery, key):
                    continue
                db.add(
                    ReminderDelivery(
                        id=key,
                        device=d.token_hash,
                        schedule=row,
                        status="pending",
                        attempts=0,
                        next_attempt=now,
                        expires=expires,
                    )
                )
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
        ids = list(
            db.scalars(
                select(ReminderDelivery.id)
                .where(
                    ReminderDelivery.status.in_(["pending", "sending"]),
                    ReminderDelivery.next_attempt <= now,
                    ReminderDelivery.expires > now,
                )
                .order_by(ReminderDelivery.next_attempt)
                .limit(20)
            )
        )
    for key in ids:
        with SessionLocal() as db:
            claimed = db.execute(
                update(ReminderDelivery)
                .where(
                    ReminderDelivery.id == key,
                    ReminderDelivery.status.in_(["pending", "sending"]),
                    ReminderDelivery.next_attempt <= now,
                )
                .values(
                    status="sending",
                    next_attempt=now + 120,
                    attempts=ReminderDelivery.attempts + 1,
                )
            )
            db.commit()
            if claimed.rowcount != 1:
                continue
            job = db.get(ReminderDelivery, key)
            device = db.get(ReminderDevice, job.device)
            current = bool(
                device
                and device.active
                and any(
                    {**r, "timezone": device.timezone} == job.schedule
                    for r in device.schedules
                )
            )
            if not current:
                job.status = "cancelled"
                db.commit()
                continue
            try:
                sender(device, job, now)
                job.status = "sent"
                device.error = ""
            except Exception as error:
                response = getattr(error, "response", None)
                status = getattr(response, "status_code", 0)
                if status in (404, 410):
                    device.active = 0
                    device.updated = now
                    device.error = "Subscription expired"
                    job.status = "failed"
                elif status and status not in (408, 429) and status < 500:
                    job.status = "failed"
                    device.error = "Push service rejected delivery"
                else:
                    job.status = "pending"
                    job.next_attempt = now + min(300, 15 * 2 ** min(job.attempts, 4))
                    device.error = "Delivery pending retry"
                log.warning("Reminder delivery deferred or rejected (HTTP %s)", status)
            db.commit()
    return len(ids)


def main():
    logging.basicConfig(level=logging.INFO)
    if not os.getenv("CORE_AURA_VAPID_PRIVATE_KEY"):
        raise SystemExit("Persistent VAPID keys are required")
    while True:
        try:
            batch = tick()
        except Exception:
            log.error("Reminder worker database unavailable")
            batch = 0
        time.sleep(0.1 if batch == 20 else 10)


if __name__ == "__main__":
    main()
