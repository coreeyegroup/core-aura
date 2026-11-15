import hmac
import os
from typing import Literal
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text, update
from .database import SessionLocal
from .models import Pack

app = FastAPI(title="Core-aura catalog", version="0.10.0", docs_url=None, redoc_url=None)

app.add_middleware(CORSMiddleware, allow_origins=["capacitor://localhost", "http://localhost", "https://localhost"], allow_methods=["GET"])

class AssetInput(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,79}$")
    title: str = Field(min_length=1, max_length=120)
    url: str = Field(pattern=r"^/packs/[a-zA-Z0-9/_.-]+/[a-zA-Z0-9_.-]+\.wav$", max_length=300)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    bytes: int = Field(ge=46, le=25*1024*1024)
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
        if len({a.id for a in self.assets}) != len(self.assets) or sum(a.bytes for a in self.assets) > 25*1024*1024:
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
    if not expected or not hmac.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(401, "Administrative access required")

def record(pack):
    return {"id": pack.id, "revision": pack.revision, "status": pack.status, **pack.metadata_json}

@app.get("/api/health")
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(503, "Database unavailable")
    return {"status": "ok", "version": "0.10.0"}

@app.get("/api/catalog")
def catalog():
    with SessionLocal() as db:
        rows = db.scalars(select(Pack).where(Pack.status == "published").order_by(Pack.id).limit(200)).all()
        return {"packs": [record(p) for p in rows]}

@app.get("/api/admin/packs", dependencies=[Depends(admin)])
def drafts():
    with SessionLocal() as db:
        return {"packs": [record(p) for p in db.scalars(select(Pack)).all()]}

@app.post("/api/admin/packs/{pack_id}", dependencies=[Depends(admin)], status_code=201)
def create(pack_id: str, data: PackInput):
    import re
    from sqlalchemy.exc import IntegrityError
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", pack_id):
        raise HTTPException(422, "Use a lowercase pack identifier")
    with SessionLocal() as db:
        pack = Pack(id=pack_id, revision=1, status="draft", metadata_json=data.model_dump())
        db.add(pack)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Pack already exists")
        return record(pack)

@app.put("/api/admin/packs/{pack_id}", dependencies=[Depends(admin)])
def replace(pack_id: str, data: PackUpdate):
    with SessionLocal() as db:
        pack = db.get(Pack, pack_id)
        if not pack:
            raise HTTPException(404, "Pack unavailable")
        if tuple(map(int, data.version.split("."))) <= tuple(map(int, pack.metadata_json["version"].split("."))):
            raise HTTPException(409, "Increase the pack version before replacing its manifest")
        result = db.execute(update(Pack).where(Pack.id == pack_id, Pack.revision == data.expected_revision).values(
            revision=Pack.revision+1, status="draft", metadata_json=data.model_dump(exclude={"expected_revision"})))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "Pack changed. Reload it before replacing the manifest")
        db.commit()
        return record(db.get(Pack, pack_id))

@app.patch("/api/admin/packs/{pack_id}/review", dependencies=[Depends(admin)])
def review(pack_id: str, data: ReviewInput):
    allowed = {"draft": {"reviewed"}, "reviewed": {"published", "withdrawn"}, "published": {"withdrawn"}, "withdrawn": {"reviewed"}}
    with SessionLocal() as db:
        pack = db.get(Pack, pack_id)
        if not pack:
            raise HTTPException(404, "Pack unavailable")
        if data.status == "published" and not pack.metadata_json.get("assets"):
            raise HTTPException(409, "Attach an audio file manifest before publishing")
        if data.status not in allowed[pack.status]:
            raise HTTPException(409, "Review the pack before publishing")
        metadata = {**pack.metadata_json, "review": {"reviewer": data.reviewer, "notes": data.notes}}
        result = db.execute(update(Pack).where(Pack.id == pack_id, Pack.revision == data.expected_revision,
            Pack.status == pack.status).values(status=data.status, revision=Pack.revision + 1, metadata_json=metadata))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "Pack changed. Reload it before applying this review")
        db.commit()
        return record(db.get(Pack, pack_id))
