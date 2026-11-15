from sqlalchemy import Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Pack(Base):
    __tablename__ = "content_packs"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    metadata_json: Mapped[dict] = mapped_column(JSON)
