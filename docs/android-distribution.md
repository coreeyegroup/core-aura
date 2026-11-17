# Android hosting and native updates — v0.22.0

## Customer flow

**Settings → Android app updates → Update latest** is the single app action. It checks the HTTPS release channel and installed identity, downloads the newer APK into private app cache, verifies size/SHA-256/package/version/certificate, then submits the verified self-update to Android. It does not send the user to a browser, Downloads folder or a separate APK-opening step. Android updates the existing package in place with its saved data.

On Android 12+ the updater uses PackageInstaller sessions, declares the normal UPDATE_PACKAGES_WITHOUT_USER_ACTION permission, and requests USER_ACTION_NOT_REQUIRED for this same-app update. Eligible devices can complete after the single app button without another installation prompt. Android remains the authority and can return STATUS_PENDING_USER_ACTION, which opens its confirmation screen. Older devices use Android’s confirmation-based installer. On Android 8+ it may first ask once to allow Core-aura as an installation source; returning after permission continues automatically. If permission is declined, retry through the same button. Installer cancellation keeps the verified APK for retry without a second APK download. If the app was backgrounded when Android requires a confirmation screen, the same button retries from the verified cache in the foreground instead of leaving a disabled update action. This is Android’s standard conditional self-update mechanism for direct website distribution, not Google Play’s in-app update API or a privileged INSTALL_PACKAGES permission.

Progress and the in-flight operation survive closing/reopening Settings in the same app process. Cancel stops checking/downloading/verification; cancellation inside the Android installer belongs to Android. Incomplete or invalid files never reach the installer. A cancelled/failed transfer deletes its partial file. If the app process is restarted, the same button checks the channel again and reuses a complete verified cached file. No resumable partial-download or automatic background update claim is made.

## One-time upgrade to this updater

Versions 0.19.0–0.21.0 contain the older browser-download updater. Install 0.22.0 over that stable app once through its existing update/download path. Do not uninstall it. Future releases use Update latest inside Core-aura. Installing this release does not retroactively change the old APK before that initial upgrade.

The earlier 0.18.0 test APK used a different temporary signing key. It still requires the documented one-time test-to-stable migration: export saved content and voice/audio files outside the app before replacing that test app. Stable installations keep the permanent signing identity.

## URLs and publication

- Download page: https://core-aura.coreeye.in/download.html
- Latest APK: https://core-aura.coreeye.in/android/core-aura-latest.apk
- Update metadata: https://core-aura.coreeye.in/android/latest.json

The website remains the first-install/recovery route. APK hosting is independent of atomic web releases. Wait for the verified main workflow's android-publish job to publish `android-v0.22.0` inputs, then run:

```bash
cd ~/core-aura
git pull --ff-only origin main
sudo bash ops/deploy.sh origin/main
sudo bash ops/start-backend.sh
sudo bash ops/publish-android.sh
bash ops/verify.sh 0.22.0
curl -fsS https://core-aura.coreeye.in/android/latest.json
```

The VPS validates exact-version CI input hashes/source digest, signs the release with its existing permanent private key, verifies it and atomically publishes metadata/immutable APK paths. Java runtime/keytool are installed if missing; no Android SDK is needed on the VPS. Failed publication preserves the current release. Both app version and Android versionCode must increase for changed releases.

## Signing and native restrictions

Keep `/var/lib/core-aura/android-signing/release.p12`, its `password` file, and the private `/var/lib/core-aura/android-signing-backup.tar.gz` backup. Copy the backup to protected independent storage; never put it in Git or public hosting. A missing/changed identity after publication is rejected. Credentials stay on the VPS; CI uses disposable identities only for smoke tests.

The native updater accepts only the fixed Core-aura package ID and exact official HTTPS immutable APK path matching its expected version/hash. Redirects, credentials, query strings, malformed metadata, wrong size/hash, another package, another certificate, old versions and unsupported Android metadata are rejected. Archive identity is checked again after installation-source permission is granted. Android verifies the signed package at installation. Files are bounded to 150 MB, streamed with connection/read/overall deadlines, and stored under a narrow private cache FileProvider path with temporary read permission. Core-aura requests REQUEST_INSTALL_PACKAGES and the normal UPDATE_PACKAGES_WITHOUT_USER_ACTION permission solely to update itself; it exposes no arbitrary package-install endpoint. A mutable PendingIntent targets only its private installation-result receiver. Android decides whether confirmation is required.

## Verification and handset acceptance

Unit tests cover single-action orchestration, current versions, active audio, signature mismatch, duplicate actions, progress across subscriptions, cancellation and permission retry. JVM tests exercise exact URL/identity checks, real file checksums, cached reuse, truncated/oversized/corrupt/redirected downloads, cancellation cleanup and retry. Browser tests use a mocked native bridge to verify the actual Settings interface, one-button behavior, progress across closing Settings, cancellation and the absence of external browser downloads. Native compilation and real APK signing/publication run in CI.

Actual Android installer and installation-source permission dialogs require handset acceptance. Install this release over the stable app, confirm stored tracks/practices remain and Update latest reports current. On the next higher signed release, verify private download → one-time permission if needed → automatic eligible self-update or Android confirmation fallback, with no browser/manual file step or second app icon. Test cancelling/retrying, offline errors and saved-data preservation. OEM-specific installer behavior and process replacement cannot be proven by the mocked browser test. iOS has its own distribution flow and does not install APKs.

Android platform references: https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams#setRequireUserAction(int) and https://developer.android.com/reference/android/Manifest.permission#UPDATE_PACKAGES_WITHOUT_USER_ACTION .
