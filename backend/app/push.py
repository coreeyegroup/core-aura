"""Opt-in, device-scoped reminder registration. Sentence text never enters this API."""

import base64
import hashlib
import json
import os
import re
import time
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from .database import SessionLocal
from .models import ReminderDevice, ReminderDelivery, ReminderWorker

router = APIRouter(prefix="/api/manifest-reminders")


def decode(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


class Subscription(BaseModel):
    model_config = ConfigDict(extra="forbid")
    endpoint: str = Field(max_length=2000)
    keys: dict[str, str]

    @field_validator("endpoint")
    @classmethod
    def endpoint_allowed(cls, value):
        u = urlsplit(value)
        host = u.hostname or ""
        allowed = host in {
            "fcm.googleapis.com",
            "updates.push.services.mozilla.com",
            "web.push.apple.com",
        } or host.endswith(".notify.windows.com")
        if (
            not allowed
            or u.scheme != "https"
            or u.port not in (None, 443)
            or u.username
            or u.password
            or u.fragment
            or not u.path
            or u.path == "/"
        ):
            raise ValueError("Unsupported push service")
        return value

    @field_validator("keys")
    @classmethod
    def valid_keys(cls, value):
        if set(value) != {"p256dh", "auth"} or any(
            not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", v) for v in value.values()
        ):
            raise ValueError("Invalid subscription keys")
        public, auth = decode(value["p256dh"]), decode(value["auth"])
        if len(auth) != 16 or len(public) != 65:
            raise ValueError("Invalid subscription keys")
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public)
        return value


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-zA-Z0-9-]{1,100}$")
    planId: str = Field(pattern=r"^[a-zA-Z0-9-]{1,100}$")
    name: str = Field(min_length=1, max_length=80)
    time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    days: list[int] = Field(min_length=1, max_length=7)
    oneOff: str | None = Field(default=None, max_length=60)
    skipDates: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("oneOff")
    @classmethod
    def valid_one_off(cls, value):
        if value is not None:
            from datetime import datetime
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("Use an absolute timestamp")
        return value

    @field_validator("skipDates")
    @classmethod
    def valid_skip_dates(cls, value):
        from datetime import date
        for item in value:
            if date.fromisoformat(item).isoformat() != item:
                raise ValueError("Invalid skipped date")
        return value

    @field_validator("days")
    @classmethod
    def valid_days(cls, value):
        if len(set(value)) != len(value) or any(d < 0 or d > 6 for d in value):
            raise ValueError("Invalid weekdays")
        return value


class Registration(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subscription: Subscription
    schedules: list[Schedule] = Field(max_length=8)
    timezone: str = Field(max_length=100)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError):
            raise ValueError("Choose a valid device timezone")
        return value


def configured():
    return bool(os.getenv("CORE_AURA_VAPID_PUBLIC_KEY"))


def ready():
    with SessionLocal() as db:
        worker = db.get(ReminderWorker, 1)
        return bool(configured() and worker and time.time() - worker.heartbeat < 90)


def device_key(request, token):
    origin = os.getenv(
        "CORE_AURA_PUBLIC_ORIGIN", "https://core-aura.coreeye.in"
    ).rstrip("/")
    if request.headers.get("origin") != origin:
        raise HTTPException(403, "Use the Core-aura app to manage reminders")
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        raise HTTPException(401, "A device reminder token is required")
    return hashlib.sha256(token.encode()).hexdigest()


@router.get("/config")
def config():
    return {
        "configured": configured(),
        "ready": ready(),
        "publicKey": os.getenv("CORE_AURA_VAPID_PUBLIC_KEY", ""),
    }


@router.put("/device")
def register(
    data: Registration, request: Request, x_reminder_token: str = Header(default="")
):
    key = device_key(request, x_reminder_token)
    if not ready():
        raise HTTPException(503, "Reminder worker is unavailable. Try again later.")
    if len({s.id for s in data.schedules}) != len(data.schedules):
        raise HTTPException(422, "Duplicate schedules")
    schedules = [s.model_dump() for s in data.schedules]
    with SessionLocal() as db:
        device = db.get(ReminderDevice, key)
        endpoint = data.subscription.endpoint
        # A subscription belongs to one device token. No cross-device overwrite.
        others = db.scalars(
            select(ReminderDevice).where(ReminderDevice.token_hash != key)
        ).all()
        if any(d.subscription.get("endpoint") == endpoint for d in others):
            raise HTTPException(
                409,
                "This browser already has a reminder registration. Disable it before resetting browser settings.",
            )
        if not device:
            if len(others) >= int(os.getenv("CORE_AURA_REMINDER_DEVICES", "1000")):
                raise HTTPException(503, "Reminder capacity reached")
            device = ReminderDevice(token_hash=key)
            db.add(device)
        device.subscription = data.subscription.model_dump()
        device.schedules = schedules
        device.timezone = data.timezone
        device.active = 1
        device.error = ""
        device.updated = time.time()
        db.commit()
    return {"status": "enabled", "schedules": len(schedules)}


@router.delete("/device")
def unregister(request: Request, x_reminder_token: str = Header(default="")):
    key = device_key(request, x_reminder_token)
    with SessionLocal() as db:
        db.execute(delete(ReminderDelivery).where(ReminderDelivery.device == key))
        db.execute(delete(ReminderDevice).where(ReminderDevice.token_hash == key))
        db.commit()
    return {"status": "disabled"}
