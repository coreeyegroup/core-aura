"""Append only missing VAPID keys to protected deployment env; never print secrets."""

import base64
import sys
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

path = Path(sys.argv[1])
values = dict(
    line.split("=", 1)
    for line in path.read_text().splitlines()
    if "=" in line and not line.startswith("#")
)
private = values.get("CORE_AURA_VAPID_PRIVATE_KEY", "")
public = values.get("CORE_AURA_VAPID_PUBLIC_KEY", "")
if public and not private:
    raise SystemExit(
        "Restore the existing VAPID private key from your protected .env backup"
    )
if private:
    key = serialization.load_der_private_key(
        base64.urlsafe_b64decode(private + "=" * (-len(private) % 4)), None
    )
else:
    key = ec.generate_private_key(ec.SECP256R1())
encode = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
computed = encode(
    key.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
)
if public and public != computed:
    raise SystemExit("VAPID keys do not match; restore the matching pair")
with path.open("a") as output:
    if not private:
        output.write(
            "\nCORE_AURA_VAPID_PRIVATE_KEY="
            + encode(
                key.private_bytes(
                    serialization.Encoding.DER,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption(),
                )
            )
            + "\n"
        )
    if not public:
        output.write("CORE_AURA_VAPID_PUBLIC_KEY=" + computed + "\n")
