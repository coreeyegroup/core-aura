import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ANDROID_ORIGIN,
  AndroidRelease,
  InstalledAndroid,
  parseAndroidRelease,
  assessAndroidUpdate,
  fetchAndroidRelease,
} from "../src/android/channel";
const release = (): AndroidRelease => ({
  schemaVersion: 1,
  applicationId: "in.coreeye.coreaura",
  versionName: "0.19.0",
  versionCode: 19,
  minSdk: 23,
  url:
    ANDROID_ORIGIN +
    "/android/releases/" +
    "a".repeat(64) +
    "/core-aura-0.19.0.apk",
  sha256: "a".repeat(64),
  size: 8000000,
  certificateSha256: "b".repeat(64),
  publishedAt: "2026-11-16T10:00:00Z",
});
const installed = (): InstalledAndroid => ({
  applicationId: "in.coreeye.coreaura",
  versionName: "0.18.0",
  versionCode: 18,
  sdk: 34,
  certificateSha256: "b".repeat(64),
  debug: false,
});
afterEach(() => vi.unstubAllGlobals());
describe("Android APK update channel", () => {
  it("offers only newer matching-identity APKs and blocks a stable identity change", () => {
    expect(
      assessAndroidUpdate(installed(), parseAndroidRelease(release())),
    ).toBe("available");
    expect(
      assessAndroidUpdate({ ...installed(), versionCode: 19 }, release()),
    ).toBe("current");
    expect(
      assessAndroidUpdate({ ...installed(), versionCode: 20 }, release()),
    ).toBe("current");
    expect(() =>
      assessAndroidUpdate(
        { ...installed(), certificateSha256: "c".repeat(64) },
        release(),
      ),
    ).toThrow(/signing identity/);
    expect(
      assessAndroidUpdate(
        { ...installed(), certificateSha256: "c".repeat(64), debug: true },
        release(),
      ),
    ).toBe("test-migration");
  });
  it("rejects unsupported Android, wrong apps, unsafe URLs and malformed metadata", () => {
    expect(() =>
      assessAndroidUpdate({ ...installed(), sdk: 22 }, release()),
    ).toThrow(/not supported/);
    expect(() =>
      assessAndroidUpdate(
        { ...installed(), applicationId: "other" },
        release(),
      ),
    ).toThrow(/different application/);
    for (const url of [
      "http://core-aura.coreeye.in/android/a.apk",
      "https://example.org/app.apk",
      ANDROID_ORIGIN + "/private/app.apk",
      release().url + "?redirect=elsewhere",
    ])
      expect(() => parseAndroidRelease({ ...release(), url })).toThrow();
    expect(() =>
      parseAndroidRelease({ ...release(), versionCode: 0 }),
    ).toThrow();
    expect(() =>
      parseAndroidRelease({ ...release(), sha256: "wrong" }),
    ).toThrow();
  });
  it("reports unpublished or malformed channels and requests fresh bounded update metadata", async () => {
    const fetch = vi.fn(
      async () => new Response("unavailable", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(fetchAndroidRelease()).rejects.toThrow(/not available/);
    fetch.mockImplementation(
      async () => new Response(JSON.stringify(release())),
    );
    await expect(fetchAndroidRelease()).resolves.toEqual(release());
    expect(fetch.mock.calls.at(-1)?.[1]).toMatchObject({ cache: "no-store" });
  });
});
