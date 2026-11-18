#!/usr/bin/env python3
"""Provision named content roles without printing credentials or rotating existing keys."""
import json
import os
from pathlib import Path
import secrets

root=Path(__file__).resolve().parents[1]
env=root/'.env'
state=Path('/var/lib/core-aura/admin-accounts.json')
if os.geteuid()!=0:
    raise SystemExit('Run with sudo after ops/start-backend.sh has created .env.')
if not env.is_file():
    raise SystemExit('Run ops/start-backend.sh first.')
text=env.read_text()
if any(line.startswith('CORE_AURA_ADMIN_USERS=') and line.split('=',1)[1].strip(" '\"") not in ('','{}') for line in text.splitlines()):
    raise SystemExit('Named content accounts are already configured. Existing identities were preserved.')
if state.exists():
    users=json.loads(state.read_text())
else:
    users={name:{'role':role,'token':secrets.token_hex(32)} for name,role in [('core-aura-admin','administrator'),('core-aura-editor','editor'),('core-aura-reviewer','reviewer')]}
    state.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(state,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as output: json.dump(users,output,indent=2)
lines=[line for line in text.splitlines() if not line.startswith('CORE_AURA_ADMIN_USERS=')]
lines.append("CORE_AURA_ADMIN_USERS='"+json.dumps(users,separators=(',',':'))+"'")
tmp=env.with_suffix('.env.pending')
fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as output: output.write('\n'.join(lines)+'\n')
os.replace(tmp,env)
print('Named administrator, editor and reviewer accounts configured.')
print('Private credentials: /var/lib/core-aura/admin-accounts.json (root only). Back up this file securely.')
print('Run sudo bash ops/start-backend.sh to apply. Existing Android signing keys were not changed.')
