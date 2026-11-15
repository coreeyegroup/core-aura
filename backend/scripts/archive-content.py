"""Stream immutable audio only; never include incoming/unfinished uploads."""

import os
from pathlib import Path
import sys
import tarfile

root = Path(os.environ.get("CORE_AURA_CONTENT_ROOT", "/data/content"))
with tarfile.open(fileobj=sys.stdout.buffer, mode="w|gz") as archive:
    for path in sorted(root.glob("*.wav")):
        archive.add(path, arcname=path.name, recursive=False)
