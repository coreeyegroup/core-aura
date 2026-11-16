export const ANDROID_ORIGIN = "https://core-aura.coreeye.in";
export const ANDROID_APPLICATION_ID = "in.coreeye.coreaura";
export type AndroidRelease = {
  schemaVersion: 1;
  applicationId: string;
  versionName: string;
  versionCode: number;
  minSdk: number;
  url: string;
  sha256: string;
  size: number;
  certificateSha256: string;
  publishedAt: string;
};
export type InstalledAndroid = {
  applicationId: string;
  versionName: string;
  versionCode: number;
  sdk: number;
  certificateSha256: string;
  debug: boolean;
};
export function parseAndroidRelease(value: unknown): AndroidRelease {
  const r = value as AndroidRelease;
  if (
    !r ||
    r.schemaVersion !== 1 ||
    r.applicationId !== ANDROID_APPLICATION_ID ||
    !/^\d+\.\d+\.\d+$/.test(r.versionName) ||
    !Number.isInteger(r.versionCode) ||
    r.versionCode < 1 ||
    r.versionCode > 2100000000 ||
    !Number.isInteger(r.minSdk) ||
    r.minSdk < 23 ||
    r.minSdk > 100 ||
    !Number.isInteger(r.size) ||
    r.size < 1000 ||
    r.size > 150 * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/.test(r.sha256) ||
    !/^[a-f0-9]{64}$/.test(r.certificateSha256) ||
    typeof r.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(r.publishedAt))
  )
    throw Error("The Android update information is invalid. Try again later.");
  const url = new URL(r.url);
  if (
    url.origin !== ANDROID_ORIGIN ||
    !url.pathname.startsWith("/android/releases/" + r.sha256 + "/") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/android\/releases\/[a-f0-9]{64}\/core-aura-\d+\.\d+\.\d+\.apk$/.test(
      url.pathname,
    )
  )
    throw Error("The APK download address is invalid.");
  return r;
}
export function assessAndroidUpdate(
  installed: InstalledAndroid,
  release: AndroidRelease,
): "current" | "available" | "test-migration" {
  if (installed.applicationId !== release.applicationId)
    throw Error("This APK is for a different application.");
  if (installed.sdk < release.minSdk)
    throw Error("This Android version is not supported by the new APK.");
  if (installed.certificateSha256 !== release.certificateSha256) {
    if (installed.debug) return "test-migration";
    throw Error(
      "The update signing identity differs from this app. Contact the app owner before updating.",
    );
  }
  return release.versionCode > installed.versionCode ? "available" : "current";
}
export async function fetchAndroidRelease(origin = ANDROID_ORIGIN) {
  const response = await fetch(origin + "/android/latest.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw Error(
      "The Android update service is not available yet. Try again later.",
    );
  const text = await response.text();
  if (text.length > 32768)
    throw Error("The Android update information is too large.");
  try {
    return parseAndroidRelease(JSON.parse(text));
  } catch {
    throw Error(
      "The Android update service returned invalid information. Try again later.",
    );
  }
}
