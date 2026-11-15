"""Verify an archive without extracting any paths."""

import hashlib
import re
import sys
import tarfile

with tarfile.open(sys.argv[1], "r:gz") as archive:
    seen = set()
    for item in archive:
        if (
            not item.isfile()
            or not re.fullmatch(r"[a-f0-9]{64}\.wav", item.name)
            or item.name in seen
        ):
            raise SystemExit("Unexpected backup entry")
        seen.add(item.name)
        digest = hashlib.sha256()
        source = archive.extractfile(item)
        for chunk in iter(lambda: source.read(262144), b""):
            digest.update(chunk)
        if digest.hexdigest() != item.name[:-4]:
            raise SystemExit("Audio backup integrity failed")
print("Verified audio archive:", len(seen), "files")
