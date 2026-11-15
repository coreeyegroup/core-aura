# Core-aura installation and updates

## Website and installed PWA

The web application remains static at runtime. A release build requires Node.js 22, npm, Git and standard Ubuntu shell tools. Caddy continues to serve /var/www/core-aura/current.

Deploy the exact revision from the release handoff. The deployment builds an archived snapshot, verifies its output and atomically switches the current symlink. A failed build leaves the active version in place. For rollback, run the same script with the previous release revision. The script also supports older releases that use the web/ directory.

The current deployment script must be extracted from the selected revision before deploying from an older checkout.

After a successful deployment, the PWA settings screen can check for updates. Existing installations can open /update.html. Existing session data is migrated locally when supported and retained in its previous storage key.

## Catalog backend

The web player works independently of the catalog service. The catalog service is an additional content administration foundation.

1. Fast-forward the local checkout to the release.
2. Confirm that port 8793 is available.
3. Run sudo bash ops/start-backend.sh.
4. Install ops/core-aura-with-api.caddy as /etc/caddy/sites/core-aura.caddy.
5. Validate /etc/caddy/Caddyfile and reload Caddy.
6. Request /api/health and /api/catalog.

The startup script creates .env with independent database and admin credentials if it is absent. It never prints them. Restrict the file to its owner and retain it for recovery. The backend uses a dedicated PostgreSQL container and persistent named volume.

Admin requests use Authorization with a Bearer token from CORE_AURA_ADMIN_TOKEN. Create content with POST /api/admin/packs/{id}. Review with PATCH /api/admin/packs/{id}/review and include expected_revision. Publishing requires a reviewed state. Concurrent stale reviews return HTTP 409.

Creator, license, attribution and provenance are required. Only published records appear at GET /api/catalog. The API manages manifests and uploaded WAV files. Listener account synchronization remains pending.

## Backup and restore

Run sudo bash ops/backup-backend.sh /var/backups/core-aura. Copy verified archives to independent storage.

To restore, stop the API and restore into a fresh database first. Verify the schema and content before changing the application connection. Preserve the original database until the restored service passes its health and publication checks. Restoring over an active database requires an explicit operator decision.

## Native application builds

Run npm ci, npm run build and npx cap sync. Open Android Studio with npm run native:android or Xcode with npm run native:ios.

The Android project disables desktop overview sizing and uses the device font scale. GitHub Actions produces a signed debug APK for testing. Debug credentials on ephemeral CI runners are temporary, so production updates require a stable signing key and a managed release channel. Use native builds as test builds until that channel is configured.

The iOS job compiles an unsigned simulator application. Physical iPhone installation and App Store release require the appropriate Apple account and signing configuration.

Native binaries contain their own application assets. Their code updates use the native distribution channel. The in-app updater describes this distinction when running natively.

## Device acceptance

Test normal and enlarged text, portrait/landscape, Bluetooth routes, speaker/headphone changes, calls, alarms, screen lock, offline startup, settings retention, audio pause position and session completion. Background playback and phone-call behavior remain unverified on physical devices.

## Display preferences and audio export

Use Settings → Display to change text size or spacing without reinstalling or reloading. Reset display restores 100% text with compact spacing. Pinch zoom is retained. The page asks for device-width; if a browser is set to Desktop site, turn that browser setting off.

Save a session, open Library, choose WAV audio, select a duration, then Download WAV. A worker renders a mono 44.1 kHz 16-bit file from the saved configuration. Cancel export terminates rendering. Exports are capped at 10 minutes and need device storage for downloads. Settings JSON exports remain available separately. Native shells currently require the website/PWA for WAV download.

## Sound-pack deployment (0.10.0)

The release build generates /catalog-packs.json and content-addressed /packs/core-resonance/1.0.0/*.wav. The current static player works without the API and falls back to its bundled catalog when /api/catalog is unavailable. Pack audio is excluded from the web player's precache; it is downloaded on request and stored transactionally in IndexedDB.

After deploying, run sudo bash ops/update-site.sh. It adds public GET file access headers for native shells while preserving the existing static/API routing, validates Caddy, reloads it, and retains a backup. It restores the previous site file if validation or reload fails. The API permits catalog GET requests from the standard Capacitor localhost origins.

For server-published packs, use Settings → Manage content to upload audio into the persistent content volume. Built-in demonstration assets remain in the static build. Do not manually copy uploaded audio into release directories; the /packs/uploads/ route serves managed files from the backend.

A manifest contains existing title/tradition/creator/license/attribution/provenance/version/minimum_engine metadata and assets with id, title, url, sha256, bytes, seconds. The upload service calculates SHA-256 from normalized served bytes. File IDs must be unique; URLs must be same-site /packs/ paths. New publication requires at least one asset. Old metadata-only catalog entries are ignored by the current browser.

POST /api/admin/packs/{id} creates a draft. PUT to the same route replaces a manifest, requires expected_revision and a higher version, increments the revision and resets it to draft. Use the reviewed then published lifecycle again. Stale updates return 409. Existing offline downloads retain their installed manifest until the user installs a complete valid update. Withdrawal removes a server pack from future discovery; already downloaded local files are not remotely erased.

The demonstrated downloads are original synthesized studies under CC0-1.0, not authentic performer recordings. Published traditional recordings still require rights and practitioner review.

## Content administration deployment (0.11.0)

Run the released frontend deployment, sudo bash ops/start-backend.sh, then sudo bash ops/update-site.sh --enable-api. The Caddy helper adds API and uploaded-audio proxy routes while retaining the site's other directives and automatic rollback checks. The existing PostgreSQL volume is retained. Alembic adds the asset registry and revision-event tables. A new content volume is initialized with the API user's ownership; do not use docker compose down -v during updates.

The current administration workflow is documented in [content-admin.md](content-admin.md). It supersedes the earlier manual hosting procedure for new server-published packs. Built-in generated sound-pack files remain static. New review/publication requires assets uploaded through the managed service; legacy manually hosted records must be re-uploaded when edited and re-reviewed.

The backend startup script retains an existing .env. The default uploaded-content quota is 2147483648 bytes. Set CORE_AURA_CONTENT_LIMIT_BYTES in .env before recreating the API if a different limit is required.
