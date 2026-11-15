import hmac
import os
from typing import Literal
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Query
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
import tempfile
from pathlib import Path
import asyncio
from datetime import timezone
from urllib.parse import unquote
from pydantic import BaseModel, Field, field_validator, model_validator
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text, update
from .database import SessionLocal
from .models import Pack, PackEvent, StoredAsset
from .content import (
    root,
    file_path,
    asset_record,
    finalize_upload,
    verify_assets,
    MAX_FILE,
)

app = FastAPI(
    title="Core-aura catalog", version="0.13.0", docs_url=None, redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["capacitor://localhost", "http://localhost", "https://localhost"],
    allow_methods=["GET"],
)


class AssetInput(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,79}$")
    title: str = Field(min_length=1, max_length=120)
    url: str = Field(
        pattern=r"^/packs/[a-zA-Z0-9/_.-]+/[a-zA-Z0-9_.-]+\.wav$", max_length=300
    )
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    bytes: int = Field(ge=46, le=25 * 1024 * 1024)
    seconds: float = Field(gt=0, le=600)

    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        if ".." in value:
            raise ValueError("Parent paths are not allowed")
        return value


class PackInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    tradition: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    creator: str = Field(min_length=1, max_length=200)
    license: str = Field(min_length=1, max_length=300)
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    minimum_engine: str = Field(pattern=r"^\d+\.\d+$")
    attribution: str = Field(min_length=1, max_length=1000)
    provenance: str = Field(min_length=1, max_length=1000)
    assets: list[AssetInput] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def bounded_files(self):
        if (
            len({a.id for a in self.assets}) != len(self.assets)
            or sum(a.bytes for a in self.assets) > 25 * 1024 * 1024
        ):
            raise ValueError("Duplicate files or pack larger than 25 MB")
        return self


class PackUpdate(PackInput):
    expected_revision: int = Field(ge=1)


class ReviewInput(BaseModel):
    status: Literal["reviewed", "published", "withdrawn"]
    reviewer: str = Field(min_length=1, max_length=200)
    notes: str = Field(min_length=1, max_length=1000)
    expected_revision: int = Field(ge=1)


def admin(authorization: str = Header(default="")):
    expected = os.environ.get("CORE_AURA_ADMIN_TOKEN", "")
    if not expected or not hmac.compare_digest(
        authorization.encode("utf-8"), ("Bearer " + expected).encode("utf-8")
    ):
        raise HTTPException(401, "Administrative access required")


def operator(
    x_core_aura_operator: str = Header(
        default="Administrator", min_length=1, max_length=2000
    )
):
    try:
        value = unquote(x_core_aura_operator, encoding="utf-8", errors="strict").strip()
    except UnicodeError:
        raise HTTPException(422, "Enter a valid operator name")
    if len(value) > 200:
        raise HTTPException(422, "Operator name is too long")
    return value or "Administrator"


def event(db, pack_id, revision, action, actor, details):
    db.add(
        PackEvent(
            pack_id=pack_id,
            revision=revision,
            action=action,
            actor=actor,
            details=details,
        )
    )


def record(pack):
    return {
        "id": pack.id,
        "revision": pack.revision,
        "status": pack.status,
        **pack.metadata_json,
    }


@app.get("/api/health")
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(503, "Database unavailable")
    return {"status": "ok", "version": "0.13.0"}


@app.get("/api/catalog")
def catalog():
    with SessionLocal() as db:
        rows = db.scalars(
            select(Pack).where(Pack.status == "published").order_by(Pack.id).limit(200)
        ).all()
        return {"packs": [record(p) for p in rows]}


@app.get("/api/admin/packs", dependencies=[Depends(admin)])
def drafts():
    with SessionLocal() as db:
        return {"packs": [record(p) for p in db.scalars(select(Pack)).all()]}


@app.post("/api/admin/packs/{pack_id}", dependencies=[Depends(admin)], status_code=201)
def create(pack_id: str, data: PackInput, actor: str = Depends(operator)):
    import re
    from sqlalchemy.exc import IntegrityError

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", pack_id):
        raise HTTPException(422, "Use a lowercase pack identifier")
    with SessionLocal() as db:
        pack = Pack(
            id=pack_id, revision=1, status="draft", metadata_json=data.model_dump()
        )
        db.add(pack)
        try:
            db.flush()
            event(db, pack.id, 1, "created", actor, {"manifest": data.model_dump()})
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Pack already exists")
        return record(pack)


@app.put("/api/admin/packs/{pack_id}", dependencies=[Depends(admin)])
def replace(pack_id: str, data: PackUpdate, actor: str = Depends(operator)):
    with SessionLocal() as db:
        pack = db.get(Pack, pack_id)
        if not pack:
            raise HTTPException(404, "Pack unavailable")
        if tuple(map(int, data.version.split("."))) <= tuple(
            map(int, pack.metadata_json["version"].split("."))
        ):
            raise HTTPException(
                409, "Increase the pack version before replacing its manifest"
            )
        result = db.execute(
            update(Pack)
            .where(Pack.id == pack_id, Pack.revision == data.expected_revision)
            .values(
                revision=Pack.revision + 1,
                status="draft",
                metadata_json=data.model_dump(exclude={"expected_revision"}),
            )
        )
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(
                409, "Pack changed. Reload it before replacing the manifest"
            )
        event(
            db,
            pack.id,
            data.expected_revision + 1,
            "replaced",
            actor,
            {"manifest": data.model_dump(exclude={"expected_revision"})},
        )
        db.commit()
        return record(db.get(Pack, pack_id))


@app.patch("/api/admin/packs/{pack_id}/review", dependencies=[Depends(admin)])
def review(pack_id: str, data: ReviewInput, actor: str = Depends(operator)):
    allowed = {
        "draft": {"reviewed"},
        "reviewed": {"published", "withdrawn"},
        "published": {"withdrawn"},
        "withdrawn": {"reviewed"},
    }
    with SessionLocal() as db:
        pack = db.get(Pack, pack_id)
        if not pack:
            raise HTTPException(404, "Pack unavailable")
        if data.status in {"reviewed", "published"}:
            verify_assets(db, pack.metadata_json.get("assets", []))
        if data.status not in allowed[pack.status]:
            raise HTTPException(409, "Review the pack before publishing")
        previous_status = pack.status
        metadata = {
            **pack.metadata_json,
            "review": {"reviewer": data.reviewer, "notes": data.notes},
        }
        result = db.execute(
            update(Pack)
            .where(
                Pack.id == pack_id,
                Pack.revision == data.expected_revision,
                Pack.status == pack.status,
            )
            .values(
                status=data.status, revision=Pack.revision + 1, metadata_json=metadata
            )
        )
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(
                409, "Pack changed. Reload it before applying this review"
            )
        event(
            db,
            pack.id,
            data.expected_revision + 1,
            data.status,
            actor,
            {
                "from_status": previous_status,
                "reviewer": data.reviewer,
                "notes": data.notes,
                "version": pack.metadata_json["version"],
            },
        )
        db.commit()
        return record(db.get(Pack, pack_id))


uploads = asyncio.Semaphore(2)


@app.post(
    "/api/admin/assets/{asset_id}", dependencies=[Depends(admin)], status_code=201
)
async def upload(
    asset_id: str,
    request: Request,
    title: str = Query(min_length=1, max_length=120),
    actor: str = Depends(operator),
):
    import re

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", asset_id):
        raise HTTPException(422, "Use a lowercase audio identifier")
    length = request.headers.get("content-length")
    if length:
        try:
            if int(length) > MAX_FILE:
                raise HTTPException(413, "Choose an audio file under 25 MB")
        except ValueError:
            raise HTTPException(400, "Invalid upload length")
    async with uploads:
        fd, name = tempfile.mkstemp(dir=root() / ".incoming", suffix=".part")
        path = Path(name)
        try:
            size = 0
            with os.fdopen(fd, "wb") as output:
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > MAX_FILE:
                        raise HTTPException(413, "Choose an audio file under 25 MB")
                    output.write(chunk)
            return await run_in_threadpool(
                finalize_upload, path, asset_id, title, actor
            )
        finally:
            path.unlink(missing_ok=True)


@app.get("/api/admin/assets", dependencies=[Depends(admin)])
def list_assets():
    with SessionLocal() as db:
        assets = db.scalars(
            select(StoredAsset).order_by(StoredAsset.created_at.desc()).limit(200)
        ).all()
        return {"assets": [asset_record(a) for a in assets]}


@app.get("/api/admin/assets/{sha}", dependencies=[Depends(admin)])
def preview_asset(sha: str):
    with SessionLocal() as db:
        if db.get(StoredAsset, sha) is None or not file_path(sha).is_file():
            raise HTTPException(404, "Audio unavailable")
    return FileResponse(
        file_path(sha),
        media_type="audio/wav",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@app.get("/packs/uploads/{filename}")
def published_audio(filename: str):
    if not filename.endswith(".wav"):
        raise HTTPException(404, "Audio unavailable")
    sha = filename[:-4]
    path = file_path(sha)
    with SessionLocal() as db:
        packs = db.scalars(select(Pack).where(Pack.status == "published")).all()
        if (
            not any(
                any(
                    a.get("url") == f"/packs/uploads/{filename}"
                    and a.get("sha256") == sha
                    for a in p.metadata_json.get("assets", [])
                )
                for p in packs
            )
            or not path.is_file()
        ):
            raise HTTPException(404, "Audio unavailable")
    return FileResponse(
        path,
        media_type="audio/wav",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/admin/packs/{pack_id}/events", dependencies=[Depends(admin)])
def history(pack_id: str):
    with SessionLocal() as db:
        rows = db.scalars(
            select(PackEvent)
            .where(PackEvent.pack_id == pack_id)
            .order_by(PackEvent.revision.desc())
            .limit(100)
        ).all()
        return {
            "events": [
                {
                    "id": r.id,
                    "revision": r.revision,
                    "action": r.action,
                    "actor": r.actor,
                    "created_at": (
                        r.created_at
                        if r.created_at.tzinfo
                        else r.created_at.replace(tzinfo=timezone.utc)
                    ).isoformat(),
                    "details": r.details,
                }
                for r in rows
            ]
        }


from .push import router as reminder_router

app.include_router(reminder_router)
