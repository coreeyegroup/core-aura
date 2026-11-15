"""CI-only heartbeat fixture. Does not send pushes or start the real worker."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.database import SessionLocal
from app.models import ReminderWorker

with SessionLocal() as db:
    db.merge(ReminderWorker(id=1, heartbeat=time.time()))
    db.commit()
