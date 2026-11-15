from sqlalchemy import Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Pack(Base):
    __tablename__ = "content_packs"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    metadata_json: Mapped[dict] = mapped_column(JSON)


from datetime import datetime, timezone
import uuid
from sqlalchemy import DateTime, Float, ForeignKey


class StoredAsset(Base):
    __tablename__ = "stored_assets"
    sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    asset_id: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(120))
    bytes: Mapped[int] = mapped_column(Integer)
    seconds: Mapped[float] = mapped_column(Float)
    created_by: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PackEvent(Base):
    __tablename__ = "pack_events"
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    pack_id: Mapped[str] = mapped_column(ForeignKey("content_packs.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(20))
    actor: Mapped[str] = mapped_column(String(200))
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ReminderDevice(Base):
    __tablename__ = "reminder_devices"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    subscription: Mapped[dict] = mapped_column(JSON)
    schedules: Mapped[list] = mapped_column(JSON)
    timezone: Mapped[str] = mapped_column(String(100))
    active: Mapped[int] = mapped_column(Integer, default=1)
    updated: Mapped[float] = mapped_column(Float)
    error: Mapped[str] = mapped_column(String(80), default="")


class ReminderDelivery(Base):
    __tablename__ = "reminder_deliveries"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    device: Mapped[str] = mapped_column(String(64), index=True)
    schedule: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt: Mapped[float] = mapped_column(Float)
    expires: Mapped[float] = mapped_column(Float)


class ReminderWorker(Base):
    __tablename__ = "reminder_worker"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    heartbeat: Mapped[float] = mapped_column(Float)
