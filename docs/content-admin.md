# Core-aura content administration

## Install

Deploy v0.11.0, then run:

```bash
sudo bash ops/start-backend.sh
sudo bash ops/update-site.sh --enable-api
curl -fsS https://core-aura.coreeye.in/api/health
```

The startup script creates credentials only if .env does not exist. Existing credentials and database data are retained. The API has a separate persistent Docker content volume. Static frontend deployments do not delete it. Avoid docker compose down -v, which removes named volumes.

Open https://core-aura.coreeye.in/#admin or Settings → Manage content in the website. Native shells point operators to the website.

## Access

Read CORE_AURA_ADMIN_TOKEN locally from the server's .env, for example using sudo nano .env. Do not commit that file or send the key in chat. Enter your operator name and the key in the administration screen. The key remains in tab memory; sign out or reload to discard it. No credential is stored in browser storage or passed in a URL.

This release uses one administrator credential. Operator names and reviewer names are recorded as entered. Separate accounts, independently authenticated reviewer roles and tamper-evident external audit storage are not implemented. Rotate the access key by changing .env and recreating the API when required; clients must reconnect.

## Create and upload

1. Select New pack and enter a lowercase identifier, title, description, content version and minimum engine version.
2. Fill creator, tradition/origin, license or permission, attribution, and source/review context.
3. Select a WAV and review its upload identifier and title.
4. Upload and attach it. Uploaded files are private until publication.
5. Save draft. The attachment belongs to the draft only after saving.

The service accepts 16-bit uncompressed PCM WAV, mono/stereo, 44.1 or 48 kHz, up to 25 MiB. It normalizes WAV container headers while preserving audio samples. Embedded container metadata is removed; copy any relevant creator, rights or source information into the explicit pack fields. Original files on your computer are unchanged.

Each pack supports up to 20 files and 25 MiB total. New server publication uses managed /packs/uploads/ content-addressed URLs. Arbitrary external URLs and manually typed file hashes cannot bypass upload verification. Built-in generated packs remain separate static content.

Available uploads can be previewed privately and attached to another draft. Identical canonical audio is deduplicated. Uploads remain stored even if an unsaved draft is abandoned; automatic deletion and orphan cleanup are not included. The default total content quota is 2 GiB and is configurable with CORE_AURA_CONTENT_LIMIT_BYTES.

## Review and publish

Preview the audio, check credits and permission, tuning/quality, tradition descriptions and product wording. Record useful review notes, then Mark reviewed. Record publication notes and Publish pack. The server verifies registered files and their actual hashes before both transitions.

Published packs appear in Explore → Sound packs after Refresh catalog. Public audio is served through Caddy's /packs/uploads/ proxy. Draft/reviewed/withdrawn files require administrator access unless another published pack references the same immutable file.

Editing an existing pack requires a higher content version. Saving increments its revision and resets the pack to draft. Review and publish again. Concurrent stale updates return a conflict; use Refresh list and reselect the pack before applying a new decision. Withdrawal removes future public discovery/access; already downloaded files and browser caches remain on listeners' devices.

Revision history records creation, version replacement and status decisions with the entered operator, notes, revision and timestamp. No API edits historical events. Database administrators can still alter the database; this is not an independently notarized audit log.

## Backups

```bash
sudo bash ops/backup-backend.sh /var/backups/core-aura
```

The command creates a PostgreSQL dump, audio tar.gz archive and checksum file. It verifies the database archive directory and each audio file's SHA-256 without extracting paths. Copy complete backup pairs, checksums and the protected deployment configuration to independent storage.

The database snapshot is taken first. Managed audio files are immutable and are not deleted by this API, so the subsequent archive includes the files referenced by that snapshot. In-progress uploads are excluded. A failed backup leaves .partial files and does not report a verified pair.

For recovery, use fresh database/content volumes or a separate staging instance. Verify checksums, restore the database with pg_restore, verify the audio archive using ops/verify-content-backup.py, and extract only the validated SHA-named WAV members into the new content volume. Set ownership to UID/GID 10001 and restrictive file permissions before starting the API. Preserve the original volumes until health, private previews, published downloads and file hashes pass. Do not restore over live data without an operator's deliberate recovery decision.

## Acceptance

Confirm wrong-key rejection, a private draft preview, publication, public download, withdrawal, revision conflicts and persistence after recreating the API. Rehearse recovery from an independently stored backup before relying on the service for valuable recordings. Uploading audio does not establish its musical authenticity or clinical efficacy; content review remains the operator's responsibility.
