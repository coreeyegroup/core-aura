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

Creator, license, attribution and provenance are required. Only published records appear at GET /api/catalog. The API manages metadata. Recording uploads and listener account synchronization remain pending.

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
