import { fetchAndroidRelease } from "./channel";
import "./download.css";
const status = document.getElementById("status")!,
  release = document.getElementById("release")!,
  retry = document.getElementById("retry") as HTMLButtonElement;
async function load() {
  retry.disabled = true;
  release.hidden = true;
  status.textContent = "Checking the latest Android release…";
  try {
    const value = await fetchAndroidRelease(location.origin);
    document.getElementById("version")!.textContent =
      value.versionName + " · build " + value.versionCode;
    document.getElementById("size")!.textContent =
      (value.size / 1024 / 1024).toFixed(1) + " MB";
    document.getElementById("minimum")!.textContent =
      value.minSdk === 23
        ? "Android 6.0 or later"
        : "API " + value.minSdk + " or later";
    document.getElementById("sha")!.textContent = value.sha256;
    const link = document.getElementById("apk") as HTMLAnchorElement;
    link.href = value.url;
    link.download = "core-aura-" + value.versionName + ".apk";
    release.hidden = false;
    status.textContent =
      "Latest stable Android app. Future updates use the same app signing identity.";
  } catch {
    status.textContent =
      "The Android download is not available right now. Please try again later.";
  } finally {
    retry.disabled = false;
  }
}
retry.addEventListener("click", () => void load());
void load();
