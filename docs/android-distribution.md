# Android APK hosting and updates — v0.19.0

## Customer URLs

- Download page: https://core-aura.coreeye.in/download.html
- Latest APK: https://core-aura.coreeye.in/android/core-aura-latest.apk
- Update channel: https://core-aura.coreeye.in/android/latest.json

The download page is linked from the website header and Settings. It shows the published Android version, file size, supported Android level and a checksum. APKs are served from a persistent directory outside atomic web releases; a web deployment does not remove them.

## Publish on the Ubuntu VPS

The verified main-branch workflow publishes unsigned Android build inputs as the GitHub prerelease `android-v0.19.0`. These inputs are not installable customer APKs. Wait for the main workflow's android-publish job to succeed before running the publisher.

```bash
cd ~/core-aura
git pull --ff-only origin main
git fetch origin release/v0.19.0-android-channel
sudo bash ops/deploy.sh FETCH_HEAD
sudo bash ops/start-backend.sh
sudo bash ops/update-site.sh --enable-api
sudo bash ops/publish-android.sh
bash ops/verify.sh 0.19.0
curl -fsS https://core-aura.coreeye.in/android/latest.json
```

`publish-android.sh` installs Java 17 runtime/keytool if missing. Android Studio and the Android SDK are not required on the VPS. It downloads the exact-version unsigned APK and signer tool from the repository's verified build, checks their hashes and native source digest against the checkout, signs and verifies the APK, then switches the public Android pointer atomically. It refuses a downgrade, changed code under an existing versionCode, altered signing identity or invalid input. A failed publication preserves the prior public APK. Run it again safely after a transient failure.

For future releases use the same sequence with that release's version/ref. Every changed native release must increment both the numeric Android versionCode and the application version. Publishing web code alone cannot update installed APK code.

## Permanent signing identity

The private key and generated password are created once on the VPS at:

- `/var/lib/core-aura/android-signing/release.p12`
- `/var/lib/core-aura/android-signing/password`

The directory is private and files are restricted to their owner. The initial private backup is `/var/lib/core-aura/android-signing-backup.tar.gz`. Copy that archive to protected independent storage. It contains signing credentials; never put it in Git, the public website or a public share. Keep the original signing identity throughout the app's life. If the state is missing or incomplete after publication, the script stops and asks for its original backup instead of generating an incompatible key.

Private release credentials do not enter GitHub Actions. CI only uses a disposable test key for its publication smoke test. GitHub stores unsigned build inputs; the VPS signs the customer APK with the permanent identity.

## Android app update flow

1. Open Settings → Android app updates.
2. Tap Check for app updates. The app reads its installed package, version/build, Android API and certificate from a local native plugin.
3. The HTTPS channel must identify the same package, a supported Android version and the same signing certificate. Only a higher versionCode produces an update offer.
4. Tap Download & update. The official immutable APK URL opens outside the app for download.
5. Open the downloaded APK and approve Update in Android. A matching signed update preserves the app's existing local data.

Android requires an explicit installation decision. This direct website distribution flow does not install silently and does not request self-install privileges in Core-aura. A Google Play distribution channel would use its own store update mechanism.

The native bridge restricts download intents to the official HTTPS domain and the app download page or immutable APK paths. The update metadata is validated, bounded, fetched without cache and tied to an APK hash path. The operating system verifies the signed APK when it is installed. Downloads can be cancelled through the browser/system download controls. Audio must be stopped before the update action.

## One-time move from the earlier test APK

The previously supplied 0.18.0 test APK used an ephemeral debug signing identity. It cannot be updated in place with the new permanent release key. This is a one-time signing transition, not the future update procedure.

Before replacing that test app, export practices, sound sessions, the affirmation library and personal voice WAVs. Complete the share/save to Downloads or other storage outside the test app. Then uninstall the test APK once, install the stable APK from the domain and import those files. Browser/PWA data lives separately and is not automatically copied to the native app. Later stable APKs keep the same signing identity and update over the installed stable app without uninstalling it.

## Public files and recovery

Published files live under `/var/www/core-aura/android/releases/<apk-sha256>/`. `current` is an atomic symlink; `latest.json` and `core-aura-latest.apk` follow it. The versioned metadata uses an immutable APK URL so a concurrent publication cannot replace the bytes named by an update offer. Caddy gives the public channel CORS access and a no-store response, with APK download content headers.

Do not manually change a published version or its certificate. Restore a verified channel/signing backup for recovery, or issue a higher build number. Keep old immutable APK paths while clients may be downloading them. No database migration or new public port is introduced by this distribution feature.

## Verification

The pipeline builds debug and unsigned release APKs, compiles Java policy tests, signs a real release APK with an ephemeral test key, verifies its certificate, repeats publication idempotently and checks failure preservation and web/native directory independence. Web tests cover the download page, missing channel, retry, immutable URL, phone layout and accessibility. Unit tests cover version ordering, identity mismatch, test migration, unsupported Android and invalid metadata/URLs. Caddy upgrades are tested for idempotence and rollback and both deployed site templates are validated.

Physical Android acceptance: install the stable APK, confirm the native installed version/build is shown, tap Check for app updates and confirm the current-version message. On the next higher build, download and approve Update without uninstalling; confirm saved practices, recordings and sound sessions remain available. Download approval, Android installation confirmation and device-specific prompts need this actual phone check. iOS APK installation is not supported; its store distribution remains separate.
