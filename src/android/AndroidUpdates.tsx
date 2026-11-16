import { useEffect, useState } from "react";
import { registerPlugin } from "@capacitor/core";
import {
  ANDROID_ORIGIN,
  AndroidRelease,
  assessAndroidUpdate,
  fetchAndroidRelease,
  InstalledAndroid,
} from "./channel";
const distribution = registerPlugin<{
  info(): Promise<InstalledAndroid>;
  openDownload(options: { url: string }): Promise<void>;
}>("AppDistribution");
export function AndroidUpdates({ audioActive }: { audioActive: boolean }) {
  const [installed, setInstalled] = useState<InstalledAndroid>(),
    [release, setRelease] = useState<AndroidRelease>(),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [offer, setOffer] = useState<"current" | "available" | "test-migration">();
  useEffect(() => {
    void distribution
      .info()
      .then(setInstalled)
      .catch(() =>
        setStatus(
          "Android app information is unavailable. Reopen the app and try again.",
        ),
      );
  }, []);
  async function check() {
    if (audioActive) {
      setStatus("Stop all audio before updating the app.");
      return;
    }
    setBusy(true);
    setOffer(undefined);
    setRelease(undefined);
    setStatus("Checking Android app updates…");
    try {
      const info = await distribution.info();
      setInstalled(info);
      const candidate = await fetchAndroidRelease();
      const result = assessAndroidUpdate(info, candidate);
      setRelease(candidate);
      setOffer(result);
      setStatus(
        result === "current"
          ? "You have the latest Android app."
          : result === "available"
            ? `Android ${candidate.versionName} is available. Download it, then confirm Update in Android to keep your app data.`
            : "This test APK uses a temporary signing key. Export your data, then replace it with the stable app once. Later stable updates can keep your data.",
      );
    } catch (e) {
      setStatus(
        e instanceof Error
          ? e.message
          : "The Android update check failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function open(url: string) {
    if (audioActive) {
      setStatus("Stop all audio before updating the app.");
      return;
    }
    try {
      await distribution.openDownload({ url });
      setStatus(
        "The download opens outside the app. Open the downloaded APK and confirm Update in Android.",
      );
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Could not open the Android download.",
      );
    }
  }
  return (
    <section className="android-updates" aria-label="Android app updates">
      <h3>Android app updates</h3>
      {installed && (
        <p className="content-note">
          Installed: {installed.versionName} · build {installed.versionCode}
          {installed.debug ? " · test build" : ""}
        </p>
      )}
      <button className="wide" disabled={busy} onClick={() => void check()}>
        Check for app updates
      </button>
      {status && (
        <p role="status" className="content-note">
          {status}
        </p>
      )}
      {offer === "available" && release && (
        <button className="primary wide" onClick={() => void open(release.url)}>
          Download &amp; update to {release.versionName}
        </button>
      )}
      {offer === "test-migration" && (
        <button
          className="wide"
          onClick={() => void open(ANDROID_ORIGIN + "/download.html")}
        >
          Get the stable Android app
        </button>
      )}
      <p className="content-note">
        Android asks you to approve installation. App code updates need an APK;
        content remains available from the current services.
      </p>
    </section>
  );
}
