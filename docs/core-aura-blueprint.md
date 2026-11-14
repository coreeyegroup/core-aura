# Core-aura end-to-end development blueprint

**Status** — Proposed development and release plan, 14 November 2026.  
**Repository path** — `docs/core-aura-blueprint.md`  
**First release target** — A frequency generator that the owner can deploy on Ubuntu and use on a desktop or phone.

## 1. Delivery model

The product owner describes a listening experience. The developer translates it into acceptance criteria, implements and tests it, pushes the changes to GitHub, and supplies a versioned release with Ubuntu commands. The owner chooses when to deploy. Every release identifies its effects on the website, installed progressive web app (PWA), native apps, and offline sound packs.

Deliver the website and PWA first. Prototype native playback early on physical devices, then deliver native Android and iOS applications once the audio and content contracts are stable.

| Change | Release action | What the listener receives |
| --- | --- | --- |
| Website or PWA | Deploy the tagged web build to Ubuntu. | Online visitors receive the new build. The installed PWA detects an update online and offers to reload after the current session. |
| Backend | Apply compatible migrations and deploy the tagged API. | Supported clients use the updated service when connected. Test older app versions before removing an API capability. |
| Sound pack, raga, or session | Publish the reviewed assets and versioned catalog entry. | Compatible players discover the content online. Saved sessions refer to specific pack versions for offline replay. |
| Android app or engine | Sign, test, and publish the Android build through Google Play. | Users receive the released app through the store. Use staged rollout for eligible updates. |
| iOS app or engine | Sign the build, test through TestFlight, and submit through App Store Connect. | Users receive the approved App Store release. Phased release is available for updates. |

A new bowl recording can ship as content when the player understands its pack format. A new synthesis algorithm requires an engine release on the affected platforms.

## 2. Product and sound architecture

The listener’s device generates or plays the audio. The VPS delivers the application, API, catalog, and downloadable assets. Once the required assets are downloaded, a guest can play a saved session offline. The sound engine runs independently of AI services.

| Layer | Proposed technology | Responsibility |
| --- | --- | --- |
| Web and PWA | React, TypeScript, Web Audio API, AudioWorklet | Responsive Sound Studio, player, session builder, downloads, and web playback. |
| Native mobile | React Native with native audio integration | Android and iOS interfaces, audio routing, media controls, background playback, and interruption recovery. Prototype Oboe on Android and AVAudioEngine on iOS. |
| Sound engine | Web audio for the first build. Evaluate shared C++ DSP during device testing. | Tone generation, sample playback, resonances, note scheduling, mixing, smooth fades, and output limiting. |
| Musical content | Versioned instrument, raga, rhythm, and session packs | Tuning, articulations, phrase rules, credits, permissions, and minimum player version. |
| Backend | Python, FastAPI, PostgreSQL | Catalog and release metadata, content review, publication, and optional account synchronization. |
| Local storage | Browser cache and IndexedDB on web. App files and SQLite on mobile. | Verified downloads, favorites, saved sessions, and offline assets. |
| Hosting | Ubuntu, existing Caddy service, Docker Compose | HTTPS, application routing, service operation, asset delivery, and recovery. |
| Release engineering | GitHub, automated checks, tags, versioned artifacts | Trace each deployed build and migration to a commit. Record checks and rollback steps. |

### Frequency controls

| Sound | Meaning of the listener’s input | How to verify it |
| --- | --- | --- |
| Sine tone | Entering 432 Hz sets the oscillator to 432 Hz. | Measure the rendered digital signal. |
| Bansuri or flute | The input sets the intended fundamental within the instrument’s playable range. | Measure the sustained note and review the attack, breath, and timbre by ear. |
| Drum | A tuned stroke exposes an identifiable pitch or resonance. Other strokes expose timbre and articulation. Tempo uses BPM. | Measure the documented resonance where applicable and audition representative strokes. |
| Bell or singing bowl | The input tunes a named resonance within the instrument’s richer spectrum. | Measure that resonance and review the strike, beating, sustain, and decay. |
| Indian classical raga | The input sets Sa. The melody moves through phrases relative to that tonic. | Test transposition and have a practitioner review characteristic phrases and ornamentation. |

**Example session.** The listener selects bansuri, chooses a supported pitch, adds tanpura, sets ten minutes, and presses Play. The device selects the instrument assets, applies tuning, schedules notes, mixes the layers, and fades at the end. Stop remains accessible. Saving captures pack and engine versions, tuning, timing, layer volumes, and any generation seed. Download verifies all required assets before marking the session available offline.

## 3. Development stages and acceptance

| Stage | Work | Completion test |
| --- | --- | --- |
| 0. Release foundation | Establish repository, checks, version display, health endpoint, deployment and rollback scripts. Inspect VPS resources, DNS, and ports. | Deploy a tagged build over HTTPS and rehearse rollback between two builds. |
| 1. Frequency generator | Implement sine tone, numeric Hz entry, volume, timer, fades, immediate stop, responsive layout, and basic PWA installation. | Play and stop 432 Hz on desktop and Android. Measure pitch in an automated render test. |
| 2. Instrument pilot | Add bansuri, tuned drum, bell, and singing bowl. Document playable ranges, articulations, tuning, credits, and rights. Prototype native audio on an affordable Android phone and an iPhone. | Verify each instrument’s pitch or resonance, review its musical quality, and use device results to select the engine architecture. |
| 3. Session builder and offline playback | Add tanpura, multiple layers, layer volume, timeline, favorites, saved sessions, and resumable downloads. | Save a ten-minute bansuri-and-tanpura session, reopen it in airplane mode, and replay it. Interrupt a download and verify recovery. |
| 4. Indian classical music | Begin with one reviewed raga, then add a pack from the other classical tradition. Model Hindustani and Carnatic phrase movement, ornamentation, drone, and rhythmic or free-time passages. | A practitioner of each represented tradition reviews example performances. Changing Sa preserves phrase relationships. |
| 5. Traditional and meditation catalog | Commission a world-tradition pilot pack. Add meditation and chakra sessions with provenance, credits, permissions, and editorial review. | Trace each published session to its approved description, recording, performer, and pack version. Exercise correction and withdrawal. |
| 6. Native Android and iOS | Integrate catalog, offline packs, native playback, media controls, background operation, and Bluetooth routing. | On physical devices, finish a locked-screen session, handle a call and a disconnected headset, and replay a downloaded session offline. |
| 7. Pilot and launch | Test accessibility, stability, CPU, battery, backup restoration, rollback, signed builds, store listings, and support procedures. | Identify the version on a tester’s device, restore a backup, and distribute a verified mobile update. |
| 8. Ongoing delivery | Deliver new requirements, packs, fixes, migrations, and compatibility updates through the same Git workflow. | Each release includes its Git reference, results, Ubuntu commands, mobile impact, and recovery procedure. |

## 4. Ubuntu deployment design

The repository is `coreeyegroup/core-aura`, the operator checkout is `~/core-aura`, and the configured hostname is `core-aura.coreeye.in`. Confirm the repository, DNS, and live host configuration during setup.

- Use a dedicated Compose project and a Core-aura Caddy site. Bind the application to an available loopback port and route HTTPS traffic through the existing Caddy service.
- Provision the dedicated PostgreSQL database `core_aura` and an application role. Verify connectivity from the application container.
- Keep audio packs on persistent versioned storage outside the container. Measure disk use and delivery bandwidth before expanding the catalog.
- Store deployment secrets in a restricted environment file. Keep signing credentials in the corresponding release environment.
- Back up the database and asset inventory, keep a recovery copy independently, and test restoration.
- For first installation, the release handoff supplies the clone URL, exact tag, configuration values to set, database setup, Caddy configuration, migration commands, and verification steps.

## 5. Requirement-to-release procedure

1. **Specify.** The owner describes what a listener should be able to do and on which platforms.
2. **Define acceptance.** The developer identifies observable behavior, affected packs, compatibility requirements, and tests.
3. **Build and test.** Implement the feature, run automated checks, and record physical-device and musician review results where applicable.
4. **Push and tag.** Provide the GitHub commit, release tag, release notes, and build status.
5. **Deploy on Ubuntu.** The owner runs the commands supplied for that release. Deployment selects the exact version, validates configuration, checks backup readiness, applies required migrations, and starts the build.
6. **Verify.** Check HTTPS, API readiness, visible version, catalog access, and an audible smoke test.
7. **Distribute mobile changes.** Publish compatible packs through the VPS catalog. Deliver native changes through signed mobile releases.
8. **Recover.** Supply the previous compatible build and database-specific recovery steps. A failed health check must identify the action required.

### Proposed operator interface

Illustrative update commands for an existing installation, once Stage 0 delivers and tests the scripts:

```bash
cd ~/core-aura
git fetch origin --tags
./ops/deploy.sh v0.2.0
./ops/verify.sh v0.2.0
```

Every release handoff includes **what changed**, **repository, branch, commit and tag**, **exact Ubuntu commands**, **expected live version and listening test**, **PWA and native mobile impact**, and **rollback instructions**.

## 6. Ownership and review

| Owner | Contribution |
| --- | --- |
| Product owner and VPS operator | Set priorities, approve the listening experience, choose hostname and release timing, and verify deployment. |
| Software and release engineering | Implement web, mobile, API, audio integration, tests, migrations, scripts, and release notes. |
| DSP specialist, sound designer, and performers | Verify tuning, timbre, samples, articulations, musical realism, and instrument ranges. |
| Hindustani, Carnatic, and world-tradition practitioners | Review phrases, names, credits, provenance, permissions, and culturally appropriate use. |
| Audiologist and qualified scientific reviewer | Review listening controls and public health language. Present chakra practices in their spiritual context and treat cellular regeneration as a research question. |
| Repository and app-store account holders | Provide Git write access, release ownership, signing arrangements, and mobile distribution access. |

## 7. First release acceptance checklist

The target for **v0.1.0** is one working sound and a verified delivery loop.

- [ ] A Git tag identifies the build and the interface displays its version.
- [ ] The supplied commands deploy it on the Ubuntu VPS and verify the HTTPS endpoint.
- [ ] A listener can enter 432 Hz, set the volume and timer, play the tone, and stop it on desktop and Android.
- [ ] A render test checks the generated pitch and the results accompany the release.
- [ ] A follow-up tagged release demonstrates a visible update on the website and installed PWA after the current listening session.
- [ ] The operator can recover the preceding compatible release using its documented procedure.

## Reference documentation

- [Web service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [Docker Compose in production](https://docs.docker.com/compose/how-tos/production/)
- [Google Play staged updates](https://support.google.com/googleplay/android-developer/answer/6346149)
- [Apple phased app updates](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/)
